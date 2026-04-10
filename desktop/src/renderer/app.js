/**
 * SynCam Desktop Renderer (app.js)
 * Maneja la UI y el renderizado en canvas de los frames recibidos
 */

// ==========================================
// Estado Global
// ==========================================
let currentPort = localStorage.getItem('syncam_port') || '8080';
let currentQuality = localStorage.getItem('syncam_quality') || '720p';
let localIpList = [];

// Estado de cámara (guardado en localstorage si "remember" está activo)
const rememberSettings = localStorage.getItem('syncam_remember') !== 'false';
const state = {
  rotation: rememberSettings ? parseInt(localStorage.getItem('syncam_rot') || '0', 10) : 0,
  baseRotation: 0, // Nueva propiedad para sincronizar con el móvil
  mirrorH: rememberSettings ? localStorage.getItem('syncam_mh') === 'true' : false,
  mirrorV: rememberSettings ? localStorage.getItem('syncam_mv') === 'true' : false,
  zoom: rememberSettings ? parseFloat(localStorage.getItem('syncam_z') || '1.0') : 1.0,
  isConnected: false
};

// Canvas
const canvas = document.getElementById('video-canvas');
const glCanvas = document.getElementById('gl-canvas');
const ctx = canvas.getContext('2d');
let currentImage = new Image();
let pendingRender = false;
let isImageReady = false;

// ==========================================
// RTX PRO ENGINE (WebGL2 GPU Rendering)
// ==========================================
class WebGLManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!this.gl) {
      console.error("WebGL2 no soportado. Usando Fallback 2D.");
      return;
    }

    this.program = this.createProgram(this.getVS(), this.getFS());
    this.initBuffers();
    this.texture = this.createTexture();
    this.params = { brightness: 1.0, contrast: 1.0, saturation: 1.0, sharpen: 0.0 };
  }

  getVS() {
    return `#version 300 es
      in vec2 a_position;
      in vec2 a_texCoord;
      out vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0, 1);
        v_texCoord = a_texCoord;
      }`;
  }

  getFS() {
    return `#version 300 es
      precision highp float;
      uniform sampler2D u_image;
      uniform vec2 u_textureSize;
      uniform float u_brightness;
      uniform float u_contrast;
      uniform float u_saturation;
      uniform float u_sharpen;
      in vec2 v_texCoord;
      out vec4 outColor;

      // RTX Pro v2: Contrast Adaptive Sharpening (CAS) approximate
      void main() {
        vec2 off = 1.0 / u_textureSize;
        
        // --- STEP 1: SMART DENOISE (3x3 Median-ish) ---
        vec3 c = texture(u_image, v_texCoord).rgb;
        vec3 n = texture(u_image, v_texCoord + vec2(0.0, -off.y)).rgb;
        vec3 s = texture(u_image, v_texCoord + vec2(0.0, off.y)).rgb;
        vec3 w = texture(u_image, v_texCoord + vec2(-off.x, 0.0)).rgb;
        vec3 e = texture(u_image, v_texCoord + vec2(off.x, 0.0)).rgb;
        
        // Soften noise by mixing slightly with neighbors
        vec3 soft = (c * 2.0 + n + s + w + e) / 6.0;
        vec3 finalColor = mix(c, soft, 0.3); // 30% denoise

        // --- STEP 2: CAS SHARPENING ---
        if (u_sharpen > 0.0) {
            // Sample diagonals for min/max
            vec3 nw = texture(u_image, v_texCoord + vec2(-off.x, -off.y)).rgb;
            vec3 ne = texture(u_image, v_texCoord + vec2(off.x, -off.y)).rgb;
            vec3 sw = texture(u_image, v_texCoord + vec2(-off.x, off.y)).rgb;
            vec3 se = texture(u_image, v_texCoord + vec2(off.x, off.y)).rgb;
            
            vec3 mn = min(min(min(min(c, n), s), w), e);
            vec3 mx = max(max(max(max(c, n), s), w), e);
            
            // Contrast Adaptive weight
            vec3 weight = clamp(min(mn, 1.0 - mx) / mx, 0.0, 1.0);
            vec3 sharp = c + (c * 4.0 - n - s - w - e) * (u_sharpen * weight);
            finalColor = mix(finalColor, sharp, 0.8);
        }

        // --- STEP 3: COLOR & LIGHT (RTX Tone Mapping) ---
        // Brightness
        finalColor *= u_brightness;

        // Contrast (S-Curve)
        finalColor = (finalColor - 0.5) * u_contrast + 0.5;
        
        // Saturation/Vibrance
        float luma = dot(finalColor, vec3(0.2126, 0.7152, 0.0722));
        finalColor = mix(vec3(luma), finalColor, u_saturation);

        outColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
      }`;
  }

  createProgram(vsSource, fsSource) {
    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
    }
    return program;
  }

  compileShader(type, source) {
    const s = this.gl.createShader(type);
    this.gl.shaderSource(s, source);
    this.gl.compileShader(s);
    return s;
  }

  initBuffers() {
    const gl = this.gl;
    // Full screen quad [-1, 1]
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);

    this.posVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posVbo);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    this.texVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texVbo);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  }

  createTexture() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  setParams(p) {
    this.params = { ...this.params, ...p };
  }

  render(image, rotation, mirrorH, mirrorV, zoom) {
    const gl = this.gl;
    if (!gl) return;

    const w = image.naturalWidth;
    const h = image.naturalHeight;
    const rotated = (rotation === 90 || rotation === 270);
    
    // Solo redimensionar si es necesario para evitar parpadeos y lag de layout
    const targetW = rotated ? h : w;
    const targetH = rotated ? w : h;
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    gl.useProgram(this.program);

    // Bind Attributes
    const posLoc = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posVbo);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texLoc = gl.getAttribLocation(this.program, "a_texCoord");
    gl.enableVertexAttribArray(texLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texVbo);
    
    // Calculate UVs for rotation/mirroring
    const uvs = this.getUVs(rotation, mirrorH, mirrorV, zoom);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    // Set Uniforms
    gl.uniform2f(gl.getUniformLocation(this.program, "u_textureSize"), w, h);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_brightness"), this.params.brightness);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_contrast"), this.params.contrast);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_saturation"), this.params.saturation);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_sharpen"), this.params.sharpen);

    // Upload Texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  getUVs(rot, mH, mV, zoom) {
    // Zoom factor: visible area is [0.5 - 0.5/z, 0.5 + 0.5/z]
    const d = 0.5 / zoom;
    let x1 = 0.5 - d, x2 = 0.5 + d;
    let y1 = 0.5 - d, y2 = 0.5 + d;

    if (mH) [x1, x2] = [x2, x1];
    if (mV) [y1, y2] = [y2, y1];

    // Standard order (0,1), (1,1), (0,0), (1,0) - flipped Y
    // Rotations (0, 90, 180, 270)
    if (rot === 0)   return new Float32Array([x1, y2, x2, y2, x1, y1, x2, y1]);
    if (rot === 90)  return new Float32Array([x1, y1, x1, y2, x2, y1, x2, y2]);
    if (rot === 180) return new Float32Array([x2, y1, x1, y1, x2, y2, x1, y2]);
    if (rot === 270) return new Float32Array([x2, y2, x2, y1, x1, y2, x1, y1]);
    return new Float32Array([x1, y2, x2, y2, x1, y1, x2, y1]);
  }
}

const webgl = new WebGLManager(glCanvas);

// QR Code instance
let qrInstance = null;

// FPS Counter
let frameCount = 0;
let lastFpsTime = Date.now();

// Elements
const connectInfoPort = document.getElementById('display-port');
const statBadge = document.getElementById('connection-badge');
const statStatusText = document.getElementById('connection-status-text');
const globalStatusDot = document.getElementById('global-status-dot');
const globalStatusText = document.getElementById('global-status-text');
const ipListContainer = document.getElementById('ip-list');

// Buttons
const btnDisconnect = document.getElementById('btn-disconnect');
const btnRotLeft = document.getElementById('btn-rotate-left');
const btnRotRight = document.getElementById('btn-rotate-right');
const btnMirrorH = document.getElementById('btn-mirror-h');
const btnMirrorV = document.getElementById('btn-mirror-v');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const zoomText = document.getElementById('zoom-text');


// ==========================================
// Inicialización
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  if (!window.syncam) {
    console.error("SynCam API no encontrada. Asegúrate de ejecutar esto en Electron.");
    return;
  }

  // Set window controls
  document.getElementById('btn-minimize').addEventListener('click', () => window.syncam.minimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.syncam.maximize());
  document.getElementById('btn-close').addEventListener('click', () => window.syncam.close());
  document.getElementById('btn-devtools').addEventListener('click', () => {
    // Hack to open devtools without changing main proxy
    const keyEvent = new KeyboardEvent('keydown', {key: 'I', ctrlKey: true, shiftKey: true});
    window.dispatchEvent(keyEvent);
  });

  // Setup Navigation
  setupNavigation();
  
  // Setup GPU Filters & Brightness (must be called to activate listeners)
  setupGPUFilters();

  // Setup Settings UI
  setupSettingsUI();

  // Load backend configurations
  await loadNetworkInfo();
  
  // Start WebSocket listening hooks (via preload)
  setupIPCHooks();

  // Draw initial state
  applyTransformsToUI();
  
  // FPS Loop
  setInterval(updateFPS, 1000);
});

// ==========================================
// IPC Hooks (Eventos desde el servidor)
// ==========================================
function setupIPCHooks() {
  window.syncam.onClientConnected(() => {
    state.isConnected = true;
    updateUIConnectionState(true);
    // Switch to Camera Panel automatically
    document.querySelector('.nav-item[data-target="panel-camera"]').click();
  });

  window.syncam.onClientDisconnected(() => {
    state.isConnected = false;
    updateUIConnectionState(false);
  });

  window.syncam.onServerStarted((info) => {
    if (info.port) {
      currentPort = info.port.toString();
      connectInfoPort.innerText = currentPort;
      document.getElementById('obs-url-text').innerText = `http://127.0.0.1:${currentPort}/obs.html`;
      generateQR();
    }
  });

  // --- Soporte Binario de Alta Velocidad (RTX Pro v2) ---
  let lastObjectURL = null;

  window.syncam.onFrameBin((payload) => {
    if (!state.isConnected) {
      state.isConnected = true;
      updateUIConnectionState(true);
    }

    // Rotación acumulada: base (móvil) + manual (pc)
    state.baseRotation = payload.rotation;
    state.mirrorH = payload.mirrorH;

    // 2. Create high-speed Blob URL
    if (lastObjectURL) URL.revokeObjectURL(lastObjectURL);
    
    const blob = new Blob([payload.buffer], { type: 'image/jpeg' });
    lastObjectURL = URL.createObjectURL(blob);

    currentImage.onload = () => {
      isImageReady = true;
      if (!pendingRender) {
        pendingRender = true;
        requestAnimationFrame(doRender);
      }
    };
    currentImage.src = lastObjectURL;
    frameCount++;
  });

  // Keep legacy support for base64
  window.syncam.onFrame((payload) => {
    if (!state.isConnected) {
      state.isConnected = true;
      updateUIConnectionState(true);
    }
    
    currentImage.onload = () => {
      isImageReady = true;
      if (!pendingRender) {
        pendingRender = true;
        requestAnimationFrame(doRender);
      }
    };
    
    const base64Frame = (typeof payload === 'string') ? payload : payload.frame;
    if (base64Frame.startsWith('data:')) {
      currentImage.src = base64Frame;
    } else {
      currentImage.src = 'data:image/jpeg;base64,' + base64Frame;
    }
    frameCount++;
  });
}

// ==========================================
// GPU Enhancer & Iluminación
// ==========================================
function setupGPUFilters() {
  const gpuSelect = document.getElementById('gpu-filter-level');
  const gpuBrightness = document.getElementById('gpu-brightness');

  // GPU Pro Engine Mapping (Mapping to GLSL Uniforms)
  const FILTER_PRESETS = {
    none: { contrast: 1.0, saturation: 1.0, sharpen: 0.0 },
    // Soft: Light enhancements (sutil, menos saturado que antes)
    soft: { contrast: 1.04, saturation: 1.05, sharpen: 0.20 },
    // Medium: Balanced Pro look
    med:  { contrast: 1.08, saturation: 1.10, sharpen: 0.45 },
    // Pro: Extreme clarity using GPU kernels sin arruinar los colores
    pro:  { contrast: 1.12, saturation: 1.15, sharpen: 0.80 },
  };

  const applyFilters = () => {
    const level = gpuSelect ? gpuSelect.value : 'none';
    const brightnessVal = gpuBrightness ? parseFloat(gpuBrightness.value) / 100 : 1.0;

    const preset = FILTER_PRESETS[level] || FILTER_PRESETS.none;
    
    // Update WebGL Engine state
    webgl.setParams({
      brightness: brightnessVal,
      contrast: preset.contrast,
      saturation: preset.saturation,
      sharpen: preset.sharpen
    });

    // Inyectar al servidor para que OBS reciba lo mismo
    syncTransformToServer();
  };

  if (gpuSelect) gpuSelect.addEventListener('change', applyFilters);
  if (gpuBrightness) gpuBrightness.addEventListener('input', applyFilters);

  // Apply default state
  applyFilters();
}

/**
 * Envía el estado actual (rotación, espejo, zoom Y FILTROS) al servidor local
 * para que las fuentes de OBS se mantengan sincronizadas.
 */
function syncTransformToServer() {
  if (!state.isConnected) return;
  
  const payload = {
    rotation:   state.rotation,
    mirrorH:    state.mirrorH,
    mirrorV:    state.mirrorV,
    zoom:       state.zoom,
    brightness: webgl.params.brightness,
    contrast:   webgl.params.contrast,
    saturation: webgl.params.saturation,
    sharpen:    webgl.params.sharpen
  };

  fetch(`http://127.0.0.1:${currentPort}/transform`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(e => console.error("Error syncing transform", e));
}

// ==========================================
// Navigation & Modals
// ==========================================
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.panel');

  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      navItems.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const targetPanel = document.getElementById(btn.getAttribute('data-target'));
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });
}
// OBS Handler logic removed as it was migrated entirely into the VCam controller at the end of the file.

function updateUIConnectionState(connected) {
  const badge = document.getElementById('connection-badge');
  const videoStats = document.getElementById('video-stats');
  const noSignal = document.getElementById('no-signal');
  
  if (connected) {
    globalStatusText.innerText = "Conectado";
    globalStatusDot.className = "status-dot connected";
    statStatusText.innerText = "Recibiendo señal";
    badge.classList.add('live');
    
    videoStats.style.display = 'flex';
    noSignal.style.display = 'none';
    canvas.style.display = 'block';
    btnDisconnect.disabled = false;
  } else {
    globalStatusText.innerText = "Esperando";
    globalStatusDot.className = "status-dot connecting";
    statStatusText.innerText = "Esperando señal...";
    badge.classList.remove('live');
    
    videoStats.style.display = 'none';
    noSignal.style.display = 'flex';
    canvas.style.display = 'none';
    btnDisconnect.disabled = true;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ==========================================
// Theme Manager & Palettes
// ==========================================
const THEMES = [
  { name: "SynCam Pro", bg: "#05050A", accent: "#8A2BE2" },
  { name: "Blanco y Negro", bg: "#1D1D1D", accent: "#FFFFFF" },
  { name: "Mandai", bg: "#1A2E20", accent: "#FFCC00" },
  { name: "Cube", bg: "#1D1D1D", accent: "#31EC56" },
  { name: "GolfSpace", bg: "#6E6E6E", accent: "#BAFF39" },
  { name: "Drone", bg: "#1D1D1D", accent: "#00ABE4" },
  { name: "Lime", bg: "#1D1D1D", accent: "#00DD00" },
  { name: "Wells", bg: "#323232", accent: "#DDD0C8" },
  { name: "Neuro Lab", bg: "#1D1D1D", accent: "#2272FF" },
  { name: "Journey", bg: "#2A2A2A", accent: "#F9B872" },
  { name: "Dousset", bg: "#213F99", accent: "#E1B0AC" },
  { name: "Empathy", bg: "#323232", accent: "#C5ADC5" },
  { name: "Nuecho", bg: "#0A192F", accent: "#64FFDA" },
  { name: "Uplink", bg: "#111439", accent: "#F8F8F9" },
  { name: "Hi Skin", bg: "#1D1D1D", accent: "#FF5100" },
  { name: "Blue Lagoon", bg: "#323232", accent: "#96C2DB" },
  { name: "Best Horror", bg: "#1D1D1D", accent: "#FF0000" },
  { name: "Stripe", bg: "#0A2540", accent: "#00D4FF" },
  { name: "Flow", bg: "#2D3748", accent: "#FDFD96" },
  { name: "Royal", bg: "#4A0E4E", accent: "#FFD700" },
  { name: "NatGeo", bg: "#2A363B", accent: "#2E8B57" },
  { name: "Gusto", bg: "#36454F", accent: "#FA8072" },
  { name: "Invision", bg: "#323232", accent: "#4682B4" },
  { name: "Pertinens", bg: "#323232", accent: "#F0122D" },
  { name: "Imprint", bg: "#0A192F", accent: "#4A8BDF" },
  { name: "Prinoth", bg: "#0C1A1A", accent: "#6ACFC7" },
  { name: "Circus", bg: "#1D1D1D", accent: "#FFAB00" },
  { name: "Mila", bg: "#323232", accent: "#FF5841" },
  { name: "K. Dake", bg: "#323232", accent: "#FFD700" },
  { name: "Mint", bg: "#2F4F4F", accent: "#98FF98" },
  { name: "Slack", bg: "#1D1D1D", accent: "#E01E5A" }
];

function setupSettingsUI() {
  const themeGrid = document.getElementById('theme-grid');
  if (themeGrid) {
    THEMES.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.className = 'theme-btn';
      btn.style.background = t.bg;
      btn.style.borderColor = t.accent;
      btn.title = t.name;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      
      btn.addEventListener('click', () => {
        applyTheme(i);
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        localStorage.setItem('syncam_theme_idx', i);
      });
      themeGrid.appendChild(btn);
    });

    // Cargar Tema Guardado
    const savedIdx = localStorage.getItem('syncam_theme_idx') || 0;
    applyTheme(savedIdx);
    setTimeout(() => {
        if(themeGrid.children[savedIdx]) {
            themeGrid.children[savedIdx].classList.add('active');
        }
    }, 100);
  }

  // Recordar vista y Red
  const inputPort = document.getElementById('setting-port');
  const inputQuality = document.getElementById('setting-quality');
  const inputTray = document.getElementById('setting-tray');
  const inputRemember = document.getElementById('setting-remember');
  const btnSave = document.getElementById('btn-save-network');

  if(inputPort) inputPort.value = currentPort;
  if(inputQuality) inputQuality.value = currentQuality;
  if(inputTray) inputTray.checked = localStorage.getItem('syncam_tray') === 'true';
  if(inputRemember) inputRemember.checked = rememberSettings;

  // Live quality change — sends command to mobile immediately
  if (inputQuality) {
    inputQuality.addEventListener('change', () => {
      const q = inputQuality.value;
      currentQuality = q;
      localStorage.setItem('syncam_quality', q);
      if (window.syncam && window.syncam.setQuality) {
        window.syncam.setQuality(q);
      }
      // Visual feedback
      const badge = inputQuality.parentElement?.querySelector('.quality-badge');
      if (badge) badge.innerText = '✓ Aplicado';
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      if(inputPort) localStorage.setItem('syncam_port', inputPort.value);
      if(inputQuality) localStorage.setItem('syncam_quality', inputQuality.value);
      if(inputTray) localStorage.setItem('syncam_tray', inputTray.checked);
      if(inputRemember) localStorage.setItem('syncam_remember', inputRemember.checked);
      
      alert("Configuración guardada. Reinicia para aplicar cambios de puerto.");
    });
  }
}

function applyTheme(idx) {
  const t = THEMES[idx];
  if(!t) return;
  const root = document.documentElement;
  root.style.setProperty('--bg-base', t.bg);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent-glow', t.accent + '66');
}
function doRender() {
  pendingRender = false;
  
  if (!isImageReady || !state.isConnected) return;
  isImageReady = false;

  const w = currentImage.naturalWidth;
  const h = currentImage.naturalHeight;
  if (w === 0 || h === 0) return;

  // Toggle visibility
  if (glCanvas.style.display === 'none') {
    glCanvas.style.display = 'block';
    document.getElementById('no-signal').style.display = 'none';
    document.getElementById('video-stats').style.display = 'flex';
  }

  // Use WebGL for high-performance rendering + Pro filters
  const finalRotation = ((state.baseRotation || 0) + (state.rotation || 0)) % 360;
  webgl.render(currentImage, finalRotation, state.mirrorH, state.mirrorV, state.zoom);
}

function updateFPS() {
  if (state.isConnected) {
    document.getElementById('fps-counter').innerText = `${frameCount} FPS`;
    frameCount = 0;
  }
}

// Modifiers Logic
function applyTransformsToUI() {
  btnMirrorH.classList.toggle('on', state.mirrorH);
  btnMirrorV.classList.toggle('on', state.mirrorV);
  zoomText.innerText = state.zoom.toFixed(1) + 'x';

  if (rememberSettings) {
    localStorage.setItem('syncam_rot', state.rotation);
    localStorage.setItem('syncam_mh', state.mirrorH);
    localStorage.setItem('syncam_mv', state.mirrorV);
    localStorage.setItem('syncam_z', state.zoom);
  }
}

btnRotLeft.addEventListener('click', () => {
  state.rotation = (state.rotation - 90 + 360) % 360;
  applyTransformsToUI();
});
btnRotRight.addEventListener('click', () => {
  state.rotation = (state.rotation + 90) % 360;
  applyTransformsToUI();
});
btnMirrorH.addEventListener('click', () => {
  state.mirrorH = !state.mirrorH;
  applyTransformsToUI();
});
btnMirrorV.addEventListener('click', () => {
  state.mirrorV = !state.mirrorV;
  applyTransformsToUI();
});
btnZoomIn.addEventListener('click', () => {
  state.zoom = Math.min(3.0, Number((state.zoom + 0.1).toFixed(1)));
  applyTransformsToUI();
});
btnZoomOut.addEventListener('click', () => {
  state.zoom = Math.max(1.0, Number((state.zoom - 0.1).toFixed(1)));
  applyTransformsToUI();
});

// Snapshot
document.getElementById('btn-snapshot').addEventListener('click', () => {
  if (!state.isConnected) return;
  // Capture from WebGL canvas to get GPU processed image
  const dataURL = glCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = `syncam_capture_${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

// Fullscreen
document.getElementById('btn-fullscreen').addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.getElementById('video-container').requestFullscreen().catch(err => {
      console.error(err);
    });
  } else {
    document.exitFullscreen();
  }
});

// Disconnect
btnDisconnect.addEventListener('click', async () => {
  if (confirm("¿Estás seguro de desconectar el dispositivo móvil?")) {
    state.isConnected = false;
    updateUIConnectionState(false);
    
    // Forzar caída de todos los websockets activos (móviles)
    if (window.syncam && window.syncam.disconnectAll) {
      await window.syncam.disconnectAll();
    }
  }
});

// ==========================================
// Network & Setup
// ==========================================
async function loadNetworkInfo() {
  connectInfoPort.innerText = currentPort;
  
  if (window.syncam && window.syncam.getNetworkInfo) {
    try {
      const response = await window.syncam.getNetworkInfo();
      localIpList = response.ips || [];
      if (response.port) {
        currentPort = response.port.toString();
        connectInfoPort.innerText = currentPort;
      }
      renderIpChips();
      generateQR();
    } catch (e) {
      console.error("Error getting network info", e);
      ipListContainer.innerHTML = `<div class="ip-chip error">Error obteniendo red local</div>`;
    }
  }
}

function renderIpChips() {
  ipListContainer.innerHTML = '';
  if (localIpList.length === 0) {
    ipListContainer.innerHTML = `<div class="ip-chip error">No se encontraron redes WiFi</div>`;
    return;
  }
  
  localIpList.forEach(ip => {
    const el = document.createElement('div');
    el.className = 'ip-chip';
    el.innerText = ip;
    el.title = "Haz clic para copiar";
    el.addEventListener('click', () => {
      navigator.clipboard.writeText(ip);
      const original = el.innerText;
      el.innerText = "¡Copiado!";
      setTimeout(() => el.innerText = original, 1500);
    });
    ipListContainer.appendChild(el);
  });
}

function generateQR() {
  if (localIpList.length === 0) return;
  
  // Preferamos la primera IP
  const payload = `syncam://${localIpList[0]}:${currentPort}`;
  const qrContainer = document.getElementById('qr-code');
  qrContainer.innerHTML = ''; // Limpiar anterior
  
  if (typeof QRCode !== 'undefined') {
    qrInstance = new QRCode(qrContainer, {
      text: payload,
      width: 180,
      height: 180,
      colorDark : "#000000",
      colorLight : "#ffffff",
      correctLevel : QRCode.CorrectLevel.L // Low para hacer el QR menos denso y fácil de leer rápido
    });
  } else {
    qrContainer.innerHTML = "<span style='color:#000;'>Error cargando librería QR</span>";
  }
}

// ADB Commands
document.getElementById('btn-adb-check').addEventListener('click', async () => {
  const statusEl = document.getElementById('adb-status');
  statusEl.innerText = "Buscando...";
  statusEl.className = "adb-status";
  
  if (window.syncam && window.syncam.adbCheck) {
    const devices = await window.syncam.adbCheck();
    const list = document.getElementById('devices-list');
    
    if (devices.length > 0) {
      statusEl.innerText = `${devices.length} dispositivo(s) ready.`;
      statusEl.className = "adb-status ok";
      
      // Auto-reverse al primer device
      window.syncam.adbReverse(currentPort);
      
      list.innerHTML = devices.map(d => `
        <div class="device-item">
          <div class="device-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
          </div>
          <div class="device-info">
            <span class="device-ip">${d}</span>
            <span class="device-time">Túnel activado en puerto ${currentPort}</span>
          </div>
          <div class="device-dot"></div>
        </div>
      `).join('');
    } else {
      statusEl.innerText = "No se detectaron USB (activa depuración).";
      statusEl.className = "adb-status error";
      list.innerHTML = `
        <div class="empty-devices">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>Asegúrate de aceptar el promp en tu celular</span>
        </div>
      `;
    }
  }
});

// Eliminated duplicate setupSettingsUI

// ==========================================
// 🎤 SynCam Audio Engine (PCM16 → Web Audio API)
// ==========================================
const SynCamAudio = (() => {
  // ── Constantes ──────────────────────────────────────────────
  const JITTER_BUFFER_SIZE = 3;   // Chunks en buffer antes de empezar a reproducir
  const DEFAULT_SAMPLE_RATE = 22050;

  // ── Estado interno ──────────────────────────────────────────
  let audioCtx        = null;     // AudioContext (lazy init)
  let gainNode        = null;     // Control de volumen
  let nextPlayTime    = 0;        // Reloj de scheduling (AudioContext)
  let jitterBuffer    = [];       // Cola de AudioBuffers esperando ser reproducidos
  let isBuffering     = true;     // true = llenando jitter buffer inicial
  let isMuted         = false;    // Estado de mute
  let currentVolume   = 0.85;     // Volumen inicial (0.0 – 1.0)
  let lastSampleRate  = DEFAULT_SAMPLE_RATE;

  // ── Inicialización lazy del AudioContext ────────────────────
  function ensureContext(sampleRate) {
    if (audioCtx && audioCtx.sampleRate === sampleRate) return;
    if (audioCtx) audioCtx.close();

    audioCtx = new AudioContext({ sampleRate, latencyHint: 'interactive' });
    gainNode = audioCtx.createGain();
    gainNode.gain.value = isMuted ? 0 : currentVolume;
    gainNode.connect(audioCtx.destination);

    nextPlayTime = audioCtx.currentTime;
    lastSampleRate = sampleRate;
    console.log(`[SynCamAudio] AudioContext @ ${sampleRate}Hz`);
  }

  // ── PCM16 Int16 → Float32 (rango -1.0 .. 1.0) ─────────────
  // Operación de mayor coste — se hace en el hilo del renderer
  // (sin bloquear UI gracias a que Web Audio schedula en otro thread)
  function pcm16ToFloat32(pcmBuffer) {
    // pcmBuffer es un Buffer de Node/Electron → convertir a Int16Array
    const int16 = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }
    return float32;
  }

  // ── Encolar y reproducir ────────────────────────────────────
  function enqueueChunk(pcmBuffer, sampleRate) {
    ensureContext(sampleRate);

    // Convertir PCM16 a Float32
    const float32 = pcm16ToFloat32(pcmBuffer);
    if (float32.length === 0) return;

    // Crear AudioBuffer mono con los samples
    const audioBuffer = audioCtx.createBuffer(1, float32.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32);
    jitterBuffer.push(audioBuffer);

    // Llenar el jitter buffer antes de empezar a reproducir (evita cortes iniciales)
    if (isBuffering) {
      if (jitterBuffer.length >= JITTER_BUFFER_SIZE) {
        isBuffering = false;
        nextPlayTime = audioCtx.currentTime; // Sincronizar reloj
        // Vaciar el buffer acumulado
        while (jitterBuffer.length > 0) {
          scheduleBuffer(jitterBuffer.shift());
        }
      }
      return;
    }

    // Modo normal: reproducir inmediatamente con scheduling de alta precisión
    scheduleBuffer(jitterBuffer.shift() || audioBuffer);
  }

  // ── Scheduling preciso con AudioContext clock ───────────────
  function scheduleBuffer(audioBuffer) {
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);

    // Si el reloj se atrasó (por pausa o tab focus loss), resincronizar
    if (nextPlayTime < audioCtx.currentTime) {
      nextPlayTime = audioCtx.currentTime + 0.02; // 20ms de headroom
    }

    source.start(nextPlayTime);
    nextPlayTime += audioBuffer.duration;
  }

  // ── API Pública ─────────────────────────────────────────────
  function setVolume(vol) {
    currentVolume = Math.max(0, Math.min(1, vol));
    if (gainNode) gainNode.gain.setTargetAtTime(isMuted ? 0 : currentVolume, audioCtx.currentTime, 0.015);
  }

  function setMuted(muted) {
    isMuted = muted;
    if (gainNode) gainNode.gain.setTargetAtTime(muted ? 0 : currentVolume, audioCtx.currentTime, 0.015);
  }

  function reset() {
    jitterBuffer = [];
    isBuffering  = true;
    if (audioCtx) {
      nextPlayTime = audioCtx.currentTime;
    }
  }

  return { enqueueChunk, setVolume, setMuted, reset };
})();

// ── Conectar SynCamAudio al IPC ─────────────────────────────
if (window.syncam && window.syncam.onAudioChunk) {
  window.syncam.onAudioChunk((payload) => {
    // payload = { buffer: Buffer, sampleRate: number, ts: number }
    if (payload && payload.buffer) {
      SynCamAudio.enqueueChunk(payload.buffer, payload.sampleRate || 22050);
    }
  });
}

// ── Controles de Audio en la UI ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const btnMute = document.getElementById('btn-audio-mute');
  const sliderVol = document.getElementById('audio-volume');
  const audioIndicator = document.getElementById('audio-indicator');

  if (btnMute) {
    btnMute.addEventListener('click', () => {
      const muted = btnMute.classList.toggle('muted');
      SynCamAudio.setMuted(muted);
      if (audioIndicator) audioIndicator.classList.toggle('muted', muted);
    });
  }

  if (sliderVol) {
    sliderVol.addEventListener('input', () => {
      SynCamAudio.setVolume(parseFloat(sliderVol.value) / 100);
    });
  }
});

// ==========================================
// 📺 Virtual Camera Panel Controller (Hito 3)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  if (!window.syncam) return;

  let detectedDriver = null;  // Nombre del driver encontrado

  // ── Actualizar URL MJPEG cuando arranca el servidor ──────────
  window.syncam.onServerStarted((info) => {
    if (info?.port) {
      const url = `http://127.0.0.1:${info.port}/stream.mjpeg`;
      const el = document.getElementById('mjpeg-url-text');
      if (el) el.innerText = url;
    }
  });

  // ── Copiar URL MJPEG ─────────────────────────────────────────
  document.getElementById('btn-copy-mjpeg')?.addEventListener('click', () => {
    const url = document.getElementById('mjpeg-url-text')?.innerText?.trim();
    if (url) {
      navigator.clipboard.writeText(url);
      const btn = document.getElementById('btn-copy-mjpeg');
      const orig = btn.innerText;
      btn.innerText = '¡Copiado!';
      setTimeout(() => btn.innerText = orig, 2000);
    }
  });

  // ── Detectar ffmpeg + drivers ─────────────────────────────────
  document.getElementById('btn-vcam-check')?.addEventListener('click', async () => {
    const resultDiv = document.getElementById('vcam-check-result');
    const btnStart  = document.getElementById('btn-vcam-start');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '⏳ Detectando...';

    try {
      const info = await window.syncam.vcamCheck();

      let html = '';

      // ffmpeg status
      if (info.ffmpeg?.available) {
        html += `✅ <strong>ffmpeg</strong> v${info.ffmpeg.version} encontrado<br>`;
      } else {
        html += `❌ <strong>ffmpeg</strong> no encontrado. `
              + `<a href="https://www.gyan.dev/ffmpeg/builds/" target="_blank" `
              + `style="color:var(--accent-light);">Descargar ffmpeg</a> y colocar `
              + `ffmpeg.exe en <code>desktop/bin/</code><br>`;
      }

      // Driver status
      if (info.driverFound) {
        detectedDriver = info.driverName;
        html += `✅ <strong>Driver:</strong> ${info.driverName}<br>`;
        document.getElementById('vcam-driver-name').innerText = `Driver: "${info.driverName}"`;
      } else {
        html += `❌ <strong>Sin driver:</strong> Instala OBS Virtual Camera o Unity Capture.`;
        document.getElementById('vcam-driver-name').innerText = '';
      }

      resultDiv.innerHTML = html;

      // Habilitar botón solo si ambos disponibles
      if (btnStart) {
        btnStart.disabled = !(info.ffmpeg?.available && info.driverFound);
      }
    } catch (e) {
      resultDiv.innerHTML = `❌ Error: ${e.message}`;
    }
  });

  // ── Activar Virtual Camera Bridge ────────────────────────────
  document.getElementById('btn-vcam-start')?.addEventListener('click', async () => {
    const badge    = document.getElementById('vcam-status-badge');
    const statusTx = document.getElementById('vcam-status-text');
    const btnStart = document.getElementById('btn-vcam-start');
    const btnStop  = document.getElementById('btn-vcam-stop');

    statusTx.innerText = 'Iniciando...';
    btnStart.disabled  = true;

    const result = await window.syncam.vcamStart({ deviceName: detectedDriver });

    if (result.ok) {
      statusTx.innerText = `Activa (PID ${result.pid})`;
      if (badge) badge.classList.add('live');
      btnStop.disabled   = false;
      btnStart.disabled  = true;
    } else {
      statusTx.innerText = 'Error: ' + result.error;
      btnStart.disabled  = false;
    }
  });

  // ── Detener Virtual Camera Bridge ────────────────────────────
  document.getElementById('btn-vcam-stop')?.addEventListener('click', async () => {
    await window.syncam.vcamStop();
    const badge    = document.getElementById('vcam-status-badge');
    const statusTx = document.getElementById('vcam-status-text');
    const btnStart = document.getElementById('btn-vcam-start');
    const btnStop  = document.getElementById('btn-vcam-stop');

    statusTx.innerText = 'Inactiva';
    if (badge) badge.classList.remove('live');
    btnStop.disabled  = true;
    btnStart.disabled = !detectedDriver;
  });

  // ── Link Unity Capture ───────────────────────────────────────
  document.getElementById('link-unity-capture')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.syncam && window.syncam.openLink) {
      window.syncam.openLink('https://github.com/schellingb/UnityCapture/releases');
    }
  });

  // ── Polling: contador de clientes MJPEG ──────────────────────
  setInterval(async () => {
    try {
      if (!window.syncam?.vcamStatus) return;
      const st = await window.syncam.vcamStatus();
      const txt = document.getElementById('mjpeg-clients-text');
      const dot = document.getElementById('mjpeg-clients-dot');
      if (txt) txt.innerText = `${st.mjpegClients} cliente(s) MJPEG conectado(s)`;
      if (dot) dot.className = `status-dot${st.mjpegClients > 0 ? ' connected' : ''}`;
    } catch (_) {}
  }, 3000);

  // ── OBS Automático vía WebSocket ──────────────────────────────
  document.getElementById('btn-obs-auto')?.addEventListener('click', async () => {
    const pwd = document.getElementById('obs-pwd').value || "";
    const status = document.getElementById('obs-auto-status');
    status.style.color = "var(--text-muted)";
    status.innerText = "Conectando al puerto 4455...";
    
    if (window.syncam && window.syncam.obsLink) {
      const result = await window.syncam.obsLink(pwd, currentPort);
      if (result.success) {
        status.style.color = "var(--success)";
        status.innerText = "¡Fuente SynCam añadida a tu escena actual en OBS!";
      } else {
        status.style.color = "var(--danger)";
        status.innerText = "Fallo: " + result.error;
      }
    } else {
      status.innerText = "API no disponible.";
    }
  });

});
