import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
} from 'react-native-webrtc';
import { io } from 'socket.io-client';

// ─── Configuración ────────────────────────────────────────────────────────────
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const VIDEO_CONSTRAINTS = {
  audio: true,
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 60 },
    facingMode: 'user',
  },
};
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [localStream, setLocalStream] = useState(null);
  const [streamURL, setStreamURL] = useState(null);
  const [status, setStatus] = useState('Desconectado');
  const [ip, setIp] = useState('127.0.0.1');
  const [isLive, setIsLive] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [usbMode, setUsbMode] = useState(true); // USB mode on by default

  const peerConnection = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null); // Ref para acceso síncrono en callbacks

  // ─── Iniciar cámara ──────────────────────────────────────────────────────
  const startLocalStream = useCallback(async (useFront = true) => {
    // Detener stream anterior si existe
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    const constraints = {
      ...VIDEO_CONSTRAINTS,
      video: {
        ...VIDEO_CONSTRAINTS.video,
        facingMode: useFront ? 'user' : 'environment',
      },
    };

    try {
      const stream = await mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      // Obtener URL de forma segura
      const url = stream.toURL ? stream.toURL() : null;
      setStreamURL(url);
    } catch (err) {
      console.error('[SynCam] Error de cámara:', err);
      Alert.alert(
        'Error de Cámara',
        'No se pudo acceder a la cámara. Asegurate de haber otorgado permisos.',
      );
      setStatus('Error de cámara');
    }
  }, []);

  useEffect(() => {
    startLocalStream(true);
    return () => {
      cleanup();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Limpieza completa ───────────────────────────────────────────────────
  const cleanup = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
  };

  // ─── Crear PeerConnection limpia ─────────────────────────────────────────
  const createPeerConnection = () => {
    // Cerrar cualquier conexión anterior
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnection.current = pc;

    // Agregar tracks del stream local
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.connected) {
        socketRef.current.emit('webrtc-message', {
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC] Estado:', state);
      if (state === 'connected') {
        setIsLive(true);
        setStatus('🔴 EN VIVO');
      } else if (state === 'disconnected' || state === 'failed') {
        setIsLive(false);
        setStatus('Conexión perdida');
      }
    };

    return pc;
  };

  // ─── Conectar al escritorio ───────────────────────────────────────────────
  const connectToDesktop = () => {
    const trimmedIp = ip.trim();
    if (!trimmedIp) {
      Alert.alert('Error', 'Ingresá la IP de tu PC.');
      return;
    }
    if (!localStreamRef.current) {
      Alert.alert('Error', 'La cámara no está lista todavía.');
      return;
    }

    setStatus('Conectando a ' + trimmedIp + '...');

    const socket = io(`http://${trimmedIp}:8080`, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Conectado al servidor');
      setStatus('Iniciando WebRTC...');
      startWebRTC();
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Error de conexión:', err.message);
      setStatus('Error: no se pudo conectar');
      Alert.alert(
        'No se pudo conectar',
        `Verificá que:\n• La IP "${trimmedIp}" sea correcta\n• El PC esté en la misma red WiFi\n• SynCam Desktop esté corriendo`,
      );
    });

    socket.on('webrtc-message', async (data) => {
      const pc = peerConnection.current;
      if (!pc) return;

      try {
        if (data.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (data.type === 'candidate') {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (e) {
        console.error('[WebRTC] Error procesando mensaje:', e);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Desconectado:', reason);
      setIsLive(false);
      setStatus('Desconectado');
    });

    // Escuchar comandos de control del desktop (ej: flip-camera)
    socket.on('control', (data) => {
      if (data.action === 'flip-camera') {
        toggleCamera();
      }
    });
  };

  // ─── Iniciar negociación WebRTC ───────────────────────────────────────────
  const startWebRTC = async () => {
    try {
      const pc = createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current.emit('webrtc-message', { type: 'offer', offer });
    } catch (e) {
      console.error('[WebRTC] Error creando offer:', e);
      setStatus('Error WebRTC');
    }
  };

  // ─── Detener stream ───────────────────────────────────────────────────────
  const stopStream = () => {
    if (socketRef.current) socketRef.current.disconnect();
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setIsLive(false);
    setStatus('Detenido');
  };

  const toggleCamera = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack && typeof videoTrack._switchCamera === 'function') {
        videoTrack._switchCamera();
        setIsFrontCamera(!isFrontCamera);
        return;
      }
    }

    // Fallback if _switchCamera is not supported
    const newFront = !isFrontCamera;
    setIsFrontCamera(newFront);
    await startLocalStream(newFront);
    
    // Si estamos en vivo y tuvimos que recrear el stream, enviamos nueva oferta
    if (isLive && socketRef.current?.connected) {
      startWebRTC();
    }
  };

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d1117" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            SynCam <Text style={styles.v2}>V2</Text>
          </Text>
          <Text style={styles.subtitle}>Mobile Camera</Text>
        </View>
        <View style={[styles.statusBadge, isLive && styles.liveBadge]}>
          <View style={[styles.dot, isLive && styles.dotLive]} />
          <Text style={[styles.statusText, isLive && styles.statusTextLive]}>
            {status}
          </Text>
        </View>
      </View>

      {/* Preview de cámara */}
      <View style={styles.videoContainer}>
        {streamURL ? (
          <RTCView
            streamURL={streamURL}
            style={styles.localVideo}
            objectFit="cover"
            mirror={isFrontCamera}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📷</Text>
            <Text style={styles.placeholderText}>Iniciando cámara...</Text>
          </View>
        )}

        {/* Botón cambiar cámara (overlay) */}
        {streamURL && (
          <TouchableOpacity style={styles.flipButton} onPress={toggleCamera}>
            <Text style={styles.flipIcon}>🔄</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Footer / Controles */}
      <View style={styles.footer}>
        {!isLive ? (
          <View style={styles.inputGroup}>
            {/* Toggle USB / WiFi */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, usbMode && styles.modeBtnActive]}
                onPress={() => { setUsbMode(true); setIp('127.0.0.1'); }}
              >
                <Text style={[styles.modeBtnText, usbMode && styles.modeBtnTextActive]}>🔌 USB</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, !usbMode && styles.modeBtnActive]}
                onPress={() => { setUsbMode(false); setIp('192.168.1.'); }}
              >
                <Text style={[styles.modeBtnText, !usbMode && styles.modeBtnTextActive]}>📶 WiFi</Text>
              </TouchableOpacity>
            </View>

            {usbMode ? (
              <View style={styles.usbInfo}>
                <Text style={styles.usbInfoText}>✅ Modo USB activo</Text>
                <Text style={styles.usbInfoSub}>Corre start-mobile.bat → opción 1 en tu PC</Text>
              </View>
            ) : (
              <>
                <Text style={styles.label}>IP del PC (misma red WiFi):</Text>
                <TextInput
                  style={styles.input}
                  value={ip}
                  onChangeText={setIp}
                  placeholder="192.168.x.x"
                  placeholderTextColor="#444"
                  keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.button, !streamURL && styles.buttonDisabled]}
              onPress={connectToDesktop}
              disabled={!streamURL}
            >
              <Text style={styles.buttonText}>▶  INICIAR TRANSMISIÓN</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.liveControls}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>TRANSMITIENDO EN VIVO</Text>
            </View>
            <TouchableOpacity style={styles.stopButton} onPress={stopStream}>
              <Text style={styles.buttonText}>⏹  DETENER</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  title: {
    color: '#f0f6fc',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  v2: {
    fontSize: 11,
    color: '#58a6ff',
    fontWeight: '600',
  },
  subtitle: {
    color: '#8b949e',
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#30363d',
    gap: 6,
  },
  liveBadge: {
    borderColor: '#238636',
    backgroundColor: '#0d2818',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#484f58',
  },
  dotLive: {
    backgroundColor: '#3fb950',
  },
  statusText: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextLive: {
    color: '#3fb950',
  },
  videoContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#010409',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#21262d',
  },
  localVideo: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  placeholderIcon: {
    fontSize: 48,
  },
  placeholderText: {
    color: '#484f58',
    fontSize: 14,
    fontWeight: '500',
  },
  flipButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipIcon: {
    fontSize: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  inputGroup: {
    gap: 10,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#161b22',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#1f6feb',
  },
  modeBtnText: {
    color: '#8b949e',
    fontWeight: '600',
    fontSize: 13,
  },
  modeBtnTextActive: {
    color: '#fff',
  },
  usbInfo: {
    backgroundColor: '#0d2818',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#238636',
    gap: 4,
  },
  usbInfoText: {
    color: '#3fb950',
    fontWeight: 'bold',
    fontSize: 14,
  },
  usbInfoSub: {
    color: '#8b949e',
    fontSize: 12,
  },
  label: {
    color: '#8b949e',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  input: {
    backgroundColor: '#161b22',
    color: '#f0f6fc',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 17,
    borderWidth: 1,
    borderColor: '#30363d',
    letterSpacing: 1,
  },
  button: {
    backgroundColor: '#1f6feb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    backgroundColor: '#21262d',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  liveControls: {
    gap: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f85149',
  },
  liveText: {
    color: '#f85149',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  stopButton: {
    backgroundColor: '#da3633',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
});
