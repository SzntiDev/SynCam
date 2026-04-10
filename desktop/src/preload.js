const { contextBridge, ipcRenderer } = require('electron');

// Prevent listener accumulation on window reloads
const channels = ['new-frame', 'new-frame-bin', 'new-audio-chunk', 'client-connected', 'client-disconnected', 'server-started'];
channels.forEach(ch => ipcRenderer.removeAllListeners(ch));

contextBridge.exposeInMainWorld('syncam', {
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
  getConnections: () => ipcRenderer.invoke('get-connections'),

  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close:    () => ipcRenderer.invoke('window-close'),
  openLink: (url) => ipcRenderer.invoke('open-link', url),

  adbCheck:   ()     => ipcRenderer.invoke('adb-check'),
  adbReverse: (port) => ipcRenderer.invoke('adb-reverse', port),
  adbDevices: ()     => ipcRenderer.invoke('adb-devices'),

  disconnectAll: ()          => ipcRenderer.invoke('disconnect-all'),
  obsLink:       (pwd, port) => ipcRenderer.invoke('obs-link', pwd, port),
  setQuality:    (q)         => ipcRenderer.invoke('set-quality', q),

  // 📺 Virtual Camera (Hito 3)
  vcamStatus: ()      => ipcRenderer.invoke('vcam-status'),
  vcamCheck:  ()      => ipcRenderer.invoke('vcam-check'),
  vcamStart:  (opts)  => ipcRenderer.invoke('vcam-start', opts),
  vcamStop:   ()      => ipcRenderer.invoke('vcam-stop'),

  onFrame:              (cb) => ipcRenderer.on('new-frame',        (_, d) => cb(d)),
  onFrameBin:           (cb) => ipcRenderer.on('new-frame-bin',    (_, d) => cb(d)),
  // 🎤 AUDIO: Recibe chunks PCM16 desde el proceso principal
  onAudioChunk:         (cb) => ipcRenderer.on('new-audio-chunk',  (_, d) => cb(d)),
  onClientConnected:    (cb) => ipcRenderer.on('client-connected',    (_, d) => cb(d)),
  onClientDisconnected: (cb) => ipcRenderer.on('client-disconnected', (_, d) => cb(d)),
  onServerStarted:      (cb) => ipcRenderer.on('server-started',      (_, d) => cb(d)),

  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
