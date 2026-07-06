@echo off
cd /d "%~dp0"

if not exist node_modules (
  echo [DX Training Studio] node_modules not found. Running npm install...
  call npm install
  if errorlevel 1 (
    echo npm install failed. Please check Node.js installation.
    pause
    exit /b 1
  )
)

echo [DX Training Studio] Checking Playwright Chromium...
call npx playwright install chromium
if errorlevel 1 (
  echo Failed to install Playwright Chromium. Please check Node.js and network.
  pause
  exit /b 1
)

powershell -NoProfile -Command "try { exit ([int]-not((Invoke-WebRequest -Uri 'http://localhost:3000/' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200)) } catch { exit 1 }"
if not errorlevel 1 (
  echo [DX Training Studio] Dev server is already running at http://localhost:3000
  start "" http://localhost:3000
  exit /b 0
)

start "" http://localhost:3000
npm run dev
