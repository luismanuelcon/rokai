<#
.SYNOPSIS
  Recorta y optimiza una imagen para el hero del portal público.
.DESCRIPTION
  El hero es apaisado y la fuente suele ser cuadrada. Se recorta una banda
  horizontal centrada en el punto de interés y se reescala a un ancho apto
  para pantallas de alta densidad, con compresión JPEG.

  El recorte vertical se expresa como una fracción (0 = arriba, 1 = abajo)
  para poder reencuadrar sin tocar el resto del script.
#>
param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [int]$TargetWidth = 1200,
    [double]$AspectRatio = 1.79,
    [double]$FocusY = 0.58,
    [int]$Quality = 82
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$image = [System.Drawing.Image]::FromFile((Resolve-Path $Source))
try {
    Write-Host "Origen: $($image.Width)x$($image.Height)"

    $cropHeight = [Math]::Min($image.Height, [int]($image.Width / $AspectRatio))
    $cropWidth = [int]($cropHeight * $AspectRatio)
    $offsetX = [int](($image.Width - $cropWidth) / 2)
    $offsetY = [int]($image.Height * $FocusY - $cropHeight / 2)
    $offsetY = [Math]::Max(0, [Math]::Min($offsetY, $image.Height - $cropHeight))

    $targetHeight = [int]($TargetWidth / $AspectRatio)
    $canvas = New-Object System.Drawing.Bitmap($TargetWidth, $targetHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

    $destRect = New-Object System.Drawing.Rectangle(0, 0, $TargetWidth, $targetHeight)
    $graphics.DrawImage($image, $destRect, $offsetX, $offsetY, $cropWidth, $cropHeight,
        [System.Drawing.GraphicsUnit]::Pixel)

    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.MimeType -eq 'image/jpeg' }
    $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

    $canvas.Save((Join-Path (Split-Path -Parent $Destination) (Split-Path -Leaf $Destination)), $codec, $params)

    $sizeKb = [math]::Round((Get-Item $Destination).Length / 1KB)
    Write-Host "Recorte: ${cropWidth}x${cropHeight} desde y=$offsetY"
    Write-Host "Salida : ${TargetWidth}x${targetHeight}, ${sizeKb} KB" -ForegroundColor Green
}
finally {
    if ($graphics) { $graphics.Dispose() }
    if ($canvas) { $canvas.Dispose() }
    $image.Dispose()
}
