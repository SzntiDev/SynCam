@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"

if not exist "%JAVA_HOME%\bin\java.exe" (
    echo [ERROR] No se encontro Java en: %JAVA_HOME%
    pause
    exit /b
)

echo Iniciando SynCam V2 Mobile...
cd /d "%~dp0mobile"
npx.cmd expo run:android
pause
