@echo off
rem EBEX 本番モード起動（利用者向けの標準）。
rem ソースコードの変更を反映するには rebuild 引数を付けて再実行する:
rem   start.bat rebuild
rem EBEX 自体の開発には start-dev.bat を使用する。
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
  echo [EBEX] Server is already running at %EBEX_URL%
  start "" %EBEX_URL%
  exit /b 0
)

if "%1"=="rebuild" (
  echo [EBEX] Rebuilding...
  call npm run build
  if errorlevel 1 (
    echo npm run build failed.
    pause
    exit /b 1
  )
) else if not exist .next\BUILD_ID (
  echo [EBEX] No production build found. Building...
  call npm run build
  if errorlevel 1 (
    echo npm run build failed.
    pause
    exit /b 1
  )
)

echo [EBEX] Starting production server at %EBEX_URL%
start "" %EBEX_URL%
npm run start -- -p %PORT%
