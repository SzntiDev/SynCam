package com.syncam.app

import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

/**
 * SynCamForegroundModule
 * 
 * Puente React Native ↔ Android para controlar el Foreground Service
 * desde JavaScript (App.tsx).
 * 
 * Expuesto como: NativeModules.SynCamForeground en React Native
 */
class SynCamForegroundModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SynCamForeground"

    /**
     * Inicia el Foreground Service.
     * @param options Map con { quality: "HD" | "480p" | etc. }
     */
    @ReactMethod
    fun startService(options: ReadableMap) {
        val quality = if (options.hasKey("quality")) options.getString("quality") ?: "HD" else "HD"
        SynCamForegroundService.start(reactContext, quality)
    }

    /**
     * Detiene el Foreground Service y libera el WakeLock.
     */
    @ReactMethod
    fun stopService() {
        SynCamForegroundService.stop(reactContext)
    }

    /**
     * Verifica si el Build de Android soporta Foreground Service.
     * En versiones antiguas (< API 26) se ignora silenciosamente.
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun isSupported(): Boolean {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
    }
}
