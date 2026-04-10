/**
 * SynCamForeground — JS/TS wrapper
 * 
 * Interfaz TypeScript para el módulo nativo SynCamForegroundModule.
 * Proporciona una API limpia con fallback graceful para iOS/Expo Go.
 * 
 * Uso en App.tsx:
 *   import SynCamForeground from './modules/SynCamForeground';
 *   SynCamForeground.start('HD');
 *   SynCamForeground.stop();
 */

import { NativeModules, Platform } from 'react-native';

type ForegroundOptions = {
  quality?: string;
};

type SynCamForegroundType = {
  start: (quality?: string) => void;
  stop: () => void;
  isSupported: () => boolean;
};

// En Expo Go o iOS el módulo nativo no existe — fallback no-op
const nativeModule = NativeModules.SynCamForeground;

const SynCamForeground: SynCamForegroundType = {
  /**
   * Inicia el Foreground Service con la calidad indicada.
   * En entornos no compatibles (iOS, Expo Go) actúa como no-op.
   */
  start(quality: string = 'HD') {
    if (Platform.OS !== 'android' || !nativeModule) {
      console.log('[ForegroundService] No disponible en esta plataforma. Ignorando.');
      return;
    }
    try {
      nativeModule.startService({ quality });
    } catch (e) {
      console.warn('[ForegroundService] Error al iniciar:', e);
    }
  },

  /**
   * Detiene el Foreground Service y libera el WakeLock.
   */
  stop() {
    if (Platform.OS !== 'android' || !nativeModule) return;
    try {
      nativeModule.stopService();
    } catch (e) {
      console.warn('[ForegroundService] Error al detener:', e);
    }
  },

  /**
   * Retorna true si el dispositivo soporta Foreground Services (Android 8+).
   */
  isSupported(): boolean {
    if (Platform.OS !== 'android' || !nativeModule) return false;
    try {
      return nativeModule.isSupported();
    } catch {
      return false;
    }
  },
};

export default SynCamForeground;
