@echo off
title OptiFlow Flatbed Steel Load Planner
color 0A
cls
echo.
echo  ======================================================
echo    OptiFlow Flatbed Steel Load Planner
echo    Starting application...
echo  ======================================================
echo.

cd /d "%~dp0"
echo  Working directory: %CD%
echo.

REM ─── Start Backend ─────────────────────────────────────────
echo  [1/2] Starting API server (port 4000)...
start "" /min cmd /k "cd /d "%~dp0" && pnpm dev:backend"

echo        Waiting for backend (15 seconds)...
timeout /t 15 /nobreak >nul
echo        [OK] Backend should be ready

REM ─── Start Frontend ────────────────────────────────────────
echo  [2/2] Starting frontend (port 3000)...
start "" /min cmd /k "cd /d "%~dp0" && pnpm dev:frontend"

echo        Waiting for frontend (8 seconds)...
timeout /t 8 /nobreak >nul

REM ─── Open Browser ──────────────────────────────────────────
echo.
echo  Opening browser...
start "" http://localhost:3000/flatbed

echo.
echo  ======================================================
echo    OptiFlow Flatbed Steel Load Planner is RUNNING
echo  ======================================================
echo.
echo    Frontend:  http://localhost:3000/flatbed
echo    API:       http://localhost:4000
echo.
echo    Workflow:  Equipment - Steel Orders - Rules - Plan
echo.
echo  ======================================================
echo.
echo    Press any key to STOP all servers and exit.
echo.
pause >nul

echo.
echo  Shutting down...
taskkill /f /fi "WINDOWTITLE eq pnpm*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq npm*" >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
echo  [OK] Done.
timeout /t 2 /nobreak >nul
