const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

let mainWindow;

// Inicializa el Signal Server para WebRTC
function initSignalingServer() {
  const server = http.createServer();
  const io = new Server(server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    console.log('[Signaling] Nuevo cliente conectado:', socket.id);

    // Relay simple de mensajes (Offer, Answer, ICE)
    socket.on('webrtc-message', (data) => {
      // Reenvía a todos menos al emisor
      socket.broadcast.emit('webrtc-message', data);
    });

    socket.on('disconnect', () => {
      console.log('[Signaling] Cliente desconectado:', socket.id);
    });
  });

  server.listen(8080, () => {
    console.log('[Signaling] Escuchando en el puerto 8080');
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    backgroundColor: '#0d1117',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

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
