@echo off
cd /d "%~dp0mandala"

REM Guard on node_modules\.bin\next.cmd, NOT on the node_modules directory itself.
REM A directory that exists but is broken (e.g. .bin wiped out) slips past a presence
REM check, and the next npx call then falls through to PATH and reports something two
REM steps away from the real cause -- that is how a missing .bin surfaced as
REM "'playwright' is not recognized as an internal or external command".
REM next.cmd is what dev/build actually invoke, so it is the right sentinel.
REM NOTE: this checks a single file, so a partial break that keeps next.cmd is not caught.
if not exist "node_modules\.bin\next.cmd" (
  echo [DX Training Mandala] Dependencies are missing or broken. Reinstalling with npm ci...
  call npm ci
  if errorlevel 1 (
    echo [DX Training Mandala] npm ci failed. package-lock.json may be out of sync with package.json.
    echo [DX Training Mandala] Falling back to npm install...
    call npm install
    if errorlevel 1 (
      echo.
      echo [DX Training Mandala] Failed to install dependencies. Startup aborted.
      echo   1. Check Node.js:  node -v
      echo   2. Check your network connection
      echo   3. Then run  npm ci  in dx-training-studio\mandala
      pause
      exit /b 1
    )
  )
)

REM Build first: the full-text search index is generated only by the build.
REM Starting dev without it leaves the search box broken.
echo [DX Training Mandala] Building (this also generates the search index)...
call npm run build
if errorlevel 1 (
  echo Build failed. The dev server was not started.
  pause
  exit /b 1
)

start "" http://localhost:3002
npm run dev
