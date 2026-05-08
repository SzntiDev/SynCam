const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const os = require('os');
const { Server } = require('socket.io');

let mainWindow;

// ─── Obtener IP local del servidor ────────────────────────────────────────────
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// ─── Servidor de señalización WebRTC ─────────────────────────────────────────
function initSignalingServer() {
  const server = http.createServer();
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    // Permitir payloads grandes para candidatos ICE
    maxHttpBufferSize: 1e6,
  });

  // Guardar referencia a los sockets para poder hacer broadcast selectivo
  const clients = new Set();

  io.on('connection', (socket) => {
    clients.add(socket);
    console.log(`[Signaling] Nuevo cliente: ${socket.id} | Total: ${clients.size}`);

    // Relay de mensajes WebRTC (Offer/Answer/ICE) a los demás clientes
    socket.on('webrtc-message', (data) => {
      socket.broadcast.emit('webrtc-message', data);
    });

    // Relay de comandos de control (flip-camera, etc.)
    socket.on('control', (data) => {
      socket.broadcast.emit('control', data);
    });

    socket.on('disconnect', (reason) => {
      clients.delete(socket);
      console.log(`[Signaling] Desconectado: ${socket.id} | Razón: ${reason}`);
    });

    socket.on('error', (err) => {
      console.error(`[Signaling] Error en socket ${socket.id}:`, err);
    });
  });

  const PORT = 8080;
  server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIPAddress();
    console.log('╔════════════════════════════════════════╗');
    console.log('║         SynCam V2 - Desktop            ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║  Servidor activo en puerto: ${PORT}       ║`);
    console.log(`║  IP local para el móvil:               ║`);
    console.log(`║  ➜  ${localIP.padEnd(35)}║`);
    console.log('╠════════════════════════════════════════╣');
    console.log('║  Ingresá esta IP en la app móvil       ║');
    console.log('╚════════════════════════════════════════╝');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Error] El puerto ${PORT} ya está en uso. Cerrá otra instancia de SynCam.`);
    } else {
      console.error('[Signaling] Error del servidor HTTP:', err);
    }
  });
}

// ─── Ventana principal de Electron ────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    backgroundColor: '#0d1117',
    title: 'SynCam V2',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Ciclo de vida de Electron ────────────────────────────────────────────────
app.whenReady().then(() => {
  initSignalingServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
