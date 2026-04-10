import { registerRootComponent } from 'expo';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar as RNStatusBar,
  Dimensions,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useCameraPermissions, CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import SynCamForeground from './modules/SynCamForeground';

// ── Constants ───────────────────────────────────────────────
const { height: SH } = Dimensions.get('window');

const COLORS = {
  bg:        '#080812',
  surface:   '#0f0f1e',
  card:      '#13132a',
  elevated:  '#1a1a35',
  accent:    '#7c6af7',
  accentL:   '#a78bfa',
  success:   '#22d3a0',
  danger:    '#ef4444',
  warning:   '#f59e0b',
  textPri:   '#f0f0ff',
  textSec:   '#8888b0',
  textMuted: '#4a4a70',
  border:    'rgba(255,255,255,0.07)',
  borderAcc: 'rgba(124,106,247,0.35)',
} as const;

const QUALITY_PRESETS: Record<string, { quality: number; fps: number; width: number; height: number; label: string }> = {
  'Alta (HD)': { quality: 0.50, fps: 60, width: 1280, height: 720,  label: 'HD' },
  'Media':     { quality: 0.45, fps: 45, width: 960,  height: 540,  label: 'Med' },
  'Baja':      { quality: 0.35, fps: 30, width: 640,  height: 480,  label: 'Baja' },
  'Muy baja':  { quality: 0.20, fps: 20, width: 320,  height: 240,  label: 'Min' },
};

type AppScreen    = 'connect' | 'camera' | 'scan';
type CameraFacing = 'user' | 'environment';
type ConnMode     = 'wifi' | 'usb';

// ── WebView Camera HTML ─────────────────────────────────────
function buildCameraHTML(
  facing: CameraFacing,
  quality: number,
  fps: number,
  width: number,
  height: number
): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; overflow:hidden; background:#000; }
  video { width:100%; height:100%; object-fit:cover; }
  canvas { display:none; }
</style>
</head>
<body>
<video id="v" autoplay playsinline muted></video>
<canvas id="c"></canvas>
<script>
(function(){
  var video = document.getElementById('v');
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var stream = null;
  var intervalId = null;
  var currentFacing = '${facing}';
  var captureQuality = ${quality};
  var captureFps = ${fps};
  var captureWidth = ${width};
  var captureHeight = ${height};
  var torchOn = false;
  var frameCount = 0;
  var lastFpsTime = Date.now();

  function log(msg) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg }));
  }

  function sendStatus(status, detail) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'status', status: status, detail: detail || '' }));
  }

  async function startCamera() {
    try {
      // Stop any existing stream
      if (stream) {
        stream.getTracks().forEach(function(t) { t.stop(); });
        stream = null;
      }
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }

      sendStatus('starting', 'Iniciando cámara...');

      var constraints = {
        video: {
          facingMode: { ideal: currentFacing },
          width: { ideal: captureWidth },
          height: { ideal: captureHeight },
          frameRate: { ideal: captureFps }
        },
        audio: false  // Audio en stream separado para máximo control
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      
      await new Promise(function(resolve, reject) {
        var checkDims = function() {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            resolve();
          } else {
            requestAnimationFrame(checkDims);
          }
        };
        video.onloadedmetadata = function() {
          video.play().then(checkDims).catch(reject);
        };
        setTimeout(function() { reject(new Error('Timeout loading video metadata')); }, 8000);
      });

      // Set canvas size to actual video dimensions (may differ from requested)
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      sendStatus('streaming', 'Transmitiendo ' + video.videoWidth + 'x' + video.videoHeight);
      log('Camera started: ' + video.videoWidth + 'x' + video.videoHeight + ' facing=' + currentFacing);

      // Start capture loop
      var interval = Math.floor(1000 / captureFps);
      intervalId = setInterval(captureFrame, interval);

    } catch(e) {
      log('Camera error: ' + e.message);
      sendStatus('error', e.message);
    }
  }

  function captureFrame() {
    if (!stream || !video.videoWidth) return;
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      var dataUrl = canvas.toDataURL('image/jpeg', captureQuality);
      // Strip the data:image/jpeg;base64, prefix to save bandwidth
      var base64 = dataUrl.split(',')[1];
      if (base64) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'frame',
          frame: base64,
          w: canvas.width,
          h: canvas.height
        }));

        frameCount++;
        var now = Date.now();
        if (now - lastFpsTime >= 2000) {
          var fps = Math.round(frameCount / ((now - lastFpsTime) / 1000));
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'fps', fps: fps }));
          frameCount = 0;
          lastFpsTime = now;
        }
      }
    } catch(e) {
      // Silently skip individual frame errors
    }
  }

  async function setTorch(on) {
    if (!stream) return;
    try {
      var track = stream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        var caps = track.getCapabilities();
        if (caps.torch) {
          await track.applyConstraints({ advanced: [{ torch: on }] });
          torchOn = on;
          log('Torch: ' + (on ? 'ON' : 'OFF'));
        } else {
          log('Torch not supported on this camera');
        }
      }
    } catch(e) {
      log('Torch error: ' + e.message);
    }
  }

  async function flipCamera() {
    currentFacing = (currentFacing === 'user') ? 'environment' : 'user';
    sendStatus('switching', 'Cambiando cámara...');
    await startCamera();
  }

  function updateSettings(newQuality, newFps, newWidth, newHeight) {
    captureQuality = newQuality || captureQuality;
    captureFps = newFps || captureFps;
    if (newWidth) captureWidth = newWidth;
    if (newHeight) captureHeight = newHeight;
    // Restart capture with new settings
    startCamera();
    log('Settings updated: quality=' + captureQuality + ' fps=' + captureFps + ' ' + captureWidth + 'x' + captureHeight);
  }

  function stopCamera() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (stream) {
      stream.getTracks().forEach(function(t) { t.stop(); });
      stream = null;
    }
    sendStatus('stopped', 'Cámara detenida');
  }

  // Listen for commands from React Native
  window.addEventListener('message', function(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.cmd === 'flip') flipCamera();
      else if (msg.cmd === 'torch') setTorch(msg.on);
      else if (msg.cmd === 'settings') updateSettings(msg.quality, msg.fps, msg.width, msg.height);
      else if (msg.cmd === 'stop') stopCamera();
      else if (msg.cmd === 'restart') startCamera();
      else if (msg.cmd === 'audio') { audioEnabled = msg.enabled !== false; }
    } catch(err) {}
  });

  // Also listen on document for Android WebView compatibility
  document.addEventListener('message', function(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.cmd === 'flip') flipCamera();
      else if (msg.cmd === 'torch') setTorch(msg.on);
      else if (msg.cmd === 'settings') updateSettings(msg.quality, msg.fps, msg.width, msg.height);
      else if (msg.cmd === 'stop') stopCamera();
      else if (msg.cmd === 'restart') startCamera();
    } catch(err) {}
  });

  // Auto-start
  startCamera();
})();
</script>
</body>
</html>`;
}

// ── App ─────────────────────────────────────────────────────
export default function SynCamApp() {
  const [permission, requestPermission] = useCameraPermissions();

  const [screen, setScreen]               = useState<AppScreen>('connect');
  const [serverIp, setServerIp]           = useState('');
  const [serverPort, setServerPort]       = useState('8080');
  const [connected, setConnected]         = useState(false);
  const [connecting, setConnecting]       = useState(false);
  const [facing, setFacing]               = useState<CameraFacing>('environment');
  const [rotation, setRotation]           = useState(0);
  const [torchOn, setTorchOn]             = useState(false);
  const [quality, setQuality]             = useState('Alta (HD)');
  const [mirrorH, setMirrorH]             = useState(false);
  const [micEnabled, setMicEnabled]       = useState(true);
  const [streaming, setStreaming]         = useState(false);
  const [fps, setFps]                     = useState(0);
  const [framesSent, setFramesSent]       = useState(0);
  const [connectionMode, setConnectionMode] = useState<ConnMode>('wifi');
  const [latencyMs, setLatencyMs]         = useState<number | null>(null);
  const [statusMsg, setStatusMsg]         = useState('');
  const [cameraStatus, setCameraStatus]   = useState('');

  const webViewRef     = useRef<WebView | null>(null);
  const wsRef          = useRef<WebSocket | null>(null);
  const streamingRef   = useRef(false);
  const rotationRef    = useRef(rotation);
  const mirrorHRef     = useRef(mirrorH);
  const frameCountRef  = useRef(0);
  const pulseAnim      = useRef(new Animated.Value(1)).current;

  // Sync refs
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);
  useEffect(() => { mirrorHRef.current  = mirrorH;  }, [mirrorH]);

  // ── Pulse animation ────────────────────────────────────────
  useEffect(() => {
    if (streaming) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.35, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.00, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [streaming, pulseAnim]);

  // ── Keep screen awake + 🔋 Foreground Service ─────────────
  useEffect(() => {
    if (streaming) {
      activateKeepAwakeAsync();
      // Foreground Service: mantiene CPU/red/audio activos con pantalla apagada
      SynCamForeground.start(quality.split(' ')[0]);
    } else {
      deactivateKeepAwake();
      SynCamForeground.stop();
    }
    return () => {
      deactivateKeepAwake();
      SynCamForeground.stop();
    };
  }, [streaming, quality]);

  // ── Cleanup on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => { stopStreamingInternal(); };
  }, []);

  // ── Helper: Base64 to Uint8Array ──────────────────────────
  const base64ToUint8Array = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  // ── Handle WebView messages ────────────────────────────────
  const onWebViewMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'frame') {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN && streamingRef.current) {
          // Optimization: Convert base64 to Binary + Header
          // VIDEO Header (8 bytes): [S, Y, Rotation/90, MirrorH, Len, Len, Len, Len]
          const imgData = base64ToUint8Array(msg.frame);
          const header = new Uint8Array(8);
          header[0] = 0x53; // 'S'
          header[1] = 0x59; // 'Y' — tipo VIDEO
          header[2] = Math.floor(rotationRef.current / 90);
          header[3] = mirrorHRef.current ? 1 : 0;
          
          const len = imgData.length;
          header[4] = (len >> 24) & 0xFF;
          header[5] = (len >> 16) & 0xFF;
          header[6] = (len >> 8) & 0xFF;
          header[7] = len & 0xFF;

          const packet = new Uint8Array(header.length + imgData.length);
          packet.set(header);
          packet.set(imgData, 8);

          ws.send(packet);
          frameCountRef.current++;
          setFramesSent(prev => prev + 1);
        }

      } else if (msg.type === 'audio') {
        // ── 🎤 PAQUETE DE AUDIO (SA protocol) ──────────────
        // AUDIO Header (8 bytes): [S, A, SR_Hi, SR_Lo, Len, Len, Len, Len]
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN && streamingRef.current && msg.pcm) {
          const pcmData = base64ToUint8Array(msg.pcm);
          const sr = (msg.sampleRate || 22050) & 0xFFFF; // Max 65535Hz

          const header = new Uint8Array(8);
          header[0] = 0x53;                  // 'S'
          header[1] = 0x41;                  // 'A' — tipo AUDIO
          header[2] = (sr >> 8) & 0xFF;      // SampleRate high byte
          header[3] = sr & 0xFF;             // SampleRate low byte

          const len = pcmData.length;
          header[4] = (len >> 24) & 0xFF;
          header[5] = (len >> 16) & 0xFF;
          header[6] = (len >> 8) & 0xFF;
          header[7] = len & 0xFF;

          const packet = new Uint8Array(8 + pcmData.length);
          packet.set(header);
          packet.set(pcmData, 8);
          ws.send(packet);
        }

      } else if (msg.type === 'fps') {
        setFps(msg.fps);
      } else if (msg.type === 'status') {
        setCameraStatus(msg.status);
        if (msg.status === 'streaming') {
          setStreaming(true);
          streamingRef.current = true;
        } else if (msg.status === 'error') {
          setStatusMsg('Error cámara: ' + (msg.detail || ''));
        }
      } else if (msg.type === 'log') {
        console.log('[WebView]', msg.message);
      }
    } catch (_) {
      // Ignore parse errors
    }
  }, []);

  // ── Send command to WebView ────────────────────────────────
  const sendToWebView = useCallback((cmd: object) => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.dispatchEvent(new MessageEvent('message', { data: '${JSON.stringify(cmd)}' })); true;`
      );
    }
  }, []);

  // ── Connect to PC ──────────────────────────────────────────
  const connectToPC = async () => {
    if (connectionMode === 'wifi' && !serverIp.trim()) {
      Alert.alert('Error', 'Ingresa la IP del PC');
      return;
    }

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permiso requerido', 'SynCam necesita acceso a la cámara.');
        return;
      }
    }

    setConnecting(true);
    setStatusMsg('Verificando servidor...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const host = connectionMode === 'usb' ? '127.0.0.1' : serverIp.trim();
    const port = serverPort.trim() || '8080';

    try {
      // 1. Verify HTTP server is reachable
      const pingStart = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const pingResp = await fetch(`http://${host}:${port}/ping`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (!pingResp.ok) throw new Error('Servidor no responde');
      setLatencyMs(Date.now() - pingStart);

      setStatusMsg('Conectando WebSocket...');

      // 2. Open WebSocket
      await openWebSocket(host, port);

      setConnecting(false);
      setConnected(true);
      setScreen('camera');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (err: any) {
      setConnecting(false);
      setStatusMsg('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      let errorMsg = err?.message || 'Desconocido';
      if (errorMsg.includes('abort')) errorMsg = 'Tiempo de conexión agotado';
      
      Alert.alert(
        'No se pudo conectar',
        `No se encontró SynCam en ${host}:${port}\n\n` +
        `Error: ${errorMsg}\n\n` +
        'Verifica:\n• Que SynCam Desktop esté abierto\n• Que estés en la misma red WiFi\n• La IP ingresada',
        [{ text: 'OK' }]
      );
    }
  };

  // ── WebSocket management ────────────────────────────────────
  const openWebSocket = (host: string, port: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const url = `ws://${host}:${port}`;
      const ws  = new WebSocket(url);
      const timeoutId = setTimeout(() => {
        ws.close();
        reject(new Error('Tiempo de conexión agotado (WS)'));
      }, 8000);

      ws.onopen = () => {
        clearTimeout(timeoutId);
        wsRef.current = ws;
        streamingRef.current = true;
        // Camera will start via WebView mount
        resolve();
      };

      ws.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error('Error de WebSocket'));
      };

      ws.onclose = () => {
        if (streamingRef.current) {
          setStreaming(false);
          streamingRef.current = false;
          setStatusMsg('Conexión perdida');
        }
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'set_quality') {
            // Remap server quality names to WebView dimensions
            const qualityVal = msg.quality === '144p' ? 0.10
              : msg.quality === '240p' ? 0.15
              : msg.quality === '360p' ? 0.25
              : msg.quality === '480p' ? 0.35
              : msg.quality === '720p' ? 0.50
              : msg.quality === '1080p' ? 0.70
              : 0.50;
            // Send to WebView to restart camera with new dimensions
            sendToWebView({
              cmd: 'settings',
              quality: qualityVal,
              fps: msg.quality === '144p' || msg.quality === '240p' ? 15 : 30,
              width: msg.width,
              height: msg.height,
            });
          }
        } catch (_) { /* pong or non-JSON */ }
      };
    });
  };

  const stopStreamingInternal = () => {
    streamingRef.current = false;
    // Tell WebView to stop camera
    sendToWebView({ cmd: 'stop' });
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const stopStreaming = () => {
    stopStreamingInternal();
    setStreaming(false);
    setConnected(false);
    setScreen('connect');
    setFps(0);
    setFramesSent(0);
    setLatencyMs(null);
    setStatusMsg('');
    setCameraStatus('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // ── Get current preset ─────────────────────────────────────
  const currentPreset = QUALITY_PRESETS[quality];

  // ════════════════════════════════════════════════════════
  // UI — CONNECT SCREEN
  // ════════════════════════════════════════════════════════
  if (screen === 'connect') {
    return (
      <SafeAreaView style={s.safeArea}>
        <RNStatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <ScrollView
          style={s.scrollView}
          contentContainerStyle={s.connectContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={s.logoSection}>
            <View style={s.logoCircle}>
              <Ionicons name="videocam" size={36} color={COLORS.accentL} />
            </View>
            <Text style={s.appName}>SynCam</Text>
            <Text style={s.appTagline}>Transmite tu cámara al PC</Text>
          </View>

          {/* Mode Toggle */}
          <View style={s.modeToggle}>
            <TouchableOpacity
              style={[s.modeBtn, connectionMode === 'wifi' && s.modeBtnActive]}
              onPress={() => setConnectionMode('wifi')}
            >
              <Ionicons name="wifi" size={16} color={connectionMode === 'wifi' ? COLORS.accentL : COLORS.textMuted} />
              <Text style={[s.modeBtnText, connectionMode === 'wifi' && s.modeBtnTextActive]}>WiFi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modeBtn, connectionMode === 'usb' && s.modeBtnActive]}
              onPress={() => setConnectionMode('usb')}
            >
              <Ionicons name="hardware-chip-outline" size={16} color={connectionMode === 'usb' ? COLORS.accentL : COLORS.textMuted} />
              <Text style={[s.modeBtnText, connectionMode === 'usb' && s.modeBtnTextActive]}>USB (ADB)</Text>
            </TouchableOpacity>
          </View>

          {/* Input Card */}
          <View style={s.inputCard}>
            {connectionMode === 'wifi' ? (
              <>
                <Text style={s.inputLabel}>Dirección IP del PC</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="192.168.1.100"
                  placeholderTextColor={COLORS.textMuted}
                  value={serverIp}
                  onChangeText={setServerIp}
                  keyboardType="numeric"
                  autoCorrect={false}
                  returnKeyType="next"
                  id="input-server-ip"
                />
                <Text style={[s.inputLabel, { marginTop: 14 }]}>Puerto</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="8080"
                  placeholderTextColor={COLORS.textMuted}
                  value={serverPort}
                  onChangeText={setServerPort}
                  keyboardType="numeric"
                  returnKeyType="done"
                  id="input-server-port"
                />

                {/* QR Scan Button */}
                <TouchableOpacity
                  style={s.scanBtn}
                  onPress={() => setScreen('scan')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="qr-code-outline" size={20} color={COLORS.accentL} />
                  <Text style={s.scanBtnText}>Escanear código QR en la PC</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={s.usbInfo}>
                <Ionicons name="information-circle-outline" size={20} color={COLORS.accentL} />
                <Text style={s.usbInfoText}>
                  Conecta el cable USB y ejecuta en el PC:{'\n'}
                  <Text style={s.monoText}>adb reverse tcp:8080 tcp:8080</Text>
                  {'\n'}Luego presiona Conectar.{'\n\n'}
                  <Text style={s.monoText}>Botón "Activar túnel USB"</Text>
                  {' '}disponible en la app desktop.
                </Text>
              </View>
            )}

            {/* Quality */}
            <Text style={[s.inputLabel, { marginTop: 14 }]}>Calidad de stream</Text>
            <View style={s.qualityRow}>
              {Object.keys(QUALITY_PRESETS).map(q => (
                <TouchableOpacity
                  key={q}
                  style={[s.qualityChip, quality === q && s.qualityChipActive]}
                  onPress={() => setQuality(q)}
                >
                  <Text style={[s.qualityChipText, quality === q && s.qualityChipTextActive]}>
                    {q}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Connect Button */}
          <TouchableOpacity
            style={[s.connectBtn, connecting && s.connectBtnDisabled]}
            onPress={connectToPC}
            disabled={connecting}
            activeOpacity={0.85}
            id="btn-connect"
          >
            {connecting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="link" size={20} color="#fff" />
            )}
            <Text style={s.connectBtnText}>
              {connecting ? (statusMsg || 'Conectando...') : 'Conectar al PC'}
            </Text>
          </TouchableOpacity>

          <Text style={s.helpText}>
            Abre SynCam en tu PC para ver la dirección IP.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════
  // UI — SCAN QR SCREEN
  // ════════════════════════════════════════════════════════
  if (screen === 'scan') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <RNStatusBar hidden />
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (data.startsWith('syncam://')) {
              // Parse syncam://192.168.1.100:8080
              const pure = data.replace('syncam://', '');
              const parts = pure.split(':');
              if (parts.length === 2) {
                setServerIp(parts[0]);
                setServerPort(parts[1]);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setScreen('connect');
              }
            }
          }}
        />
        {/* Helper overlay UI */}
        <View style={s.scanOverlay}>
          <View style={s.scanHeader}>
            <TouchableOpacity onPress={() => setScreen('connect')} style={s.scanBackBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={s.scanTitle}>Apuntar al código QR</Text>
            <View style={{ width: 44 }} />
          </View>
          <View style={s.scanTargetFrame}>
            <View style={[s.scanCorner, s.scanCornerTL]} />
            <View style={[s.scanCorner, s.scanCornerTR]} />
            <View style={[s.scanCorner, s.scanCornerBL]} />
            <View style={[s.scanCorner, s.scanCornerBR]} />
          </View>
          <Text style={s.scanSubtitle}>Busca el código QR en la aplicación de tu computadora</Text>
        </View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════
  // UI — CAMERA SCREEN (WebView-based)
  // ════════════════════════════════════════════════════════
  const cameraHTML = buildCameraHTML(
    facing,
    currentPreset.quality,
    currentPreset.fps,
    currentPreset.width,
    currentPreset.height
  );

  return (
    <View style={s.cameraScreen}>
      <RNStatusBar hidden />

      {/* WebView Camera — occupies full screen behind controls */}
      <WebView
        ref={webViewRef as any}
        source={{ html: cameraHTML, baseUrl: 'https://localhost/' }}
        style={s.camera}
        javaScriptEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        mediaCapturePermissionGrantType="grant"
        onMessage={onWebViewMessage}
        onError={(e) => {
          console.error('[WebView Error]', e.nativeEvent.description);
          setCameraStatus('error');
          setStatusMsg(e.nativeEvent.description);
        }}
        // Android-specific props for camera access
        allowFileAccess={true}
        domStorageEnabled={true}
        // Ensure camera permissions flow through
        originWhitelist={['*']}
      />

      {/* Top Bar */}
      <SafeAreaView style={s.cameraTopBar}>
        <View style={s.cameraTopRow}>
          {/* Live badge */}
          <View style={[s.streamBadge, streaming && s.streamBadgeLive, cameraStatus === 'error' && { borderColor: COLORS.danger }]}>
            <Animated.View style={[s.streamDot, streaming && { transform: [{ scale: pulseAnim }] }, cameraStatus === 'error' && { backgroundColor: COLORS.danger }]} />
            <Text style={[s.streamBadgeText, cameraStatus === 'error' && { color: COLORS.danger }]}>
              {cameraStatus === 'error' ? 'ERROR' : streaming ? 'LIVE' : cameraStatus === 'starting' ? 'INICIANDO' : 'CONECTANDO'}
            </Text>
          </View>

          {/* Stats */}
          {streaming && (
            <View style={s.statsRow}>
              <View style={s.statChip}>
                <Text style={s.statText}>{fps} fps</Text>
              </View>
              <View style={s.statChip}>
                <Text style={s.statText}>{quality.split(' ')[0]}</Text>
              </View>
              {latencyMs !== null && (
                <View style={s.statChip}>
                  <Text style={s.statText}>{latencyMs} ms</Text>
                </View>
              )}
            </View>
          )}

          {/* Error message if failed */}
          {cameraStatus === 'error' && (
            <Text style={{ position: 'absolute', top: 60, left: 16, color: COLORS.danger, backgroundColor: 'rgba(0,0,0,0.8)', padding: 8, borderRadius: 8, fontSize: 12 }}>
              {statusMsg || 'Error al iniciar la cámara. Verifica permisos HTTPS y WebView.'}
            </Text>
          )}

          {/* Disconnect */}
          <TouchableOpacity style={s.disconnectBtn} onPress={stopStreaming} id="btn-disconnect">
            <Ionicons name="close" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom Controls */}
      <View style={s.cameraBottomBar}>
        <View style={s.controlRow}>
          {/* Torch */}
          <TouchableOpacity
            style={[s.ctrlBtn, torchOn && s.ctrlBtnActive]}
            onPress={() => {
              const newState = !torchOn;
              setTorchOn(newState);
              sendToWebView({ cmd: 'torch', on: newState });
              Haptics.selectionAsync();
            }}
            id="btn-torch"
          >
            <Ionicons name={torchOn ? 'flash' : 'flash-off'} size={22} color={torchOn ? COLORS.warning : COLORS.textSec} />
          </TouchableOpacity>

          {/* Mic Toggle */}
          <TouchableOpacity
            style={[s.ctrlBtn, !micEnabled && s.ctrlBtnActive]}
            onPress={() => {
              const newState = !micEnabled;
              setMicEnabled(newState);
              sendToWebView({ cmd: 'audio', enabled: newState });
              Haptics.selectionAsync();
            }}
            id="btn-mic"
          >
            <Ionicons name={micEnabled ? 'mic' : 'mic-off'} size={22} color={micEnabled ? COLORS.textSec : COLORS.danger} />
          </TouchableOpacity>

          {/* Rotate CCW */}
          <TouchableOpacity
            style={s.ctrlBtn}
            onPress={() => { setRotation(r => (r - 90 + 360) % 360); Haptics.selectionAsync(); }}
            id="btn-rotate-ccw"
          >
            <Ionicons name="reload-outline" size={22} color={COLORS.textSec} style={{ transform: [{ scaleX: -1 }] }} />
          </TouchableOpacity>

          {/* Flip Camera */}
          <TouchableOpacity
            style={s.flipBtn}
            onPress={() => {
              setFacing(f => f === 'environment' ? 'user' : 'environment');
              sendToWebView({ cmd: 'flip' });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            id="btn-flip"
          >
            <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Rotate CW */}
          <TouchableOpacity
            style={s.ctrlBtn}
            onPress={() => { setRotation(r => (r + 90) % 360); Haptics.selectionAsync(); }}
            id="btn-rotate-cw"
          >
            <Ionicons name="reload-outline" size={22} color={COLORS.textSec} />
          </TouchableOpacity>

          {/* Mirror */}
          <TouchableOpacity
            style={[s.ctrlBtn, mirrorH && s.ctrlBtnActive]}
            onPress={() => { setMirrorH(!mirrorH); Haptics.selectionAsync(); }}
            id="btn-mirror"
          >
            <Ionicons name="git-compare-outline" size={22} color={mirrorH ? COLORS.accentL : COLORS.textSec} />
          </TouchableOpacity>
        </View>

        {/* Rotation indicator dots */}
        <View style={s.rotationRow}>
          <Text style={s.rotLabel}>Rotación: {rotation}°</Text>
          <View style={s.rotDots}>
            {[0, 90, 180, 270].map(r => (
              <TouchableOpacity key={r} onPress={() => setRotation(r)}>
                <View style={[s.rotDot, rotation === r && s.rotDotActive]} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.rotLabel}>{framesSent} frames</Text>
        </View>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// STYLES (Premium Dark OLED Theme)
// ════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  safeArea:   { flex: 1, backgroundColor: COLORS.bg },
  scrollView: { flex: 1 },

  connectContainer: {
    padding:       24,
    paddingBottom: 50,
    alignItems:    'center',
    minHeight:     SH,
  },

  // Logo
  logoSection: { alignItems: 'center', marginBottom: 40, marginTop: 30 },
  logoCircle: {
    width:           88,
    height:          88,
    borderRadius:    44,
    backgroundColor: 'rgba(124,106,247,0.1)',
    borderWidth:     1,
    borderColor:     COLORS.borderAcc,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,
    shadowColor:     COLORS.accent,
    shadowOffset:    { width: 0, height: 10 },
    shadowOpacity:   0.4,
    shadowRadius:    25,
    elevation:       10,
  },
  appName:    { fontSize: 32, fontWeight: '800', color: '#ffffff', letterSpacing: 1.5 },
  appTagline: { fontSize: 15, color: COLORS.textSec, marginTop: 6, fontWeight: '500' },

  // Mode Toggle
  modeToggle: {
    flexDirection:   'row',
    backgroundColor: 'rgba(20,20,40,0.4)',
    borderRadius:    16,
    padding:         6,
    marginBottom:    24,
    borderWidth:     1,
    borderColor:     COLORS.border,
    width:           '100%',
  },
  modeBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    paddingVertical: 12,
    borderRadius:    12,
  },
  modeBtnActive:     { backgroundColor: 'rgba(124,106,247,0.15)', borderWidth: 1, borderColor: COLORS.borderAcc },
  modeBtnText:       { fontSize: 15, fontWeight: '600', color: COLORS.textMuted },
  modeBtnTextActive: { color: COLORS.accentL },

  // Input Card
  inputCard: {
    width:           '100%',
    backgroundColor: 'rgba(15,15,30,0.6)',
    borderRadius:    24,
    padding:         24,
    borderWidth:     1,
    borderColor:     COLORS.border,
    marginBottom:    24,
    gap:             8,
  },
  inputLabel: {
    fontSize:      12,
    fontWeight:    '700',
    color:         COLORS.textSec,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom:  6,
  },
  textInput: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth:     1,
    borderColor:     COLORS.border,
    borderRadius:    12,
    padding:         16,
    fontSize:        17,
    fontFamily:      Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color:           '#fff',
    fontWeight:      '600',
  },

  usbInfo: {
    flexDirection:   'row',
    gap:             12,
    backgroundColor: 'rgba(0,250,154,0.05)',
    borderRadius:    16,
    padding:         16,
    borderWidth:     1,
    borderColor:     'rgba(0,250,154,0.2)',
    alignItems:      'flex-start',
  },
  usbInfoText: { flex: 1, fontSize: 14, color: COLORS.textSec, lineHeight: 24, fontWeight: '500' },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color:      COLORS.success,
    fontSize:   13,
    fontWeight: '700',
  },

  qualityRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  qualityChip:           { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: COLORS.border },
  qualityChipActive:     { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  qualityChipText:       { fontSize: 13, fontWeight: '600', color: COLORS.textSec },
  qualityChipTextActive: { color: '#fff' },

  // Connect Button
  connectBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             12,
    backgroundColor: COLORS.accent,
    paddingVertical: 18,
    borderRadius:    20,
    width:           '100%',
    marginBottom:    20,
    shadowColor:     COLORS.accent,
    shadowOffset:    { width: 0, height: 10 },
    shadowOpacity:   0.5,
    shadowRadius:    20,
    elevation:       10,
  },
  connectBtnDisabled: { opacity: 0.6, shadowOpacity: 0 },
  connectBtnText:     { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: COLORS.borderAcc,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 24,
    gap: 10,
  },
  scanBtnText: {
    color: COLORS.accentL,
    fontSize: 16,
    fontWeight: '700',
  },

  // --- Scan Overlay ---
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanHeader: {
    position: 'absolute',
    top: 50,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  scanBackBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scanTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scanTargetFrame: {
    width: 260,
    height: 260,
    position: 'relative',
  },
  scanCorner: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderColor: COLORS.accent,
  },
  scanCornerTL: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 24 },
  scanCornerTR: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 24 },
  scanCornerBL: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 24 },
  scanCornerBR: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 24 },
  scanSubtitle: {
    position: 'absolute',
    bottom: 100,
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    width: '85%',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
    borderRadius: 16,
    overflow: 'hidden',
    fontWeight: '500',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  helpText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, maxWidth: 300, fontWeight: '500' },

  // Camera Screen
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  camera:       { flex: 1 },

  cameraTopBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  cameraTopRow: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 },

  streamBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    backgroundColor:   'rgba(0,0,0,0.7)',
    paddingVertical:   6,
    paddingHorizontal: 14,
    borderRadius:      24,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.15)',
  },
  streamBadgeLive: { borderColor: 'rgba(34,211,160,0.5)', backgroundColor: 'rgba(34,211,160,0.15)' },
  streamDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  streamBadgeText: { fontSize: 12, fontWeight: '900', color: COLORS.success, letterSpacing: 1.5 },

  statsRow: { flexDirection: 'row', gap: 8, flex: 1 },
  statChip: {
    backgroundColor:   'rgba(0,0,0,0.7)',
    paddingVertical:   6,
    paddingHorizontal: 10,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.15)',
  },
  statText: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#fff', fontWeight: 'bold' },

  disconnectBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth:     1,
    borderColor:     'rgba(239,68,68,0.5)',
    alignItems:      'center',
    justifyContent:  'center',
    marginLeft:      'auto',
  },

  cameraBottomBar: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingBottom:     50,
    paddingHorizontal: 24,
    paddingTop:        24,
    backgroundColor:   'rgba(0,0,0,0.7)',
    gap:               20,
    zIndex:            10,
  },

  controlRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },

  ctrlBtn: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.15)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  ctrlBtnActive: {
    backgroundColor: 'rgba(124,106,247,0.25)',
    borderColor:     COLORS.accentL,
  },
  flipBtn: {
    width:           76,
    height:          76,
    borderRadius:    38,
    backgroundColor: COLORS.accent,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     COLORS.accent,
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.6,
    shadowRadius:    20,
    elevation:       12,
  },

  rotationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 16 },
  rotLabel:    { fontSize: 13, color: '#fff', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: 'bold' },
  rotDots:     { flexDirection: 'row', gap: 12 },
  rotDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.textMuted },
  rotDotActive:{ backgroundColor: COLORS.accentL, transform: [{ scale: 1.4 }] },
});

// Necesario en Expo SDK 50+ para que Expo Go encuentre el componente raíz
registerRootComponent(SynCamApp);

