# 🚀 SynCam V2 - High Performance WebCam Ecosystem

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React Native](https://img.shields.io/badge/Mobile-React--Native-blue.svg)](https://reactnative.dev/)
[![Electron](https://img.shields.io/badge/Desktop-Electron-47848F.svg)](https://www.electronjs.org/)
[![WebRTC](https://img.shields.io/badge/Streaming-WebRTC-brightgreen.svg)](https://webrtc.org/)

**SynCam** is a professional-grade solution designed to transform your mobile device into a high-fidelity, low-latency webcam for your PC. Built with cutting-edge technologies like WebRTC and Electron, it offers a seamless bridge between your Android/iOS device and your desktop environment.

---

## 🌟 Key Features

-   **⚡ Low Latency Streaming:** Real-time video transmission using WebRTC (Peer-to-Peer).
-   **🔌 Dual Connectivity:** Support for both **WiFi** (WebSockets signaling) and **USB** (ADB tunneling) for maximum stability.
-   **🎥 Professional Quality:** Optimized for 1080p at 60fps with minimal hardware overhead.
-   **🔄 Remote Control:** Flip cameras, toggle flash, and rotate orientation directly from the mobile or desktop app.
-   **🎨 Real-time Filters:** Adjust brightness, contrast, and saturation on the fly (Desktop).
-   **🔗 OBS Integration:** Built-in bridge for seamless integration with OBS Studio and other streaming software.

---

## 🛠️ Technical Architecture

### 🏎️ Signaling & Transmission
SynCam uses a hybrid signaling approach:
1.  **Signaling Server:** A Node.js/Socket.io server running on the Desktop handles the initial WebRTC handshake (SDP Offer/Answer).
2.  **P2P Stream:** Once the handshake is complete, video data flows directly between devices via WebRTC, bypassing the server for ultra-low latency.
3.  **ADB Tunneling:** For USB mode, SynCam automates `adb reverse` to create a secure tunnel, allowing the mobile app to communicate with the PC as if it were on `localhost`.

### 📂 Project Structure
-   `desktop/`: Electron + React (Vite) application. Acts as the receiver and control center.
-   `mobile/`: React Native (Expo) application. Acts as the high-performance camera source.
-   `scripts/`: Automation scripts for ADB and environment setup.

---

## 🚀 Getting Started

### Prerequisites
-   **Node.js** (v16 or higher)
-   **ADB Drivers** (for USB mode)
-   **Expo Go** app on your mobile device (for development)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/SzntiDev/SynCam.git
    cd SynCam
    ```

2.  **Setup Desktop:**
    ```bash
    cd desktop
    npm install
    npm run dev
    ```

3.  **Setup Mobile:**
    ```bash
    cd ../mobile
    npm install
    npx expo start
    ```

### Usage
-   **WiFi Mode:** Ensure both devices are on the same network. Enter the PC's IP in the mobile app.
-   **USB Mode:** Connect via USB and run `start-mobile.bat`. Select "Option 1" to start the ADB tunnel.

---

## 🇪🇸 SynCam V2 (Español)

**SynCam** es una solución de nivel profesional diseñada para transformar tu dispositivo móvil en una cámara web de alta fidelidad y baja latencia para tu PC.

### Características Principales
-   **Transmisión Ultra Rápida:** Video en tiempo real mediante WebRTC.
-   **Conexión Dual:** Soporte para WiFi y USB (vía ADB).
-   **Calidad Profesional:** Optimizado para 1080p/60fps.
-   **Control Remoto:** Cambia de cámara o enciende el flash desde el PC.

### Arquitectura Técnica
El sistema utiliza un servidor de señalización basado en **Socket.io** para establecer la conexión WebRTC. En modo USB, se utiliza **ADB Reverse** para garantizar una conexión estable y sin interferencias de red.

---

## 🗺️ Roadmap
-   [ ] **Wireless Audio:** Stream mobile mic audio to PC.
-   [ ] **Virtual Camera Driver:** Direct system-level webcam integration (no OBS needed).
-   [ ] **Background Service:** Keep streaming even when the mobile screen is off.
-   [ ] **Multi-Camera Support:** Connect multiple devices simultaneously.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Developed with ❤️ by [SzntiDev](https://github.com/SzntiDev)*

