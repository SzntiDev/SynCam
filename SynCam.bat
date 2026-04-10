@echo off
setlocal
echo ===================================
echo =        SynCam Desktop           =
echo ===================================
echo.

:: Forzar Node.js en el PATH para evitar el error de npm/node no reconocido
set PATH=C:\Users\santi\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.22_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v22.22.2-win-x64;%PATH%
:: Limpiar variable riesgosa que interfiere con Electron si esta presente
set ELECTRON_RUN_AS_NODE=

:: Moverse a la carpeta desktop
cd /d "%~dp0desktop"

echo [1/2] Verificando dependencias...
if not exist "node_modules\" (
    echo Instalando npm packages...
    call npm install
)

echo [2/2] Iniciando aplicacion...
call npm start

echo.
echo ===================================
echo = Aplicacion principal finalizada =
echo ===================================
pause
