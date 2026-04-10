<h1 align="center">
  <br>
  SynCam
  <br>
</h1>

<h4 align="center">High-performance bridge to turn your smartphone into a professional PC webcam.</h4>

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

> [!NOTE]
> **SynCam** is designed to overcome common latency and reliability issues in mobile webcam apps by using a custom WebSocket stream and native WebView capture technologies.

**SynCam** is a professional-grade synchronization tool that bridges the gap between high-quality smartphone cameras and desktop environments. By utilizing **Electron** for the desktop side and a specialized **WebView/MediaStream** approach on mobile, it delivers a smooth, low-latency video feed that can be integrated into any production workflow.

The project focuses on **Connectivity Stability** and **Zero-Config UX**, implementing automatic network tunneling via ADB (for USB) and high-load WebSocket payloads for crystal-clear image transmission.

---

## ✨ Features

- 🎥 **High-Fidelity Capture**: Switched from standard API capture to a **Native WebView (getUserMedia)** approach, stabilizing framerates and resolving parity issues.
- ⚡ **Ultra-Low Latency**: Custom WebSocket implementation with a **50MB maxPayload** and a dedicated `heartbeat` system to prevent network drops during long sessions.
- 🔌 **Plug & Play (USB/ADB)**: Integrated **Android Platform Tools** (ADB) to allow automatic port reversing, enabling high-speed data transfer through USB cables.
- 🛡️ **Bypass Security**: Custom implementations to allow HTTPS-restricted camera access on local network environments.
- 🖥️ **Smooth Desktop Rendering**: Uses `requestAnimationFrame` on the desktop side to sync frames with the monitor's refresh rate, eliminating flickering.
- 🧪 **Future-Proof Driver**: Built with a roadmap for a **Virtual Camera Driver**, aiming for native integration with Zoom, OBS, and Teams.

---

## 🚀 How It Works

SynCam manages a complex binary stream between two distinct environments:

### 1. Mobile Capture Engine
The mobile application opens a hidden **WebView** that accesses the device's camera via **MediaDevices**. This allows the app to leverage native hardware acceleration and optimized video encoding before sending frames to the desktop.

### 2. The WebSocket Tunnel
Data is transmitted using a custom WebSocket server hosted on the desktop. The system handles binary image fragments, optimizing memory usage and ensuring that the most recent frame is always prioritized over queued older data.

### 3. Desktop Processing
The Electron application receives the stream, processes the binary data into a canvas element, and utilizes hardware-accelerated rendering to maintain a stable 30/60 FPS feed depending on the hardware capabilities.

---

## 💻 Installation & Usage

### Prerequisites
- For Mobile: Android device (iOS support in progress).
- For Desktop: Windows (x64) environment.

### Steps
1. **Desktop Launch**:
   Download and open the `SynCam.bat` or navigate to `/desktop` and run:
   ```bash
   npm install
   npm run start
   ```
2. **Mobile Connection**:
   Open the mobile app and enter the IP address displayed on your desktop screen or connect via USB for automatic ADB detection.

---

## 🏗️ Architecture

```text
SynCam/
├── desktop/             # Electron-based Desktop Client
│   ├── bin/             # ADB and FFmpeg binary tools
│   └── src/             # Main process and UI renderer
├── mobile/              # React Native / Expo Mobile Client
│   └── android/         # Native Android modules
├── v2/                  # Next-gen modular architecture (WIP)
├── Fix-Firewall.bat     # Utility to clear network blockers
└── README.md            # You are here
```

---

## ⚙️ Tech Stack

- **[Electron](https://www.electronjs.org/)** for the core desktop application.
- **[Node.js](https://nodejs.org/)** for the backend WebSocket server and media handling.
- **[React Native / Expo](https://expo.dev/)** for the mobile interface and native bridging.
- **[ADB (Android Debug Bridge)](https://developer.android.com/tools/adb)** for high-speed USB tunneling.

---
> Project focused on high-speed media synchronization and low-level hardware communication.
