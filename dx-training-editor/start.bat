@echo off
cd /d "%~dp0"

if not exist node_modules (
  echo [DX Training Editor] node_modules not found. Running npm install...
  call npm install
  if errorlevel 1 (
    echo npm install failed. Please check Node.js installation.
    pause
    exit /b 1
  )
)

echo [DX Training Editor] Checking Playwright Chromium...
call npx playwright install chromium
if errorlevel 1 (
  echo Failed to install Playwright Chromium. Please check Node.js and network.
  pause
  exit /b 1
)

start "" http://localhost:3000
npm run dev
