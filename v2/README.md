# SynCam V2 - Experimental (WebRTC + Native)

Esta es la nueva arquitectura de SynCam, diseñada para baja latencia extrema, audio sincronizado y escalabilidad hacia drivers nativos.

## 🚀 Diferencias Clave (vs V1/Legacy)
| Característica | Legacy (V1) | SynCam V2 |
| :--- | :--- | :--- |
| **Protocolo** | WebSocket + JPEG Binario | **WebRTC (H.264/VP8)** |
| **Captura** | WebView (React Native) | **Cámara Nativa Directa** |
| **Latencia** | Variable (200-500ms) | **Ultra Baja (<150ms)** |
| **Audio** | No disponible | **Sincronizado (Opus)** |
| **Estabilidad** | Sensible a red/CPU | **Robusta (P2P Directo)** |

## 🛠️ Requisitos
1. **Node.js 22+**
2. **Android Studio SDK** (para compilar la app móvil nativa).
3. **Mismo WiFi**: El PC y el Celular deben estar en la misma red local.

## 💻 Ejecución: Escritorio (Desktop)
1. Entra a `v2/desktop`.
2. Ejecuta `npm install` (si no se hizo).
3. Ejecuta `npm run dev`.
   - Esto levantará el servidor de Señalización (puerto 8080) y la App de Electron.
   - Verás la IP de tu computadora en el terminal o puedes buscarla con `ipconfig`.

## 📱 Ejecución: Móvil (Mobile)
1. Entra a `v2/mobile`.
2. Ejecuta `npm install`.
3. Ejecuta `npx expo run:android`.
   - **Nota:** Esto compilará una versión de desarrollo nativa. No funciona con la app estándar de "Expo Go" de la Play Store porque requiere módulos de WebRTC nativos.
4. Una vez abierta la app en el celular, ingresa la **IP de tu PC** y presiona **START STREAMING**.

## 🏗️ Estado de la Carpeta
- `desktop/`: Pila Vite + React + Electron + Socket.io (Signaling).
- `mobile/`: App Expo Bare Workflow con `react-native-webrtc`.
