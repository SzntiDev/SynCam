# 🚀 Informe de Estado del Proyecto: SynCam

SynCam es una solución de alto rendimiento para convertir dispositivos móviles en cámaras web profesionales para PC, optimizada para baja latencia y alta fidelidad visual.

## 📋 Resumen del Proyecto
El sistema se divide en dos componentes principales:
1.  **Móvil (React Native + Expo):** Captura video mediante un `WebView` especializado para evadir cuellos de botella de hardware y transmite datos en formato binario puro.
2.  **Escritorio (Electron + Node.js):** Actúa como servidor central, procesando el flujo de video y permitiendo su integración directa en herramientas de streaming como OBS o su visualización local.

---

## 🛠️ Arquitectura Técnica de Vanguardia

### 🏎️ Protocolo de Transmisión "SY"
Para maximizar los FPS (hasta 60fps) y minimizar el lag, el proyecto utiliza un protocolo binario propietario:
-   **Encabezado (8 bytes):** `[S, Y, Rotación, Espejo, Longitud(x4)]`
-   **Cuerpo:** Datos de imagen JPEG sin procesar.
Esto evita el costo computacional de la codificación/decodificación Base64 y reduce el uso de ancho de banda.

### 🔌 Conectividad Inteligente
-   **Dual-Path:** Soporta tanto **WiFi** (vía WebSockets) como **USB** (vía túnel ADB).
-   **Zero-Config USB:** La app de escritorio detecta el dispositivo y configura automáticamente el túnel `adb reverse`, permitiendo una conexión instantánea sin configurar IPs.
-   **Emparejamiento QR:** Los usuarios pueden escanear un código generado por el PC para conectar instantáneamente por WiFi.

---

## ✅ Estado Actual (Hitos Alcanzados)

| Característica | Estado | Detalle |
| :--- | :--- | :--- |
| **Streaming de Video** | ✅ Completado | Rendimiento estable a 1080p/60fps. |
| **Control de Cámara** | ✅ Completado | Cambio de cámara (frontal/trasera), flash y rotación 360°. |
| **Integración con OBS** | ✅ Completado | Puente automático vía Browser Source y API de OBS. |
| **Conexión USB** | ✅ Completado | Binario ADB integrado y automatización de puertos. |
| **Filtros de Imagen** | ✅ Completado | Brillo, contraste, saturación y nitidez en tiempo real. |

---

## 🚧 Cosas por Agregar (Hoja de Ruta)

### 1. 🎤 Transmisión de Audio (Próxima prioridad)
Actualmente, solo se transmite video.
-   **Plan:** Capturar audio PCM en el móvil y transmitirlo sincronizado con los frames de video.
-   **Objetivo:** Actuar como micrófono inalámbrico.

### 2. 🎥 Driver de Cámara Virtual Nativa
Hoy SynCam se usa en Zoom/Teams a través de "OBS Virtual Camera".
-   **Plan:** Integrar un driver de nivel de sistema (como AkVirtualCamera) para que SynCam aparezca directamente como una cámara seleccionable en Windows.

### 3. 🔋 Gestión Energética y Segundo Plano
-   **Plan:** Implementar un **Foreground Service** en Android para que la transmisión no se corte si el usuario cambia de app o bloquea el teléfono. 
-   **Modo Ahorro:** Opción de apagar la pantalla del móvil manteniendo la captura activa para evitar sobrecalentamiento.

### 4. 📦 Empaquetado y Distribución
-   **Escritorio:** Generar instalador `.exe` firmado con `electron-builder`.
-   **Móvil:** Generar `.apk` final optimizado (eliminando la dependencia de Expo Go).

---

## 📊 Conclusión
El proyecto está en un estado **funcional y de alto rendimiento**. La base tecnológica (transmisión binaria y túneles USB) es sólida y supera la estabilidad de muchas soluciones comerciales gratuitas. El siguiente gran salto es la **independencia de OBS** mediante el driver de cámara virtual y la **transmisión de audio**.

---
*Ultima actualización: 06 de Abril, 2026*
