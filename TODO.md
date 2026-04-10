# 📋 Hoja de Ruta Actualizada - SynCam

Esta hoja de ruta refleja el estado actual del proyecto tras la migración exitosa a un sistema de captura basado en **WebView (getUserMedia)**, lo que ha estabilizado la conexión y el framerate.

---

## ✅ Logros Recientes (Completado)
- **Migración a WebView:** Se reemplazó el sistema lento de `takePicture()` por captura nativa de navegador en el móvil.
- **Estabilización de Red:** WebSocket configurado con `maxPayload` de 50MB y sistema de `heartbeat` para evitar desconexiones.
- **Renderizado Fluido:** Uso de `requestAnimationFrame` en el escritorio para una visualización sin parpadeos.
- **Soporte HTTPS/Localhost:** Bypass de seguridad de Android para permitir el uso de la cámara en el WebView.

---

## 🚀 Próximos Pasos Estratégicos

### 1. 🎥 Driver de Cámara Virtual (El "Santo Grial")
*   **Estado:** PENDIENTE.
*   **Objetivo:** Que Windows reconozca a SynCam como una cámara real en Zoom, OBS, Teams, etc.
*   **Tareas:**
    *   [ ] Investigar la integración de **Unity Capture** o **AkVirtualCamera** con Electron.
    *   [ ] Crear un puente (bridge) en C++ o usar un driver existente que reciba el stream de frames desde el proceso de Electron.
    *   [ ] Opción B: Implementar un servidor intermedio que exponga la cámara como una dirección IP compatible con el "Network Camera" de OBS.

### 2. 🔌 Perfeccionamiento de Conexión USB (Plug & Play)
*   **Estado:** EN PROGRESO.
*   **Objetivo:** Cero configuración para el usuario final.
*   **Tareas:**
    *   [ ] **Empaquetado de ADB:** Incluir los binarios oficiales de Android Platform Tools dentro de la carpeta `/bin` del instalador de escritorio.
    *   [ ] **Detección Automática:** Que la app de escritorio detecte cuando se conecta un celular por USB e intente lanzar el comando `adb reverse` de forma invisible.

### 3. 📸 Escáner QR y Emparejamiento Rápido
*   **Estado:** PENDIENTE.
*   **Objetivo:** Conectar por WiFi sin escribir IPs manualmente.
*   **Tareas:**
    *   [ ] Implementar un escáner en la app móvil (usando la misma lógica de WebView o un modal de Expo).
    *   [ ] Hacer que la app de escritorio genere un QR que contenga: `syncam://[IP]:[PUERTO]`.

### 4. 🎤 Transmisión de Audio (Micrófono)
*   **Estado:** PENDIENTE.
*   **Objetivo:** Usar el celular como micrófono inalámbrico.
*   **Tareas:**
    *   [ ] Capturar audio en el móvil usando la API de MediaStream (ya disponible en nuestro WebView).
    *   [ ] Enviar paquetes de audio por el mismo WebSocket.
    *   [ ] En el escritorio, reproducir el audio o (idealmente) enviarlo a un Virtual Audio Cable.

### 5. 🔋 Gestión de Energía y Segundo Plano
*   **Estado:** PENDIENTE.
*   **Objetivo:** Que el stream no se corte al bloquear el teléfono.
*   **Tareas:**
    *   [ ] Implementar **Foreground Service** en Android para evitar que el sistema mate la app.
    *   [ ] Implementar "Modo Ahorro": Apagar la pantalla del móvil (overlay negro) mientras se sigue transmitiendo para evitar sobrecalentamiento.

### 6. 📦 Distribución Final
*   **Estado:** PENDIENTE.
*   **Tareas:**
    *   [ ] Generar instalador `.exe` para Windows usando `electron-builder`.
    *   [ ] Generar archivo `.apk` final para el móvil (eliminando la dependencia de Expo Go).

---
> [!TIP]
> **Siguiente Prioridad Sugerida:** El **Punto 2 (ADB)** es el más sencillo de terminar ahora para mejorar la experiencia de usuario inmediatamente. El **Punto 1 (Virtual Cam)** es el más complejo pero el más importante para la utilidad real de la app.

