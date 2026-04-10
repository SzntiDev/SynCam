@echo off
:: Solicitar permisos de Administrador
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Tienes permisos de Administrador.
) else (
    echo Pidiendo permisos de administrador a Windows...
    powershell -Command "Start-Process cmd -ArgumentList '/c %~dpnx0' -Verb RunAs"
    exit /b
)

echo ===========================================
echo = Arreglando Firewall para SynCam y Expo =
echo ===========================================
echo.

echo Abriendo el puerto 8081 para Expo (Celular)...
netsh advfirewall firewall add rule name="Expo Local 8081" dir=in action=allow protocol=TCP localport=8081 >nul 2>&1

echo Abriendo el puerto 8080 para SynCam (Escritorio)...
netsh advfirewall firewall add rule name="SynCam Local 8080" dir=in action=allow protocol=TCP localport=8080 >nul 2>&1

echo Configurando tu red Wi-Fi detectada como Privada (para evitar bloqueos)...
powershell -Command "Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' } | Set-NetConnectionProfile -NetworkCategory Private" >nul 2>&1

echo.
echo Listo! Los puertos ya estan abiertos. 
echo Por favor cierra Expo Go en tu celular, cierra el comando de la compu, y vuelvelos a abrir.
echo.
pause
