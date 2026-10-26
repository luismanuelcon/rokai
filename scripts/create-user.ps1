<#
.SYNOPSIS
  Crea un usuario del portal de gestión.
.DESCRIPTION
  Invoca el CLI de Node directamente. `npm run create-user -- ...` NO sirve en
  Windows: el shim de npm pasa por cmd.exe y escapa los argumentos entrecomillados
  insertando '^', con lo que el nombre se guarda corrupto.

  La contraseña se pide por consola y nunca viaja como argumento ni queda en el
  historial del shell.
.EXAMPLE
  .\scripts\create-user.ps1 -Email admin@rokai.local -Name "Luis M" -Role admin
#>
param(
    [Parameter(Mandatory = $true)][string]$Email,
    [Parameter(Mandatory = $true)][string]$Name,
    [ValidateSet('admin', 'worker', 'operator')][string]$Role = 'admin'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$node = 'C:\MEDEV\tools\node22\node.exe'
$cli = Join-Path $root 'apps\api\dist\cli\create-user.js'

if (-not (Test-Path $cli)) {
    throw "Falta $cli. Ejecuta primero: npm run build --workspace @rokai/api"
}

$secure = Read-Host -Prompt 'Contrasena (12 caracteres como minimo)' -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

try {
    $env:ROKAI_PASSWORD = $plain
    & $node "--env-file-if-exists=$root\.env" $cli $Email $Name $Role
}
finally {
    $env:ROKAI_PASSWORD = $null
    $plain = $null
    [GC]::Collect()
}
