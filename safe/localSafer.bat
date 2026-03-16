@echo off
setlocal
set "OLLAMA_ORIGINS=https://nexus-ai-il1c.onrender.com"
taskkill /IM ollama.exe /F >nul 2>&1
ollama serve
pause
endlocal
