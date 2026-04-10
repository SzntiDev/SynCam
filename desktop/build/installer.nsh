!macro customInstall
  DetailPrint "Registrando Controlador de Cámara Virtual de SynCam (Nativo)..."
  ; Registra la DLL pre-compilada silenciosamente (/s) al instalar
  ExecWait 'regsvr32.exe /s "$INSTDIR\bin\obs-virtualsource.dll"'
!macroend

!macro customUnInstall
  DetailPrint "Desinstalando Controlador de Cámara Virtual..."
  ; Elimina la cámara del sistema al desinstalar
  ExecWait 'regsvr32.exe /s /u "$INSTDIR\bin\obs-virtualsource.dll"'
!macroend
