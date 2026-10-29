<#
.SYNOPSIS
  Reproduce el recorte de `object-fit: cover` + `object-position` sobre una imagen,
  para revisar el encuadre de cada proporción sin depender del navegador.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Source,
  [Parameter(Mandatory)][string]$OutDir,
  [double]$PositionX = 0.5,
  [double]$PositionY = 0.5,
  [Parameter(Mandatory)][int[]]$SlotWidth,
  [Parameter(Mandatory)][int[]]$SlotHeight,
  [string[]]$Label
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if ($SlotWidth.Count -ne $SlotHeight.Count) {
  throw 'SlotWidth y SlotHeight deben tener la misma cantidad de valores.'
}
if (-not (Test-Path -LiteralPath $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$src = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $Source).Path)
try {
  $sourceRatio = $src.Width / $src.Height
  for ($i = 0; $i -lt $SlotWidth.Count; $i++) {
    $w = $SlotWidth[$i]
    $h = $SlotHeight[$i]
    $name = if ($Label -and $Label.Count -gt $i) { $Label[$i] } else { "${w}x${h}" }

    $slotRatio = $w / $h
    if ($slotRatio -gt $sourceRatio) {
      $visibleW = [double]$src.Width
      $visibleH = $src.Width / $slotRatio
    }
    else {
      $visibleH = [double]$src.Height
      $visibleW = $src.Height * $slotRatio
    }
    $x = ($src.Width - $visibleW) * $PositionX
    $y = ($src.Height - $visibleH) * $PositionY

    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $dest = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
      $g.DrawImage($src, $dest, [single]$x, [single]$y, [single]$visibleW, [single]$visibleH, [System.Drawing.GraphicsUnit]::Pixel)
    }
    finally {
      $g.Dispose()
    }

    $out = Join-Path $OutDir "_slot-$name.png"
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    $cutTop = [math]::Round($y)
    $cutBottom = [math]::Round($src.Height - $visibleH - $y)
    $cutLeft = [math]::Round($x)
    $cutRight = [math]::Round($src.Width - $visibleW - $x)
    Write-Host ("{0,-12} {1}x{2} (r={3:N2})  recorte  arriba={4} abajo={5} izq={6} der={7}" -f $name, $w, $h, $slotRatio, $cutTop, $cutBottom, $cutLeft, $cutRight)
  }
}
finally {
  $src.Dispose()
}
