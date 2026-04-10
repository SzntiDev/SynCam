<h1 align="center">
  <br>
  SynCam <span style="font-size: 0.5em; vertical-align: middle; color: var(--primary);">V2</span>
  <br>
</h1>

<h4 align="center">A high-performance WebRTC bridge to turn your smartphone into a professional PC webcam.</h4>

<p align="center">
  <em>Read this in other languages: <a href="README.md">English</a>, <a href="README-es.md">Español</a></em>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-installation--usage">Installation & Usage</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-tech-stack">Tech Stack</a>
</p>

---

> [!IMPORTANT]
> **SynCam V2** has officially replaced the legacy WebSocket version. It now utilizes **WebRTC**—the industry standard for real-time communication—to deliver ultra-low latency, synchronized audio, and robust P2P streaming.

**SynCam** is a professional-grade synchronization tool that bridges the gap between high-quality smartphone cameras and desktop environments. By utilizing **Electron** for the desktop side and a specialized **Native WebRTC** approach on mobile, it delivers a smooth, sub-150ms video feed that can be integrated into any production workflow.

The project focuses on **Performance Excellence** and **Technical Depth**, implementing a custom Socket.io signaling server and hardware-accelerated H.264/VP8 encoding for crystal-clear image transmission.

---

## ✨ Features

- 🎥 **WebRTC Streaming**: Upgraded from JPEG-binary to a full WebRTC pipeline, enabling real-time video encoding (H.264/VP8) and decoding.
- ⚡ **Ultra-Low Latency**: Achieves sub-**150ms** lag by using UDP-based P2P connections, making it viable for live conferencing and streaming.
- 🎤 **Synchronized Audio**: Native support for **Opus** audio tracks, ensuring your voice is perfectly in sync with the video feed.
- 🏢 **Professional Tech Stack**: Desktop powered by **Vite + React + TypeScript** and Mobile powered by **Expo Bare Workflow** with native modules.
- 📱 **Native Capture**: Directly accesses the camera's hardware buffers on Android, bypassing the overhead of browser-based WebViews.
- 🌓 **Premium Dark Mode**: Dynamic interface that adapts to system preferences, built with a modern Glassmorphism design.

---

## 🚀 How It Works

SynCam V2 manages a state-of-the-art P2P communication channel between mobile and desktop:

### 1. The Signaling Phase
Before the video starts, the mobile and desktop apps "meet" via a built-in **Socket.io** server running on the PC. They exchange SDP (Session Description Protocol) records and ICE candidates to map out the best network route.

### 2. P2P Video Pipeline
Once the handshake is complete, video data bypasses the server entirely. It flows directly from the smartphone to the PC using a peer-to-peer connection, optimized for minimal jitter and maximum throughput.

### 3. Hardware Acceleration
The mobile app leverages native encoders to compress the raw camera feed efficiently, while the Electron application utilizes GPU-accelerated decoding to render the incoming stream in a high-performance `<video>` element.

---

## 💻 Installation & Usage

### Prerequisites
- **Node.js 22+**
- **Android Studio SDK** (for native mobile compilation)
- Both devices must be on the **same local network**.

### Steps
1. **Desktop Launch**:
   Navigate to `/desktop` and run:
   ```bash
   npm install
   npm run dev
   ```
   Take note of the Local IP displayed in the terminal.

2. **Mobile Launch**:
   Navigate to `/mobile` and run:
   ```bash
   npm install
   npx expo run:android
   ```
   Enter the PC IP in the app and press **START STREAMING**.

---

## 🏗️ Architecture

```text
SynCam/
├── desktop/             # Vite + React + Electron + Socket.io (Signaling)
│   ├── src/             # TypeScript source code
│   └── main.cjs         # Electron main process
├── mobile/              # React Native / Expo Bare Workflow
│   └── App.js           # Native WebRTC implementation
├── start-desktop.bat    # Quick-launch for PC
├── start-mobile.bat     # Quick-launch for Mobile
├── arquitectura.md      # Detailed technical breakdown
└── README.md            # You are here
```

---

## ⚙️ Tech Stack

- **[WebRTC](https://webrtc.org/)** for the low-latency media engine.
- **[React](https://react.dev/)** + **[TypeScript](https://www.typescriptlang.org/)** for a robust and type-safe UI.
- **[Electron](https://www.electronjs.org/)** for the core desktop container.
- **[Socket.io](https://socket.io/)** for the real-time signaling backbone.
- **[Expo](https://expo.dev/)** for cross-platform native mobile capabilities.

---
> Project evolved for technical excellence and professional streaming capabilities.
