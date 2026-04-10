# SynCam

> Conecta tu celular como cámara web a tu PC — con WiFi o USB.

## Estructura del Proyecto

```
SynCam/
├── desktop/          # App de escritorio (Electron + Node.js)
│   ├── src/
│   └── package.json
└── mobile/           # App móvil (React Native + Expo)
    ├── src/
    └── package.json
```

## Características
- 📷 Streaming de cámara en tiempo real
- 🔄 Rotación de cámara (0°, 90°, 180°, 270°)
- 🪞 Espejo horizontal/vertical
- 📸 Cambio rápido frontal ↔ trasera
- 🔦 Control de linterna
- 🎛️ Control de calidad y FPS
- 📡 Conexión WiFi y USB (ADB)
- 🖥️ Cámara virtual para Zoom, OBS, etc.

## Inicio Rápido

### App Desktop
```bash
cd desktop
npm install
npm start
```

### App Móvil
```bash
cd mobile
npm install
npx expo start
```
