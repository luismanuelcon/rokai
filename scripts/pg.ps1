<#
.SYNOPSIS
  Controla el servidor PostgreSQL local de desarrollo.
.EXAMPLE
  .\scripts\pg.ps1 start
  .\scripts\pg.ps1 status
  .\scripts\pg.ps1 stop
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'log')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'

$PgCtl = 'C:\MEDEV\tools\pgsql\bin\pg_ctl.exe'
$DataDir = 'C:\MEDEV\data\pg16'
$LogFile = 'C:\MEDEV\data\logs\pg16.log'

if (-not (Test-Path $PgCtl)) {
    throw "No se encontro pg_ctl en $PgCtl. Reinstala PostgreSQL portable."
}

switch ($Action) {
    'start' { & $PgCtl -D $DataDir -l $LogFile -w start }
    'stop' { & $PgCtl -D $DataDir -m fast -w stop }
    'restart' { & $PgCtl -D $DataDir -l $LogFile -m fast -w restart }
    'status' { & $PgCtl -D $DataDir status }
    'log' { Get-Content $LogFile -Tail 40 }
}
