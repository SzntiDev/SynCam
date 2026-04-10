'use strict';

/**
 * SynCam Virtual Camera Engine (Hito 3)
 * 
 * Estrategia en dos capas:
 * 
 * CAPA 1 - MJPEG Stream Server:
 *   Expone /stream.mjpeg — un stream HTTP multipart que cualquier app
 *   que soporte cámaras IP puede consumir (OBS, VLC, ManyCam, XSplit, etc.)
 *   NO requiere driver alguno.
 * 
 * CAPA 2 - ffmpeg Virtual Camera Bridge:
 *   Detecta drivers de cámara virtual instalados (OBS Virtual Camera o Unity Capture).
 *   Si hay uno disponible, lanza ffmpeg que lee el MJPEG local y lo vuelca en el
 *   dispositivo DirectShow — apareciendo como cámara real en Zoom/Teams/Meet.
 *   Requiere ffmpeg y al menos un driver de cámara virtual instalado.
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const os   = require('os');

// ── Estado del módulo ─────────────────────────────────────────
let ffmpegProcess   = null;   // Proceso ffmpeg activo
let mjpegClients    = new Set(); // Clientes HTTP conectados al MJPEG stream
let lastFrameBuffer = null;   // Último frame JPEG recibido (Buffer)
let isVcamActive    = false;  // Estado del bridge ffmpeg→VirtualCam
let _serverPort     = 8080;   // Puerto del servidor SynCam

const MJPEG_BOUNDARY = '--syncam_mjpeg_boundary';

// Nombres de dispositivos DirectShow conocidos por driver
const VCAM_DEVICE_NAMES = [
  'Unity Video Capture',
  'OBS Virtual Camera',
  'AkVCam',
  'SplitCam Video Driver',
  'ManyCam Virtual Webcam',
];

// ── API Pública ────────────────────────────────────────────────

/**
 * Registra el endpoint /stream.mjpeg en la aplicación Express.
 * @param {Express} expressApp
 * @param {number}  port
 */
function registerMjpegEndpoint(expressApp, port) {
  _serverPort = port;

  expressApp.get('/stream.mjpeg', (req, res) => {
    res.writeHead(200, {
      'Content-Type':  `multipart/x-mixed-replace; boundary="${MJPEG_BOUNDARY}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma':        'no-cache',
      'Connection':    'close',
      'Access-Control-Allow-Origin': '*',
    });

    // Enviar frame inicial si ya hay uno en buffer
    if (lastFrameBuffer) {
      sendMjpegFrame(res, lastFrameBuffer);
    }

    mjpegClients.add(res);
    console.log(`[VCam] Cliente MJPEG conectado. Total: ${mjpegClients.size}`);

    req.on('close', () => {
      mjpegClients.delete(res);
      console.log(`[VCam] Cliente MJPEG desconectado. Total: ${mjpegClients.size}`);
    });
  });

  // Endpoint de info para el renderer
  expressApp.get('/vcam-info', (_req, res) => {
    res.json({
      mjpegUrl:  `http://127.0.0.1:${port}/stream.mjpeg`,
      clients:   mjpegClients.size,
      vcamActive: isVcamActive,
      ffmpegPid: ffmpegProcess?.pid || null,
    });
  });

  console.log(`[VCam] MJPEG endpoint registrado → http://127.0.0.1:${port}/stream.mjpeg`);
}

/**
 * Empuja un nuevo frame JPEG a todos los clientes MJPEG conectados.
 * Llamar desde el handler de ws.on('message') en main.js
 * cuando llega un paquete SY (video).
 * @param {Buffer} jpegBuffer - Bytes JPEG crudos (sin header SY)
 */
function pushFrame(jpegBuffer) {
  if (!jpegBuffer || jpegBuffer.length === 0) return;
  lastFrameBuffer = jpegBuffer;

  if (mjpegClients.size === 0) return; // Nadie escucha, evitar trabajo

  mjpegClients.forEach(res => {
    try {
      sendMjpegFrame(res, jpegBuffer);
    } catch (_) {
      mjpegClients.delete(res);
    }
  });
}

function sendMjpegFrame(res, jpegBuffer) {
  const header = Buffer.from(
    `${MJPEG_BOUNDARY}\r\n` +
    `Content-Type: image/jpeg\r\n` +
    `Content-Length: ${jpegBuffer.length}\r\n\r\n`
  );
  res.write(Buffer.concat([header, jpegBuffer, Buffer.from('\r\n')]));
}

// ── Detección de drivers ──────────────────────────────────────

/**
 * Lista los dispositivos DirectShow de video disponibles en Windows usando ffmpeg.
 * @param {string} ffmpegPath - Ruta al ejecutable ffmpeg
 * @returns {Promise<string[]>} - Lista de nombres de dispositivos de cámara
 */
function listDShowDevices(ffmpegPath) {
  return new Promise((resolve) => {
    const cmd = `"${ffmpegPath}" -list_devices true -f dshow -i dummy 2>&1`;
    exec(cmd, { timeout: 8000 }, (_err, stdout, stderr) => {
      const output = stdout + stderr;
      const devices = [];
      const lines = output.split('\n');
      for (const line of lines) {
        // Formato clásico y moderno de ffmpeg:
        // [dshow @ ...] "Device Name" (video) o simplemente captura lo que contenga (video)
        if (line.includes('(video)') || line.includes('video devices')) {
          const match = line.match(/"([^"]+)"\s*(?:\(video\))?/i);
          // Filtrar "Alternative name" manual por las dudas
          if (match && !line.includes('Alternative name')) {
            devices.push(match[1]);
          }
        }
      }
      resolve(devices);
    });
  });
}

/**
 * Detecta el primer driver de cámara virtual instalado.
 * @param {string} ffmpegPath
 * @returns {Promise<string|null>} - Nombre del dispositivo o null
 */
async function detectVirtualCamera(ffmpegPath) {
  try {
    const devices = await listDShowDevices(ffmpegPath);
    console.log('[VCam] Dispositivos DShow encontrados:', devices);

    for (const preferred of VCAM_DEVICE_NAMES) {
      const found = devices.find(d =>
        d.toLowerCase().includes(preferred.toLowerCase())
      );
      if (found) return found;
    }
    return null;
  } catch (e) {
    console.error('[VCam] Error detectando dispositivos:', e.message);
    return null;
  }
}

// ── ffmpeg Bridge ─────────────────────────────────────────────

/**
 * Inicia el bridge ffmpeg que lee el MJPEG local y escribe en la cámara virtual.
 * El resultado: Windows ve "SynCam" como una cámara real.
 * 
 * @param {string} ffmpegPath      - Ruta al binario ffmpeg
 * @param {string} deviceName      - Nombre DirectShow del driver (ej: "OBS Virtual Camera")
 * @param {number} port            - Puerto del servidor MJPEG
 * @param {object} opts            - { width, height, fps }
 * @returns {Promise<{ok: boolean, error?: string, pid?: number}>}
 */
function startVirtualCameraFeed(ffmpegPath, deviceName, port, opts = {}) {
  return new Promise((resolve) => {
    if (ffmpegProcess) {
      stopVirtualCameraFeed();
    }

    const { width = 1280, height = 720, fps = 30 } = opts;
    const mjpegUrl = `http://127.0.0.1:${port}/stream.mjpeg`;

    // ffmpeg: lee MJPEG desde localhost → DirectShow
    const args = [
      '-re',                              // Leer en tiempo real
      '-f',     'mjpeg',
      '-i',     mjpegUrl,                 // Fuente: MJPEG stream local
      '-vf',    `scale=${width}:${height},fps=${fps}`,
      '-pix_fmt', 'yuv420p',              // Formato requerido por la mayoría de drivers
      '-f',     'dshow',
      '-video_size', `${width}x${height}`,
      `video=${deviceName}`,              // Destino: DirectShow virtual cam
    ];

    console.log(`[VCam] Iniciando ffmpeg → "${deviceName}"\n  Args: ffmpeg ${args.join(' ')}`);

    ffmpegProcess = spawn(ffmpegPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        started = true;
        isVcamActive = true;
        resolve({ ok: true, pid: ffmpegProcess?.pid });
      }
    }, 2000);

    ffmpegProcess.stderr.on('data', (chunk) => {
      const line = chunk.toString();
      // ffmpeg escribe su output de progreso en stderr
      if (!started && (line.includes('frame=') || line.includes('Output #0'))) {
        started = true;
        clearTimeout(timeout);
        isVcamActive = true;
        console.log(`[VCam] ✅ Virtual camera activa (PID ${ffmpegProcess?.pid})`);
        resolve({ ok: true, pid: ffmpegProcess?.pid });
      }
    });

    ffmpegProcess.on('error', (err) => {
      clearTimeout(timeout);
      isVcamActive = false;
      ffmpegProcess = null;
      if (!started) {
        started = true;
        resolve({ ok: false, error: "Windows bloqueó ffmpeg: 'dshow' no es un formato de escritura compatible en este SO." });
      }
    });

    ffmpegProcess.on('close', (code) => {
      isVcamActive = false;
      ffmpegProcess = null;
      console.log(`[VCam] ffmpeg terminó (código ${code})`);
      if (!started) {
        started = true;
        resolve({ ok: false, error: "FFmpeg no soportado para salida de Cámara Virtual en Windows." });
      }
    });

    ffmpegProcess.on('close', (code) => {
      isVcamActive = false;
      ffmpegProcess = null;
      console.log(`[VCam] ffmpeg terminó (código ${code})`);
    });
  });
}

/**
 * Detiene el bridge ffmpeg si está activo.
 */
function stopVirtualCameraFeed() {
  if (ffmpegProcess) {
    ffmpegProcess.kill('SIGTERM');
    ffmpegProcess = null;
    isVcamActive = false;
    console.log('[VCam] Virtual camera detenida.');
  }
}

/**
 * Verifica si ffmpeg está disponible en el sistema.
 * @param {string} ffmpegPath
 * @returns {Promise<{available: boolean, version?: string}>}
 */
function checkFfmpeg(ffmpegPath) {
  return new Promise((resolve) => {
    exec(`"${ffmpegPath}" -version 2>&1`, { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve({ available: false });
      const match = stdout.match(/ffmpeg version ([^\s]+)/);
      resolve({ available: true, version: match?.[1] || 'desconocida' });
    });
  });
}

/**
 * Resolución del binario ffmpeg:
 * 1. En el directorio bin/ del proyecto (bundled)
 * 2. En el PATH del sistema
 */
function resolveFfmpegPath(isPackaged, resourcesPath, appDir) {
  if (isPackaged) {
    return path.join(resourcesPath, 'bin', 'ffmpeg.exe');
  }
  return path.join(appDir, '..', 'bin', 'ffmpeg.exe');
}

module.exports = {
  registerMjpegEndpoint,
  pushFrame,
  detectVirtualCamera,
  startVirtualCameraFeed,
  stopVirtualCameraFeed,
  checkFfmpeg,
  resolveFfmpegPath,
  getStatus: () => ({ isVcamActive, mjpegClients: mjpegClients.size, pid: ffmpegProcess?.pid }),
};
