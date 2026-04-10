'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path     = require('path');
const http     = require('http');
const { exec } = require('child_process');
const os       = require('os');
const vcam     = require('./vcam');  // Virtual Camera Engine (Hito 3)

// Carga de dependencias opcionales
let express, WebSocket, cors;
try {
  express   = require('express');
  WebSocket = require('ws');
  cors      = require('cors');
} catch (e) {
  console.error('[SynCam] Dependencias faltantes:', e.message);
  process.exit(1);
}

// ── State ──────────────────────────────────────────────────
let mainWindow        = null;
let httpServer        = null;
let wss               = null;
let activeConnections = 0;
let connectedClients  = new Map();
let serverPort        = 8080;
let serverReady       = false;

// ── Network helpers ────────────────────────────────────────
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  Object.values(interfaces).forEach(arr => {
    if (!arr) return;
    arr.forEach(iface => {
      if (!iface.internal && iface.family === 'IPv4') {
        ips.push(iface.address);
      }
    });
  });
  return ips;
}

// ── Express + WebSocket server ─────────────────────────────
function startServer(port) {
  const expressApp = express();
  expressApp.use(cors({ origin: '*' }));
  expressApp.use(express.json({ limit: '20mb' }));
  
  // Servir estáticos para la página del "Lienzo de OBS" (obs.html)
  expressApp.use(express.static(path.join(__dirname, 'public')));

  // Registrar endpoints de Virtual Camera (MJPEG stream)
  vcam.registerMjpegEndpoint(expressApp, port);

  let serverTransform = { 
    rotation: 0, mirrorH: false, mirrorV: false, zoom: 1.0,
    brightness: 1.0, contrast: 1.0, saturation: 1.0, sharpen: 0.0 
  };

  // POST /transform — desktop UI envía sus ajustes actuales de vista y filtros
  expressApp.post('/transform', (req, res) => {
    serverTransform = { ...serverTransform, ...req.body };
    if (wss) {
      wss.clients.forEach(c => {
        if (c.isObsWatcher && c.readyState === WebSocket.OPEN) {
          c.send(JSON.stringify({ type: 'transform', ...serverTransform }));
        }
      });
    }
    res.json({ success: true });
  });

  // POST /frame — celular envía frames en base64
  expressApp.post('/frame', (req, res) => {
    const { frame, rotation, mirrorH, timestamp } = req.body;
    if (frame && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('new-frame', {
        frame,
        rotation:  rotation  ?? 0,
        mirrorH:   mirrorH   ?? false,
        timestamp: timestamp ?? Date.now(),
      });
    }
    res.json({ ok: true });
  });

  // GET /ping
  expressApp.get('/ping', (_req, res) => res.json({ pong: true, time: Date.now(), version: '1.0.0' }));

  // GET /info
  expressApp.get('/info', (_req, res) => {
    res.json({ name: 'SynCam Desktop', version: '1.0.0', ips: getLocalIPs(), port: serverPort });
  });

  httpServer = http.createServer(expressApp);

  // WebSocket de baja latencia — maxPayload alto para frames base64
  wss = new WebSocket.Server({ 
    server: httpServer, 
    maxPayload: 50 * 1024 * 1024,
    perMessageDeflate: false // Desactivar compresión para ganar velocidad de CPU
  });

  wss.on('connection', (ws, req) => {
    // Desactivar Algoritmo de Nagle (envío inmediato de paquetes)
    if (req.socket && req.socket.setNoDelay) {
      req.socket.setNoDelay(true);
    }
    
    activeConnections++;
    const clientIp = req.socket.remoteAddress?.replace('::ffff:', '') || 'desconocida';
    connectedClients.set(clientIp, { connectedAt: new Date().toISOString(), ip: clientIp });

    console.log(`[SynCam] Cliente conectado: ${clientIp} | Total: ${activeConnections}`);

    // Heartbeat: ping every 10s to detect dead connections
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('client-connected', {
        ip:      clientIp,
        count:   activeConnections,
        clients: Array.from(connectedClients.values()),
      });
    }

    ws.on('message', (data) => {
      // --- PROTOCOLO BINARIO EXTENDIDO (SY / SA) ---
      // VIDEO: [0x53 'S', 0x59 'Y', Rot/90, Mirror, Len(4)]  + JPEG payload
      // AUDIO: [0x53 'S', 0x41 'A', SR_Hi,  SR_Lo,  Len(4)]  + PCM16 payload
      if (Buffer.isBuffer(data) && data.length > 8 && data[0] === 0x53) {

        // ── 🎥 PAQUETE DE VIDEO ─────────────────────────────
        if (data[1] === 0x59) {
          const rot = data[2] * 90;
          const mir = data[3] === 1;
          const jpegBuffer = data.subarray(8);

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('new-frame-bin', {
              buffer:   jpegBuffer,
              rotation: rot,
              mirrorH:  mir,
              ts:       Date.now()
            });
          }

          // 📺 Virtual Camera: pushear frame al MJPEG stream
          vcam.pushFrame(jpegBuffer);

          // Relay a OBS Browser Sources
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === 1 && client.isObsWatcher) {
              client.send(data);
            }
          });
          return;
        }

        // ── 🎤 PAQUETE DE AUDIO (PCM16 mono) ───────────────
        if (data[1] === 0x41) {
          // Bytes [2-3]: sample rate encode → sampleRate = (SR_Hi << 8) | SR_Lo
          const sampleRate = (data[2] << 8) | data[3];
          const pcmBuffer  = data.subarray(8); // Int16 little-endian

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('new-audio-chunk', {
              buffer:     pcmBuffer,   // Buffer con samples PCM16
              sampleRate: sampleRate,
              ts:         Date.now()
            });
          }
          return;
        }
      }

      try {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'obs_subscribe') {
          // Marca este socket como una salida para OBS
          ws.isObsWatcher = true;
          console.log(`[SynCam] OBS Browser conectado desde: ${clientIp}`);
          // Mandar el estado actual de transformación
          ws.send(JSON.stringify({ type: 'transform', ...serverTransform }));
        }
        else if (msg.type === 'frame') {
          // 1. Enviar a la ventana local (UI)
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('new-frame', {
              frame:     msg.frame,
              rotation:  msg.rotation  ?? 0,
              mirrorH:   msg.mirrorH   ?? false,
              timestamp: msg.timestamp ?? Date.now(),
            });
          }
          
          // 2. Transmitir en vivo (Relay) a todas las fuentes de OBS conectadas
          if (wss) {
            wss.clients.forEach((client) => {
              if (client !== ws && client.isObsWatcher && client.readyState === WebSocket.OPEN) {
                // Se lo pasamos exacto, reduciendo latencia al máximo
                client.send(data.toString()); 
              }
            });
          }
        } 
        else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
        }
      } catch (_) { /* datos no-JSON, ignorar */ }
    });

    ws.on('close', () => {
      activeConnections = Math.max(0, activeConnections - 1);
      connectedClients.delete(clientIp);
      console.log(`[SynCam] Cliente desconectado: ${clientIp} | Activos: ${activeConnections}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('client-disconnected', {
          ip:      clientIp,
          count:   activeConnections,
          clients: Array.from(connectedClients.values()),
        });
      }
    });

    ws.on('error', (err) => console.error('[SynCam] WS error:', err.message));
  });

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[SynCam] Puerto ${port} ocupado, probando ${port + 1}`);
      startServer(port + 1);
    } else {
      console.error('[SynCam] Error servidor:', err.message);
    }
  });

  httpServer.listen(port, '0.0.0.0', () => {
    serverPort  = port;
    serverReady = true;
    console.log(`[SynCam] Servidor HTTP+WS listo en :${port}`);
    
    // Autocargar ADB USB reverse port usando el binario integrado
    let binPath;
    if (app.isPackaged) {
      binPath = path.join(process.resourcesPath, 'bin', 'adb.exe');
    } else {
      binPath = path.join(__dirname, '..', 'bin', 'adb.exe');
    }
    
    exec(`"${binPath}" reverse tcp:${port} tcp:${port}`, (err) => {
      if (err) {
        console.log('[SynCam] ADB reverse devuelto error (Posiblemente el móvil no está conectado via USB). Ignorando...');
      } else {
        console.log(`[SynCam] Puente USB configurado automáticamente en puerto ${port} (Usando binario local)`);
      }
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-started', { port: serverPort, ips: getLocalIPs() });
    }

    // Heartbeat interval: check all clients every 15s
    setInterval(() => {
      if (!wss) return;
      wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          console.log('[SynCam] Heartbeat: cliente no responde, desconectando');
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 15000);
  });
}

// ── Crear ventana ──────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:     1140,
    height:    740,
    minWidth:  860,
    minHeight: 580,
    frame:     false,
    backgroundColor: '#080812',
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload:          path.join(__dirname, 'preload.js'),
      webSecurity:      false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Si el servidor ya está listo, notificar
    if (serverReady) {
      mainWindow.webContents.send('server-started', { port: serverPort, ips: getLocalIPs() });
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── ADB helpers ────────────────────────────────────────────
function checkAdb() {
  return new Promise((resolve) => {
    exec('adb version', { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve({ available: false, error: err.message });
      const match = stdout.match(/Android Debug Bridge version ([\d.]+)/);
      resolve({ available: true, version: match ? match[1] : 'desconocida' });
    });
  });
}

function runAdbReverse(port) {
  return new Promise((resolve) => {
    exec(`adb reverse tcp:${port} tcp:${port}`, { timeout: 8000 }, (err, _out, stderr) => {
      if (err) return resolve({ ok: false, error: stderr || err.message });
      resolve({ ok: true });
    });
  });
}

function listAdbDevices() {
  return new Promise((resolve) => {
    exec('adb devices -l', { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve({ ok: false, devices: [] });
      const lines = stdout.split('\n').slice(1).filter(l => l.trim() && !l.includes('List of'));
      const devices = lines.map(l => {
        const parts = l.trim().split(/\s+/);
        return { id: parts[0], status: parts[1] };
      }).filter(d => d.id);
      resolve({ ok: true, devices });
    });
  });
}

// ── App lifecycle ──────────────────────────────────────────

app.whenReady().then(() => {
  // IPC handlers
  ipcMain.handle('get-network-info', () => ({ ips: getLocalIPs(), port: serverPort }));
  ipcMain.handle('get-connections',  () => ({ count: activeConnections, clients: Array.from(connectedClients.values()) }));
  
  ipcMain.handle('disconnect-all', () => {
    if (wss) {
      wss.clients.forEach((client) => {
        if (!client.isObsWatcher) {
          client.terminate();
        }
      });
    }
  });

  // Set quality — broadcasts to all mobile clients
  ipcMain.handle('set-quality', (event, quality) => {
    // Map quality string to pixel dimensions
    const qualityMap = {
      '144p':  { width: 256,  height: 144  },
      '240p':  { width: 426,  height: 240  },
      '360p':  { width: 640,  height: 360  },
      '480p':  { width: 854,  height: 480  },
      '720p':  { width: 1280, height: 720  },
      '1080p': { width: 1920, height: 1080 },
    };
    const dims = qualityMap[quality] || qualityMap['720p'];
    const cmd = JSON.stringify({ type: 'set_quality', quality, ...dims });
    if (wss) {
      wss.clients.forEach((client) => {
        if (!client.isObsWatcher && client.readyState === 1) { // WS OPEN
          client.send(cmd);
        }
      });
    }
    console.log(`[SynCam] Calidad enviada al móvil: ${quality} (${dims.width}x${dims.height})`);
    return { ok: true };
  });
  
  // OBS Automated Linking
  ipcMain.handle('obs-link', async (event, pwd, targetPort) => {
    try {
      const { OBSWebSocket } = require('obs-websocket-js');
      const obs = new OBSWebSocket();
      await obs.connect('ws://127.0.0.1:4455', pwd, { rpcVersion: 1 });
      const { currentProgramSceneName } = await obs.call('GetSceneList');
      await obs.call('CreateInput', {
        sceneName: currentProgramSceneName,
        inputName: 'SynCam Virtual ' + Math.floor(Math.random()*100),
        inputKind: 'browser_source',
        inputSettings: {
          url: `http://127.0.0.1:${targetPort}/stream.mjpeg`,
          width: 1280,
          height: 720,
          fps_custom: true,
          fps_num: 30,
          fps_den: 1
        }
      });
      await obs.disconnect();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
  ipcMain.handle('window-maximize', () => {
    if (!mainWindow) return;
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.handle('window-close', () => app.quit());
  ipcMain.handle('open-link', (event, url) => {
    const { shell } = require('electron');
    shell.openExternal(url);
  });

  ipcMain.handle('adb-check',   ()     => checkAdb());
  ipcMain.handle('adb-reverse', (_e, port) => runAdbReverse(port || serverPort));
  ipcMain.handle('adb-devices', ()     => listAdbDevices());

  // ── 📺 Virtual Camera IPC (Hito 3) ────────────────────────
  const getFfmpegPath = () => vcam.resolveFfmpegPath(
    app.isPackaged,
    process.resourcesPath,
    __dirname
  );

  // Estado actual del motor VCam
  ipcMain.handle('vcam-status', () => ({
    ...vcam.getStatus(),
    mjpegUrl: `http://127.0.0.1:${serverPort}/stream.mjpeg`,
    port: serverPort,
  }));

  // Detectar ffmpeg y drivers disponibles
  ipcMain.handle('vcam-check', async () => {
    const ffmpegPath = getFfmpegPath();
    const [ffmpegInfo, driverName] = await Promise.all([
      vcam.checkFfmpeg(ffmpegPath),
      vcam.detectVirtualCamera(ffmpegPath),
    ]);
    return {
      ffmpeg:     ffmpegInfo,
      driverName: driverName,
      driverFound: !!driverName,
      mjpegUrl:   `http://127.0.0.1:${serverPort}/stream.mjpeg`,
    };
  });

  // Activar bridge ffmpeg → Virtual Camera
  ipcMain.handle('vcam-start', async (_e, opts) => {
    const ffmpegPath = getFfmpegPath();
    const driverName = opts?.deviceName || await vcam.detectVirtualCamera(ffmpegPath);
    if (!driverName) {
      return { ok: false, error: 'No se encontró driver de cámara virtual instalado.' };
    }
    return vcam.startVirtualCameraFeed(ffmpegPath, driverName, serverPort, opts);
  });

  // Detener bridge
  ipcMain.handle('vcam-stop', () => {
    vcam.stopVirtualCameraFeed();
    return { ok: true };
  });

  // Iniciar servidor primero → luego ventana
  startServer(8080);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (httpServer) httpServer.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (httpServer) httpServer.close();
});
