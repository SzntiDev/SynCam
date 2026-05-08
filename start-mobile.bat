@echo off
title SynCam V2 - Mobile

echo.
echo ========================================
echo        SynCam V2 - Mobile (Android)
echo ========================================
echo.

:: --- Buscar Java (Android Studio o sistema) ---
set "JAVA_HOME_AS=C:\Program Files\Android\Android Studio\jbr"

if exist "%JAVA_HOME_AS%\bin\java.exe" (
    set "JAVA_HOME=%JAVA_HOME_AS%"
    echo [OK] Java encontrado en Android Studio.
) else if exist "%JAVA_HOME%\bin\java.exe" (
    echo [OK] Java del sistema encontrado.
) else (
    echo [WARN] Java no encontrado. Continuando...
)

set "PATH=%JAVA_HOME%\bin;%PATH%"
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"

:: --- Ir a la carpeta mobile ---
cd /d "%~dp0mobile"

echo.
echo OPCIONES DE EJECUCION:
echo -----------------------------------------
echo [1] Iniciar servidor JS + tunel USB (para usar la app ya instalada)
echo [2] Reinstalar app en el celular (primera vez o actualizacion)
echo.
set /p CHOICE="Elegi una opcion (1 o 2): "

if "%CHOICE%"=="1" goto :start_dev
if "%CHOICE%"=="2" goto :install_app

echo [ERROR] Opcion invalida.
pause
exit /b

:start_dev
echo.
echo [ADB] Activando tuneles USB...
"%ADB%" reverse tcp:8081 tcp:8081
"%ADB%" reverse tcp:8080 tcp:8080

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] No se pudo conectar al celular.
    echo  Verifica que:
    echo   - El celular este conectado por USB
    echo   - La depuracion USB este activada
    echo.
    pause
    exit /b
)

echo [OK] Puerto 8081 (Metro JS) redirigido.
echo [OK] Puerto 8080 (SynCam Server) redirigido.
echo.
echo [INFO] Iniciando servidor de desarrollo...
echo        Deja esta ventana abierta mientras usas la app.
echo        Abre la app en tu celular y toca RELOAD si hace falta.
echo.
npx.cmd expo start --port 8081
goto :end

:install_app
echo.
echo [INFO] Compilando e instalando en el dispositivo Android...
echo [INFO] Esta ventana debe quedar abierta despues de instalar.
echo.
:: Redirigir puertos antes de instalar
"%ADB%" reverse tcp:8081 tcp:8081
"%ADB%" reverse tcp:8080 tcp:8080
npx.cmd expo run:android
goto :end

:end
echo.
pause
