<h1 align="center">
  <br>
  SynCam
  <br>
</h1>

<h4 align="center">Puente de alto rendimiento para convertir tu smartphone en una webcam profesional para PC.</h4>

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

> [!NOTE]
> **SynCam** está diseñado para superar los problemas comunes de latencia y fiabilidad en las apps de webcam móvil mediante el uso de un flujo WebSocket personalizado y tecnologías nativas de captura WebView.

**SynCam** es una herramienta de sincronización de grado profesional que cierra la brecha entre las cámaras de alta calidad de los smartphones y los entornos de escritorio. Al utilizar **Electron** para el lado del PC y un enfoque especializado de **WebView/MediaStream** en el móvil, ofrece un flujo de vídeo suave y de baja latencia que puede integrarse en cualquier flujo de trabajo de producción.

El proyecto se centra en la **Estabilidad de Conexión** y una **UX sin configuración**, implementando túneles de red automáticos vía ADB (para USB) y payloads de WebSocket de alta carga para una transmisión de imagen cristalina.

---

## ✨ Características

- 🎥 **Captura de Alta Fidelidad**: Migración de la captura estándar de la API a un enfoque de **WebView Nativo (getUserMedia)**, estabilizando los frames y resolviendo problemas de paridad.
- ⚡ **Latencia Ultra Baja**: Implementación personalizada de WebSocket con un **maxPayload de 50MB** y un sistema de `heartbeat` dedicado para evitar caídas de red en sesiones largas.
- 🔌 **Plug & Play (USB/ADB)**: Integración de **Android Platform Tools** (ADB) para permitir el redireccionamiento automático de puertos, habilitando transferencias de datos de alta velocidad por cable USB.
- 🛡️ **Bypass de Seguridad**: Implementaciones a medida para permitir el acceso a la cámara restringido por HTTPS en entornos de red local.
- 🖥️ **Renderizado Fluido en Escritorio**: Utiliza `requestAnimationFrame` en el lado de Electron para sincronizar los frames con la tasa de refresco del monitor, eliminando parpadeos.
- 🧪 **Driver del Futuro**: Construido con una hoja de ruta para un **Driver de Cámara Virtual**, con el objetivo de lograr una integración nativa con Zoom, OBS y Teams.

---

## 🚀 Cómo Funciona

SynCam gestiona un flujo binario complejo entre dos entornos distintos:

### 1. Motor de Captura Móvil
La aplicación móvil abre un **WebView** oculto que accede a la cámara del dispositivo a través de **MediaDevices**. Esto permite que la app aproveche la aceleración de hardware nativa y la codificación de vídeo optimizada antes de enviar los frames al escritorio.

### 2. El Túnel WebSocket
Los datos se transmiten usando un servidor WebSocket personalizado alojado en el PC. El sistema maneja fragmentos de imagen binarios, optimizando el uso de memoria y asegurando que el frame más reciente siempre tenga prioridad sobre los datos antiguos en cola.

### 3. Procesamiento en Escritorio
La aplicación Electron recibe el flujo, procesa los datos binarios en un elemento canvas y utiliza renderizado acelerado por hardware para mantener un flujo estable de 30/60 FPS dependiendo de la capacidad del hardware.

---

## 💻 Instalación y Uso

### Prerrequisitos
- Móvil: Dispositivo Android (soporte iOS en progreso).
- PC: Entorno Windows (x64).

### Pasos
1. **Lanzamiento en Escritorio**:
   Descarga y abre `SynCam.bat` o navega a `/desktop` y ejecuta:
   ```bash
   npm install
   npm run start
   ```
2. **Conexión Móvil**:
   Abre la app móvil e ingresa la dirección IP que aparece en la pantalla de tu PC o conecta vía USB para la detección automática por ADB.

---

## 🏗️ Arquitectura

```text
SynCam/
├── desktop/             # Cliente de escritorio basado en Electron
│   ├── bin/             # Herramientas binarias de ADB y FFmpeg
│   └── src/             # Proceso principal y renderizador de UI
├── mobile/              # Cliente móvil React Native / Expo
│   └── android/         # Módulos nativos de Android
├── v2/                  # Arquitectura modular de próxima generación (WIP)
├── Fix-Firewall.bat     # Utilidad para limpiar bloqueos de red
└── README-es.md         # Estás aquí
```

---

## ⚙️ Tecnologías

- **[Electron](https://www.electronjs.org/)** para la aplicación central de escritorio.
- **[Node.js](https://nodejs.org/)** para el servidor WebSocket interno y manejo de medios.
- **[React Native / Expo](https://expo.dev/)** para la interfaz móvil y el puente nativo.
- **[ADB (Android Debug Bridge)](https://developer.android.com/tools/adb)** para túneles USB de alta velocidad.

---
> Proyecto enfocado en la sincronización de medios a alta velocidad y comunicación de hardware de bajo nivel.
