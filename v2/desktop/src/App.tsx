import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

function App() {
  const [status, setStatus] = useState('Disconnected');
  const [isLive, setIsLive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const initPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
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
      console.log('Received track');
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        setIsLive(true);
        setStatus('LIVE');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setStatus('LIVE');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setStatus('Disconnected');
        setIsLive(false);
      }
    };

    peerConnection.current = pc;
  };

  useEffect(() => {
    // Connect to the signaling server (Electron main process)
    const socket = io('http://localhost:8080');
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('Waiting for device...');
      console.log('Connected to signaling server');
    });

    socket.on('webrtc-message', async (data) => {
      console.log('Received WebRTC message:', data.type);
      
      if (!peerConnection.current) {
        initPeerConnection();
      }

      const pc = peerConnection.current!;

      if (data.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-message', { type: 'answer', answer });
        setStatus('Connecting...');
      } else if (data.type === 'candidate') {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Error adding received ice candidate', e);
        }
      }
    });

    return () => {
      socket.disconnect();
      peerConnection.current?.close();
    };
  }, []);

  return (
    <div className="container">
      <header>
        <div className="logo-container">
          <div className="logo-icon"></div>
          <h1>SynCam <span className="v2-tag">V2</span></h1>
        </div>
        <div className={`status-badge ${status.toLowerCase()}`}>
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
              <span className="hint">Make sure your phone is on the same WiFi</span>
            </div>
          )}
          <video ref={videoRef} autoPlay playsInline muted className={isLive ? 'visible' : ''} />
        </div>

        <div className="controls-panel">
          <div className="stat">
            <span className="label">Protocol</span>
            <span className="value">WebRTC (Low Latency)</span>
          </div>
          <div className="stat">
            <span className="label">Resolution</span>
            <span className="value">Auto (1080p Target)</span>
          </div>
          <div className="stat">
            <span className="label">Audio</span>
            <span className="value">AAC / OPUS Sunc</span>
          </div>
        </div>
      </main>

      <footer>
        <p>Syncing professional video to your workspace</p>
      </footer>
    </div>
  );
}

export default App;
