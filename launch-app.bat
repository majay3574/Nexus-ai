@echo off
setlocal

set ROOT=%~dp0
set EXE_INSTALLED=%LOCALAPPDATA%\Programs\Nexus Agent Studio\Nexus Agent Studio.exe

if exist "%EXE_INSTALLED%" (
  start "" "%EXE_INSTALLED%"
  exit /b 0
)

for /f "delims=" %%F in ('dir /b /s "%ROOT%dist-desktop\Nexus Agent Studio.exe" 2^>nul') do (
  start "" "%%F"
  exit /b 0
)

cd /d "%ROOT%"
npm run dev:desktop
