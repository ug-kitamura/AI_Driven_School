@echo off
cd /d "%~dp0"

set PORT=3001
set EBEX_URL=http://localhost:%PORT%/

if not exist node_modules (
  echo [EBEX] node_modules not found. Running npm install...
  call npm install
  if errorlevel 1 (
    echo npm install failed. Please check Node.js installation.
    pause
    exit /b 1
  )
)

powershell -NoProfile -Command "try { exit ([int]-not((Invoke-WebRequest -Uri '%EBEX_URL%' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200)) } catch { exit 1 }"
if not errorlevel 1 (
  echo [EBEX] Dev server is already running at %EBEX_URL%
  start "" %EBEX_URL%
  exit /b 0
)

echo [EBEX] Starting dev server at %EBEX_URL%
start "" %EBEX_URL%
npm run dev
