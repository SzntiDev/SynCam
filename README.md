# SynCam

A cross-platform synchronization and camera management ecosystem designed for real-time interaction between desktop and mobile devices.

## Description
SynCam is a modern solution for unified camera control and media synchronization. It consists of a high-performance desktop application and a versatile mobile app, allowing users to bridge their devices seamlessly. Whether for security, remote monitoring, or creative workflows, SynCam provides a robust framework for real-time data and video streaming.

## Detailed Overview
This project addresses the need for efficient cross-device communication. The desktop component is built using Vite and React (potentially wrapped in Electron), offering a smooth and responsive management interface. The mobile component, developed with React Native and Expo, allows for portable camera access and remote control features. Together, they form a synchronized network that simplifies device management.

## Features
- Real-time video streaming between mobile and desktop
- Bi-directional device control and commands
- Cross-platform synchronization for media assets
- Secure and low-latency communication protocol
- Modular architecture with dedicated `desktop` and `mobile` directories
- Built-in status monitoring and project tracking (`ESTADO_DEL_PROYECTO.md`)

## Technologies Used
- Desktop: React, Vite, CSS (Potential Electron integration)
- Mobile: React Native, Expo
- Networking: WebSockets (Standard for real-time sync)
- Build Tools: package-lock.json and npm project management

## Installation Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com/SzntiDev/SynCam.git
   ```
2. Navigate to the project directory:
   ```bash
   cd SynCam
   ```
3. To set up the desktop app:
   ```bash
   cd desktop
   ```
   ```bash
   npm install
   ```
   ```bash
   npm run dev
   ```
4. To set up the mobile app:
   ```bash
   cd ../mobile
   ```
   ```bash
   npm install
   ```
   ```bash
   npx expo start
   ```

## Usage Examples
To start the entire SynCam ecosystem:
1. Run `start-desktop.bat` to launch the management interface.
2. Run `start-mobile.bat` to initialize the Expo mobile client.
3. Follow the instructions on the desktop app to pair with your mobile device.

## Project Structure
- `desktop/`: Source code for the desktop management interface.
- `mobile/`: Source code for the Expo/React Native mobile application.
- `arquitectura.md`: Detailed documentation on the project's technical structure.
- `ESTADO_DEL_PROYECTO.md`: Real-time tracking of features and bugs.
- `TODO.md`: Roadmap and pending tasks.
- `start-desktop.bat` & `start-mobile.bat`: Convenience launchers for Windows.

## Configuration
Network configurations and API endpoints can be set in the respective `.env` files within the `desktop` and `mobile` directories.

## API Documentation
Refer to `explicacion_codigo.md` for an in-depth look at the communication protocol and internal APIs.

## Screenshots or Examples
*(Placeholders for future UI screenshots)*

## Roadmap / Future Improvements
- Multi-camera simultaneous support
- Cloud storage integration for recorded media
- Advanced motion detection and alerts
- WebRTC integration for direct peer-to-peer streaming

## Contributing Guidelines
Contributions are welcome! Please refer to the `TODO.md` for ideas on where to help out. Pull requests should follow the established architecture.

## License
MIT License

---

# SynCam (Español)

Un ecosistema de sincronización y gestión de cámaras multiplataforma diseñado para la interacción en tiempo real entre dispositivos de escritorio y móviles.

## Descripción
SynCam es una solución moderna para el control unificado de cámaras y la sincronización de medios. Consta de una aplicación de escritorio de alto rendimiento y una aplicación móvil versátil, lo que permite a los usuarios conectar sus dispositivos sin problemas. Ya sea para seguridad, monitoreo remoto o flujos de trabajo creativos.

## Resumen Detallado
Este proyecto aborda la necesidad de una comunicación eficiente entre dispositivos. El componente de escritorio está construido con Vite y React, ofreciendo una interfaz de gestión fluida. El componente móvil, desarrollado con React Native y Expo, permite el acceso portátil a la cámara y funciones de control remoto.

## Características
- Transmisión de video en tiempo real entre móvil y escritorio
- Control de dispositivos y comandos bidireccionales
- Sincronización multiplataforma para activos de medios
- Protocolo de comunicación seguro y de baja latencia
- Arquitectura modular con directorios dedicados
- Seguimiento de estado y tareas integrado

## Tecnologías Utilizadas
- Escritorio: React, Vite, CSS
- Móvil: React Native, Expo
- Redes: WebSockets

## Instrucciones de Instalación
1. Clonar el repositorio:
   ```bash
   git clone https://github.com/SzntiDev/SynCam.git
   ```
2. Navegar al directorio `SynCam`.
3. Para configurar el escritorio:
   ```bash
   cd desktop
   ```
   ```bash
   npm install
   ```
4. Para configurar el móvil:
   ```bash
   cd ../mobile
   ```
   ```bash
   npm install
   ```

## Estructura del Proyecto
- `desktop/`: Interfaz de gestión de escritorio.
- `mobile/`: Aplicación móvil Expo.
- `arquitectura.md`: Documentación técnica de la estructura.

## Guía para Contribuir
¡Las contribuciones son bienvenidas! Revisa `TODO.md` para ver tareas pendientes.

## Licencia
Licencia MIT
