@echo off
cd /d "%~dp0mandala"

if not exist node_modules (
  echo [DX Training Mandala] node_modules not found. Running npm install...
  call npm install
  if errorlevel 1 (
    echo npm install failed. Please check Node.js installation.
    pause
    exit /b 1
  )
)

echo [DX Training Mandala] Building (this also generates the search index)...
call npm run build
if errorlevel 1 (
  echo Build failed. The server was not started.
  pause
  exit /b 1
)

start "" http://localhost:3002
npm run start
