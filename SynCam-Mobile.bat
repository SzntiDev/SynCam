@echo off
setlocal
echo ===================================
echo =        SynCam Mobile            =
echo ===================================
echo.

:: Forzar Node.js 22 (LTS compatible con Expo SDK 54) en el PATH
set PATH=C:\Users\santi\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.22_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v22.22.2-win-x64;%PATH%
set ELECTRON_RUN_AS_NODE=

:: Moverse a la carpeta mobile
cd /d "%~dp0mobile"

echo [1/3] Node version:
node --version

echo [2/3] Verificando dependencias...
if not exist "node_modules\" (
    echo Instalando...
    call npm.cmd install
)

call npx.cmd expo start --lan -c

echo.
echo ===================================
echo = El servidor de desarrollo cayo  =
echo ===================================
pause
