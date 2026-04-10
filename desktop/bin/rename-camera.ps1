# Script para Renombrar OBS Virtual Camera a SynCam Virtual Camera
# Requiere ejecución como ADMINISTRADOR.

$oldName = "OBS Virtual Camera"
$newName = "SynCam Virtual Camera"

Write-Host "--- SynCam Camera Renamer ---" -ForegroundColor Cyan
Write-Host "Buscando instancias en el registro de Windows..."

# Buscar todas las claves 'FriendlyName' que contengan el nombre viejo
$paths = Get-ChildItem -Path HKLM:\SYSTEM\CurrentControlSet\Control\DeviceClasses -Recurse -ErrorAction SilentlyContinue | 
         Where-Object { $_.Property -contains "FriendlyName" }

$count = 0

foreach ($p in $paths) {
    $val = Get-ItemProperty -Path $p.PSPath -Name "FriendlyName" -ErrorAction SilentlyContinue
    if ($val.FriendlyName -like "*$oldName*") {
        Write-Host "Encontrado en: $($p.Name)" -ForegroundColor Yellow
        try {
            Set-ItemProperty -Path $p.PSPath -Name "FriendlyName" -Value $newName
            Write-Host ">> ¡Cambiado a $newName!" -ForegroundColor Green
            $count++
        } catch {
            Write-Host ">> ERROR: No se pudo cambiar. ¿Estás como Administrador?" -ForegroundColor Red
        }
    }
}

if ($count -gt 0) {
    Write-Host "`nTerminado: Se han modificado $count entradas." -ForegroundColor Cyan
    Write-Host "REINICIA OBS Y DISCORD para ver los cambios." -ForegroundColor White
} else {
    Write-Host "`nNo se encontraron entradas de '$oldName'. Asegúrate de tener el Virtual Cam de OBS instalado." -ForegroundColor Gray
}

Write-Host "`nPresiona cualquier tecla para salir..."
$x = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
