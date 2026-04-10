# Explicación del Código - SynCam V2

Este documento detalla el funcionamiento de los archivos clave del proyecto.

## Carpeta: `desktop/` (Aplicación de Escritorio)

### 1. `main.cjs` (Proceso Principal de Electron)
Es el "cerebro" en la PC. Responsable de:
*   **Signaling Server:** Inicia un servidor HTTP en el puerto `8080` usando `socket.io`. Escucha mensajes `webrtc-message` y los reenvía (broadcast) para conectar el móvil con la interfaz de React.
*   **Ventana:** Crea la ventana principal de Electron con configuraciones de seguridad que permiten la integración de Node.js.

### 2. `src/App.tsx` (Interfaz de Usuario y Receptor WebRTC)
Contiene la lógica de visualización del video:
*   **`useEffect`:** Se conecta al servidor de señalización local al iniciar.
*   **`webrtc-message` listener:** Recibe las ofertas (`offer`) del móvil, genera una respuesta (`answer`) y gestiona los candidatos de red (`ICE candidates`).
*   **`initPeerConnection`:** Configura el objeto `RTCPeerConnection` con servidores STUN de Google para atravesar firewalls.
*   **`pc.ontrack`:** Se activa cuando el video del móvil llega. Asigna ese flujo (stream) al elemento `<video>` de la interfaz.

### 3. `vite.config.ts` y `package.json`
*   Configuran el entorno de desarrollo rápido con **Vite** y definen cómo se compila la aplicación para producción.

---

## Carpeta: `mobile/` (Aplicación Móvil)

### 1. `App.js` (Componente Principal)
Controla toda la lógica del celular:
*   **`startLocalStream`:** Solicita permisos de cámara y micrófono. Obtiene el flujo de video en resolución 720p/1080p.
*   **`connectToDesktop`:** Se conecta a la IP del PC ingresada por el usuario a través del puerto `8080`.
*   **`startWebRTC`:**
    *   Crea la conexión `RTCPeerConnection`.
    *   Añade las pistas (tracks) de audio y video de la cámara.
    *   Crea una "Oferta" (offer) y la envía al PC por el socket.
*   **Renderizado:** Usa el componente `<RTCView>` de `react-native-webrtc` para mostrarle al usuario lo que su cámara está captando en tiempo real.

---

## Archivos de Raíz (Automatización)

*   **`start-desktop.bat`:** Script de un solo clic que entra a la carpeta desktop e inicia el servidor de desarrollo y Electron.
*   **`start-mobile.bat`:** Configura las variables de entorno necesarias para Android (JAVA_HOME) e inicia el compilador de Expo para desplegar la app en un dispositivo físico conectado.

---

## Resumen de la Lógica de Señalización

Cuando presionas "START STREAMING" en el celular, ocurre lo siguiente:
1.  **Móvil** genera un ID de sesión (SDP Offer) y lo envía a la PC.
2.  **PC (Main process)** recibe el ID y lo reenvía a la **PC (React App)**.
3.  **React App** acepta la oferta, genera un SDP Answer y lo devuelve al **Móvil**.
4.  Ambos intercambian sus direcciones IP locales/públicas.
5.  ¡Conexión establecida!
