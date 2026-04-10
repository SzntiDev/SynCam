Add-Type -AssemblyName System.Drawing
$path1 = "C:\Users\Santi\Desktop\SynCam\mobile\assets\icon.png"
$path2 = "C:\Users\Santi\Desktop\SynCam\mobile\assets\adaptive-icon.png"
$out1 = "C:\Users\Santi\Desktop\SynCam\mobile\assets\icon_clean.png"
$out2 = "C:\Users\Santi\Desktop\SynCam\mobile\assets\adaptive_clean.png"

try {
  $img1 = [System.Drawing.Image]::FromFile($path1)
  $img1.Save($out1, [System.Drawing.Imaging.ImageFormat]::Png)
  $img1.Dispose()
  Move-Item -Force $out1 $path1

  $img2 = [System.Drawing.Image]::FromFile($path2)
  $img2.Save($out2, [System.Drawing.Imaging.ImageFormat]::Png)
  $img2.Dispose()
  Move-Item -Force $out2 $path2
  
  Write-Host "Success! Converted JPG to true PNG."
} catch {
  Write-Host "Error converting: $_"
}
