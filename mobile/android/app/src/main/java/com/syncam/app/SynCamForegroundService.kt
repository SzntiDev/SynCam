package com.syncam.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

/**
 * SynCamForegroundService
 * 
 * Servicio Android de primer plano que mantiene la transmisión de cámara
 * y micrófono activa incluso cuando:
 *   - El usuario navega a otra app
 *   - La pantalla se bloquea
 *   - El sistema intenta matar el proceso por memoria
 * 
 * Requisito: declarado en AndroidManifest.xml vía el config plugin de Expo.
 */
class SynCamForegroundService : Service() {

    companion object {
        const val CHANNEL_ID      = "syncam_foreground_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START    = "com.syncam.FOREGROUND_START"
        const val ACTION_STOP     = "com.syncam.FOREGROUND_STOP"

        /** Inicia el servicio desde cualquier contexto */
        fun start(context: Context, qualityLabel: String = "HD") {
            val intent = Intent(context, SynCamForegroundService::class.java).apply {
                action = ACTION_START
                putExtra("quality", qualityLabel)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        /** Detiene el servicio */
        fun stop(context: Context) {
            val intent = Intent(context, SynCamForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    // WakeLock CPU: mantiene el procesador activo (red + audio requieren CPU)
    private var wakeLock: PowerManager.WakeLock? = null

    // ── lifecycle ────────────────────────────────────────────

    override fun onBind(intent: Intent?): IBinder? = null // No es un BoundService

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val quality = intent.getStringExtra("quality") ?: "HD"
                promoteToForeground(quality)
                acquireWakeLock()
            }
            ACTION_STOP -> {
                releaseWakeLock()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        // START_STICKY: Android reinicia el servicio si lo mata
        return START_STICKY
    }

    override fun onDestroy() {
        releaseWakeLock()
        super.onDestroy()
    }

    // ── Notificación permanente ──────────────────────────────

    /**
     * Promueve el servicio a "Foreground" con una notificación persistente.
     * La notificación es necesaria: Android 8+ la exige y el usuario la ve
     * en la barra de sistema como señal de que la app está transmitiendo.
     */
    private fun promoteToForeground(quality: String) {
        val notification = buildNotification(quality)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+: declarar explícitamente los tipos de foreground service
            val serviceType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            } else {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
            }
            startForeground(NOTIFICATION_ID, notification, serviceType)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun buildNotification(quality: String): Notification {
        // Intent para abrir la app al tocar la notificación
        val openAppIntent = packageManager
            .getLaunchIntentForPackage(packageName)
            ?.apply { flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP }

        val pendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Intent para detener desde la notificación
        val stopIntent = Intent(this, SynCamForegroundService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPending = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("📷 SynCam — Transmitiendo")
            .setContentText("Cámara activa ($quality) · Toca para abrir")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Detener", stopPending)
            .setOngoing(true)           // No deslizable por el usuario
            .setSilent(true)            // Sin sonido al mostrar
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    // ── Canal de notificación ────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            "SynCam Cámara Activa",
            NotificationManager.IMPORTANCE_LOW  // Sin sonido, sin vibración
        ).apply {
            description = "Indica que SynCam está transmitiendo en segundo plano"
            setShowBadge(false)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }

        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    // ── WakeLock ─────────────────────────────────────────────

    /**
     * PARTIAL_WAKE_LOCK: Mantiene el CPU corriendo sin encender la pantalla.
     * Necesario para que el WebSocket y el audio sigan transmitiendo.
     */
    private fun acquireWakeLock() {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "SynCam:StreamingWakeLock"
        ).also {
            it.acquire(4 * 60 * 60 * 1000L) // Máx 4 horas de protección
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        wakeLock = null
    }
}
