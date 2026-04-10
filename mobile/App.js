import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
} from 'react-native-webrtc';
import { io } from 'socket.io-client';

export default function App() {
  const [localStream, setLocalStream] = useState(null);
  const [status, setStatus] = useState('Disconnected');
  const [ip, setIp] = useState('192.168.1.100'); // Default placeholder
  const [isLive, setIsLive] = useState(false);
  
  const peerConnection = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    startLocalStream();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (peerConnection.current) peerConnection.current.close();
    };
  }, []);

  const startLocalStream = async () => {
    const isFront = true;
    const devices = await mediaDevices.enumerateDevices();

    const facing = isFront ? 'front' : 'environment';
    const videoSourceId = devices.find(device => device.kind === 'videoinput' && device.facing === facing);
    const facingMode = isFront ? 'user' : 'environment';
    const constraints = {
      audio: true,
      video: {
        mandatory: {
          minWidth: 1280,
          minHeight: 720,
          minFrameRate: 30,
        },
        facingMode,
        optional: videoSourceId ? [{ sourceId: videoSourceId }] : [],
      },
    };

    try {
      const stream = await mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
    } catch (err) {
      console.error('Error getting user media:', err);
      setStatus('Media Error');
    }
  };

  const connectToDesktop = () => {
    if (!ip) return;
    
    setStatus('Connecting to ' + ip + '...');
    
    const socket = io(`http://${ip}:8080`);
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('Connected. Starting Stream...');
      startWebRTC();
    });

    socket.on('webrtc-message', async (data) => {
      if (data.type === 'answer') {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        setIsLive(true);
        setStatus('LIVE');
      } else if (data.type === 'candidate') {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Error adding ice candidate', e);
        }
      }
    });

    socket.on('disconnect', () => {
      setStatus('Disconnected');
      setIsLive(false);
    });
  };

  const startWebRTC = async () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnection.current = pc;

    // Add local stream tracks to peer connection
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('webrtc-message', {
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current.emit('webrtc-message', {
      type: 'offer',
      offer,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.title}>SynCam <Text style={styles.v2}>V2</Text></Text>
        <View style={[styles.statusBadge, isLive && styles.liveBadge]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      <View style={styles.videoContainer}>
        {localStream ? (
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Initializing Camera...</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {!isLive && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>PC IP Address:</Text>
            <TextInput
              style={styles.input}
              value={ip}
              onChangeText={setIp}
              placeholder="192.168.x.x"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.button} onPress={connectToDesktop}>
              <Text style={styles.buttonText}>START STREAMING</Text>
            </TouchableOpacity>
          </View>
        )}
        {isLive && (
          <TouchableOpacity 
            style={[styles.button, styles.stopButton]} 
            onPress={() => {
              socketRef.current?.disconnect();
              setIsLive(false);
              setStatus('Stopped');
            }}
          >
            <Text style={styles.buttonText}>STOP STREAM</Text>
          </TouchableOpacity>
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
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#f0f6fc',
    fontSize: 24,
    fontWeight: 'bold',
  },
  v2: {
    fontSize: 12,
    color: '#58a6ff',
  },
  statusBadge: {
    backgroundColor: '#161b22',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  liveBadge: {
    borderColor: '#238636',
  },
  statusText: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
  },
  videoContainer: {
    flex: 1,
    marginHorizontal: 15,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  localVideo: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#8b949e',
  },
  footer: {
    padding: 20,
  },
  inputGroup: {
    gap: 10,
  },
  label: {
    color: '#8b949e',
    fontSize: 14,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#161b22',
    color: '#f0f6fc',
    padding: 15,
    borderRadius: 12,
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  button: {
    backgroundColor: '#58a6ff',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  stopButton: {
    backgroundColor: '#da3633',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
