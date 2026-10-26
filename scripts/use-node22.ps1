<#
.SYNOPSIS
  Activa Node 22 solo en la sesion actual de PowerShell.
.DESCRIPTION
  ROKAI requiere Node 22 LTS, pero el resto de proyectos de esta maquina usan
  Node 20, que sigue siendo el predeterminado del sistema. Este script no
  modifica el PATH persistente: al cerrar la terminal todo vuelve a Node 20.

  Dentro de VS Code no hace falta ejecutarlo: .vscode/settings.json ya inyecta
  Node 22 en las terminales abiertas en este workspace.
.EXAMPLE
  . .\scripts\use-node22.ps1
#>

$Node22 = 'C:\MEDEV\tools\node22'

if (-not (Test-Path (Join-Path $Node22 'node.exe'))) {
    throw "No se encontro Node 22 en $Node22."
}

$env:Path = "$Node22;$env:Path"
Write-Host "Node $(& "$Node22\node.exe" -v) activado solo en esta sesion." -ForegroundColor Green
Write-Host "El PATH persistente sigue apuntando a Node 20." -ForegroundColor DarkGray
