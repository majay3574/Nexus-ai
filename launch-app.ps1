$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$installedPath = Join-Path $env:LOCALAPPDATA "Programs\\Nexus Agent Studio\\Nexus Agent Studio.exe"
if (Test-Path $installedPath) {
  Start-Process $installedPath
  exit 0
}

$builtExe = Get-ChildItem -Path (Join-Path $root "dist-desktop") -Recurse -Filter "Nexus Agent Studio.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if ($builtExe) {
  Start-Process $builtExe.FullName
  exit 0
}

npm run dev:desktop
