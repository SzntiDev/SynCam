/**
 * SynCam Foreground Service — Expo Config Plugin
 * 
 * Inyecta en AndroidManifest.xml:
 *  • Permisos FOREGROUND_SERVICE, FOREGROUND_SERVICE_CAMERA,
 *    FOREGROUND_SERVICE_MICROPHONE, WAKE_LOCK
 *  • Declaración del servicio SynCamForegroundService
 * 
 * Uso: agregar "./plugins/withSynCamForeground" al array "plugins" de app.json
 */

const { withAndroidManifest } = require('@expo/config-plugins');

function addPermission(manifest, permission) {
  if (!manifest['uses-permission']) manifest['uses-permission'] = [];
  const exists = manifest['uses-permission'].some(
    p => p.$?.['android:name'] === permission
  );
  if (!exists) {
    manifest['uses-permission'].push({ $: { 'android:name': permission } });
  }
}

function addService(application, serviceConfig) {
  if (!application.service) application.service = [];
  const name = serviceConfig.$['android:name'];
  const exists = application.service.some(s => s.$?.['android:name'] === name);
  if (!exists) application.service.push(serviceConfig);
}

const withSynCamForeground = (config) => {
  return withAndroidManifest(config, async (cfg) => {
    const manifest = cfg.modResults.manifest;
    const application = manifest.application[0];

    // ── Permisos necesarios ──────────────────────────────────
    const permissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_CAMERA',        // Android 14+
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',    // Android 14+
      'android.permission.WAKE_LOCK',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      'android.permission.POST_NOTIFICATIONS',               // Android 13+
    ];
    permissions.forEach(p => addPermission(manifest, p));

    // ── Declaración del servicio nativo ──────────────────────
    addService(application, {
      $: {
        'android:name':    '.SynCamForegroundService',
        'android:enabled': 'true',
        'android:exported': 'false',
        // Tipos requeridos en Android 14+ para ForegroundService
        'android:foregroundServiceType': 'camera|microphone',
      }
    });

    console.log('[SynCam Plugin] ForegroundService injected into AndroidManifest.xml ✓');
    return cfg;
  });
};

module.exports = withSynCamForeground;
