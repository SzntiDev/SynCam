<h1 align="center">
  <br>
  SynCam <span style="font-size: 0.5em; vertical-align: middle; color: var(--primary);">V2</span>
  <br>
</h1>

<h4 align="center">Puente de alto rendimiento basado en WebRTC para convertir tu smartphone en una webcam profesional para PC.</h4>

<p align="center">
  <em>Leer en otros idiomas: <a href="README.md">Inglés</a>, <a href="README-es.md">Español</a></em>
</p>

<p align="center">
  <a href="#-características">Características</a> •
  <a href="#-cómo-funciona">Cómo Funciona</a> •
  <a href="#-instalación-y-uso">Instalación y Uso</a> •
  <a href="#-arquitectura">Arquitectura</a> •
  <a href="#-tecnologías">Tecnologías</a>
</p>

---

> [!IMPORTANT]
> **SynCam V2** ha reemplazado oficialmente a la versión antigua basada en WebSockets. Ahora utiliza **WebRTC** —el estándar de la industria para comunicaciones en tiempo real— para ofrecer latencia ultra baja, audio sincronizado y streaming robusto punto a punto (P2P).

**SynCam** es una herramienta de sincronización de grado profesional que cierra la brecha entre las cámaras de alta calidad de los smartphones y los entornos de escritorio. Al utilizar **Electron** para el lado del escritorio y un enfoque **WebRTC Nativo** en el móvil, ofrece un flujo de video suave con menos de 150ms de latencia, integrable en cualquier flujo de trabajo de producción.

El proyecto se centra en la **Excelencia de Rendimiento** y la **Profundidad Técnica**, implementando un servidor de señalización personalizado en Socket.io y codificación H.264/VP8 acelerada por hardware para una transmisión de imagen cristalina.

---

## ✨ Características

- 🎥 **Streaming WebRTC**: Evolución de JPEG binario a un pipeline completo de WebRTC, habilitando codificación y decodificación de video en tiempo real (H.264/VP8).
- ⚡ **Latencia Ultra Baja**: Logra un retraso inferior a los **150ms** mediante el uso de conexiones P2P basadas en UDP, haciéndolo viable para conferencias en vivo y streaming.
- 🎤 **Audio Sincronizado**: Soporte nativo para pistas de audio **Opus**, asegurando que tu voz esté perfectamente sincronizada con la imagen.
- 🏢 **Stack Tecnológico Profesional**: Escritorio potenciado por **Vite + React + TypeScript** y móvil basado en **Expo Bare Workflow** con módulos nativos.
- 📱 **Captura Nativa**: Accede directamente a los buffers de hardware de la cámara en Android, evitando el overhead de las capturas basadas en navegadores (WebView).
- 🌓 **Premium Dark Mode**: Interfaz dinámica que se adapta a las preferencias del sistema, construida con un diseño moderno estilo Glassmorphism.

---

## 🚀 Cómo Funciona

SynCam V2 gestiona un canal de comunicación P2P de vanguardia entre el móvil y el escritorio:

### 1. Fase de Señalización (Signaling)
Antes de iniciar el video, las apps móvil y de escritorio se "encuentran" a través de un servidor **Socket.io** integrado en la PC. Intercambian registros SDP (Session Description Protocol) y candidatos ICE para trazar la mejor ruta de red.

### 2. Pipeline de Video P2P
Una vez completado el saludo inicial (handshake), los datos de video omiten el servidor por completo. Fluyen directamente del smartphone a la PC usando una conexión de igual a igual, optimizada para minimizar el jitter y maximizar el rendimiento.

### 3. Aceleración por Hardware
La app móvil aprovecha los codificadores nativos para comprimir el flujo de la cámara eficientemente, mientras que la aplicación Electron utiliza decodificación acelerada por GPU para renderizar el stream en un elemento `<video>` de alto rendimiento.

---

## 💻 Instalación y Uso

### Prerrequisitos
- **Node.js 22+**
- **Android Studio SDK** (para compilación nativa móvil)
- Ambos dispositivos deben estar en la **misma red local**.

### Pasos
1. **Inicio en Escritorio**:
   Navega a `/desktop` y ejecuta:
   ```bash
   npm install
   npm run dev
   ```
   Toma nota de la IP Local que aparece en la terminal.

2. **Inicio en Móvil**:
   Navega a `/mobile` y ejecuta:
   ```bash
   npm install
   npx expo run:android
   ```
   Ingresa la IP de la PC en la app y presiona **START STREAMING**.

---

## 🏗️ Arquitectura

```text
SynCam/
├── desktop/             # Vite + React + Electron + Socket.io (Signaling)
│   ├── src/             # Código fuente en TypeScript
│   └── main.cjs         # Proceso principal de Electron
├── mobile/              # React Native / Expo Bare Workflow
│   └── App.js           # Implementación nativa de WebRTC
├── start-desktop.bat    # Inicio rápido para PC
├── start-mobile.bat     # Inicio rápido para Móvil
├── arquitectura.md      # Desglose técnico detallado
└── README-es.md         # Estás aquí
```

---

## ⚙️ Tecnologías

- **[WebRTC](https://webrtc.org/)** para el motor de medios de baja latencia.
- **[React](https://react.dev/)** + **[TypeScript](https://www.typescriptlang.org/)** para una UI robusta y tipado seguro.
- **[Electron](https://www.electronjs.org/)** para el contenedor de escritorio.
- **[Socket.io](https://socket.io/)** para el rack de señalización en tiempo real.
- **[Expo](https://expo.dev/)** para capacidades móviles nativas multiplataforma.

---
> Proyecto evolucionado para la excelencia técnica y capacidades de streaming profesional.
