@echo off
cd /d "%~dp0"

echo [DX Training Editor] checking Playwright Chromium...
call npx playwright install chromium
if errorlevel 1 (
  echo failed to setup Playwright. please check Node.js and network.
  pause
  exit /b 1
)

start "" http://localhost:3000
npm run dev
