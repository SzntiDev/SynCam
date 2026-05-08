import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

function App() {
  const [status, setStatus] = useState('Disconnected');
  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [showOBSPanel, setShowOBSPanel] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const initPeerConnection = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('webrtc-message', {
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        setIsLive(true);
        setStatus('LIVE');
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setStatus('LIVE');
        setIsLive(true);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setStatus('Disconnected');
        setIsLive(false);
      }
    };

    peerConnection.current = pc;
    return pc;
  };

  useEffect(() => {
    const socket = io('http://localhost:8080');
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('Waiting for device...');
    });

    socket.on('webrtc-message', async (data) => {
      if (data.type === 'offer') {
        const pc = initPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-message', { type: 'answer', answer });
        setStatus('Connecting...');
      } else if (data.type === 'candidate') {
        const pc = peerConnection.current;
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.error('Error adding ice candidate', e);
          }
        }
      }
    });

    return () => {
      socket.disconnect();
      if (peerConnection.current) peerConnection.current.close();
    };
  }, []);

  const flipCamera = () => {
    socketRef.current?.emit('control', { action: 'flip-camera' });
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const rotateVideo = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const enterFullscreen = () => {
    videoRef.current?.requestFullscreen();
  };

  // Calculate styles for rotated video
  const isTransposed = rotation === 90 || rotation === 270;
  const videoStyle: React.CSSProperties = {
    transform: `rotate(${rotation}deg)`,
    transition: 'transform 0.35s ease',
    width: isTransposed ? '100vh' : '100%',
    height: isTransposed ? '100vw' : '100%',
    maxWidth: isTransposed ? 'none' : undefined,
  };

  return (
    <div className="container">
      <header>
        <div className="logo-container">
          <div className="logo-icon"></div>
          <h1>SynCam <span className="v2-tag">V2</span></h1>
        </div>
        <div className={`status-badge ${isLive ? 'live' : 'waiting'}`}>
          <div className="dot"></div>
          {status}
        </div>
      </header>

      <main>
        <div className="video-viewport">
          {!isLive && (
            <div className="placeholder">
              <div className="spinner"></div>
              <p>Waiting for mobile stream...</p>
              <span className="hint">Make sure your phone is on the same WiFi or USB tunnel is active</span>
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMuted}
            className={isLive ? 'visible' : ''}
            style={videoStyle}
          />

          {/* Camera controls overlay - visible when live */}
          {isLive && (
            <div className="video-controls-overlay">
              <button className="ctrl-btn" onClick={rotateVideo} title={`Rotar ${rotation}° → ${(rotation+90)%360}°`}>
                🔃
              </button>
              <button className="ctrl-btn" onClick={flipCamera} title="Cambiar cámara frontal/trasera">
                🔄
              </button>
              <button className="ctrl-btn" onClick={toggleMute} title={isMuted ? 'Activar audio' : 'Silenciar'}>
                {isMuted ? '🔇' : '🔊'}
              </button>
              <button className="ctrl-btn" onClick={enterFullscreen} title="Pantalla completa">
                ⛶
              </button>
            </div>
          )}
        </div>

        <div className="controls-panel">
          <div className="stat">
            <span className="label">Protocol</span>
            <span className="value">WebRTC P2P</span>
          </div>
          <div className="stat">
            <span className="label">Resolution</span>
            <span className="value">Auto (1080p Target)</span>
          </div>
          <div className="stat">
            <span className="label">Audio</span>
            <span className="value">{isMuted ? 'Muted' : 'Active'}</span>
          </div>
        </div>

        {/* OBS / Webcam Panel */}
        <div className="obs-section">
          <button
            className={`obs-toggle ${showOBSPanel ? 'active' : ''}`}
            onClick={() => setShowOBSPanel(!showOBSPanel)}
          >
            📹 Usar como Webcam en Meet / Zoom / Teams
            <span className="chevron">{showOBSPanel ? '▲' : '▼'}</span>
          </button>

          {showOBSPanel && (
            <div className="obs-panel">
              <p className="obs-intro">Para usar SynCam como cámara en Google Meet, Zoom o Teams necesitás <strong>OBS Studio</strong> (gratis).</p>

              <div className="obs-steps">
                <div className="obs-step">
                  <span className="step-num">1</span>
                  <div>
                    <strong>Instalar OBS Studio</strong>
                    <p>Descargalo gratis desde <code>obsproject.com</code></p>
                  </div>
                </div>
                <div className="obs-step">
                  <span className="step-num">2</span>
                  <div>
                    <strong>Agregar fuente "Captura de ventana"</strong>
                    <p>En OBS → Sources → + → Window Capture → seleccioná la ventana "desktop"</p>
                  </div>
                </div>
                <div className="obs-step">
                  <span className="step-num">3</span>
                  <div>
                    <strong>Activar OBS Virtual Camera</strong>
                    <p>En OBS → Tools → Virtual Camera → Start</p>
                  </div>
                </div>
                <div className="obs-step">
                  <span className="step-num">4</span>
                  <div>
                    <strong>Seleccionar en Meet / Zoom</strong>
                    <p>En la videollamada → Configuración de cámara → <strong>OBS Virtual Camera</strong></p>
                  </div>
                </div>
              </div>

              <div className="obs-tip">
                💡 <strong>Tip:</strong> Apretá el botón ⛶ (pantalla completa) para que el video de SynCam ocupe toda la pantalla antes de capturarlo con OBS.
              </div>
            </div>
          )}
        </div>
      </main>

      <footer>
        <p>SynCam V2 — Professional mobile camera for your desktop</p>
      </footer>
    </div>
  );
}

export default App;
