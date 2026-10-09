@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Need Node.js: https://nodejs.org
  pause
  exit /b 1
)
node server.mjs 8765
pause
