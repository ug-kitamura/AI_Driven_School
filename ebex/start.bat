@echo off
rem EBEX production launcher (standard entry point for users).
rem NOTE: next start serves the prebuilt .next output. Source changes are NOT
rem picked up unless you rebuild. To apply source changes, run:
rem   start.bat rebuild
rem For EBEX development itself, use start-dev.bat instead.
rem Keep this file ASCII-only: cmd.exe reads .bat in the console codepage
rem (CP932 on Japanese Windows), so UTF-8 Japanese here breaks parsing.
cd /d "%~dp0"

set PORT=3000
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

rem Warn when the prebuilt output is older than the newest source file.
rem next start serves .next as-is, so a stale build silently hides source changes.
rem workspace/ is user content and does not affect the build, so it is excluded.
set STALE=
if "%1"=="rebuild" goto :skip_stale_check
if not exist .next\BUILD_ID goto :skip_stale_check
rem NOTE: no pipe characters below. Inside for /f backticks, cmd passes "^|"
rem through literally and PowerShell then fails to parse it.
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "$ErrorActionPreference='SilentlyContinue'; $b=(Get-Item '.next\BUILD_ID').LastWriteTime; $m=[datetime]::MinValue; foreach($d in @('app','components','lib','styles','scripts','contracts')){ if(Test-Path $d){ foreach($x in (Get-ChildItem -Path $d -Recurse -File)){ if($x.LastWriteTime -gt $m){ $m=$x.LastWriteTime } } } }; foreach($f in @('package.json','next.config.ts','tsconfig.json','postcss.config.mjs','components.json')){ if(Test-Path $f){ $x=Get-Item $f; if($x.LastWriteTime -gt $m){ $m=$x.LastWriteTime } } }; if($m -gt $b){ 'STALE' } else { 'FRESH' }"`) do set STALE=%%i
if "%STALE%"=="STALE" (
  echo [EBEX] ============================================================
  echo [EBEX] WARNING: source files are NEWER than the current build.
  echo [EBEX] This server will serve the OLD build, so your recent
  echo [EBEX] changes will NOT appear.
  echo [EBEX] Run "start.bat rebuild" to apply them.
  echo [EBEX] ============================================================
)
:skip_stale_check

echo [EBEX] Starting production server at %EBEX_URL%
start "" %EBEX_URL%
npm run start -- -p %PORT%
