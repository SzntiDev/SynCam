package com.syncam.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * SynCamForegroundPackage
 * 
 * Registra el módulo nativo en el sistema de paquetes de React Native.
 * Debe ser añadido en MainApplication.kt/java:
 * 
 *   override fun getPackages() = PackageList(this).packages.apply {
 *     add(SynCamForegroundPackage())
 *   }
 */
class SynCamForegroundPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(SynCamForegroundModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
