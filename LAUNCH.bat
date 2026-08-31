@echo off
title PTV Discovery Coach
color 0B
echo.
echo  ============================================
echo    PTV Discovery Coach - Starting...
echo  ============================================
echo.

:: Kill any leftover Node processes on our ports
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Start backend in background
echo  [1/2] Starting backend (port 4000)...
start "PTV Backend" /min cmd /c "cd /d "%~dp0" && pnpm dev:backend"

:: Wait for backend to be ready
echo  Waiting for backend...
timeout /t 6 /nobreak >nul

:: Start frontend in background
echo  [2/2] Starting frontend (port 3000)...
start "PTV Frontend" /min cmd /c "cd /d "%~dp0" && pnpm dev:frontend"

:: Wait for frontend to be ready
echo  Waiting for frontend...
timeout /t 5 /nobreak >nul

:: Open browser
echo  Opening browser...
start http://localhost:3000

echo.
echo  ============================================
echo    PTV Discovery Coach is running!
echo  ============================================
echo.
echo  Frontend: http://localhost:3000
echo  Backend:  http://localhost:4000
echo.
echo  Login: rep@ptv.com / demo123
echo.
echo  To stop: close this window (or press Ctrl+C)
echo  The backend and frontend run in minimized windows.
echo.
pause
