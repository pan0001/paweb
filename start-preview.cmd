@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if not errorlevel 1 (
  node "scripts\serve-preview.mjs"
  goto finished
)
rem Use the existing bundled runtime if Node.js is not on PATH; install nothing.
set "PAWEB_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%PAWEB_NODE%" (
  "%PAWEB_NODE%" "scripts\serve-preview.mjs"
  goto finished
)
echo Node.js 18 or newer is required. Install it from https://nodejs.org/
:finished
pause
