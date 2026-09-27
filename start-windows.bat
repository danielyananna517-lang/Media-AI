@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 20+ is required.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)
start "Media AI Server" cmd /k "cd /d \"%~dp0\" && node --env-file-if-exists=.env server.mjs"
timeout /t 2 /nobreak >nul
start "Media AI" http://127.0.0.1:3777/creative
endlocal
