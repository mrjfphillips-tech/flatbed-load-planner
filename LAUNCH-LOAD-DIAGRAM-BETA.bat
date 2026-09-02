@echo off
title Load Diagram Generator (BETA)
color 0E
cls
echo.
echo  ======================================================
echo    Load Diagram Generator  [ BETA ]
echo    Starting application...
echo  ======================================================
echo.
echo    NOTE: This is a BETA build for testing.
echo    See docs\LOAD_DIAGRAM_GENERATOR_BETA_TEST_GUIDE.md
echo.

cd /d "%~dp0"
echo  Working directory: %CD%
echo.

REM --- Start Backend ------------------------------------------
echo  [1/2] Starting API server (port 4000)...
start "" /min cmd /k "cd /d "%~dp0" && pnpm dev:backend"

echo        Waiting for backend (15 seconds)...
timeout /t 15 /nobreak >nul
echo        [OK] Backend should be ready

REM --- Start Frontend -----------------------------------------
echo  [2/2] Starting frontend (port 3000)...
start "" /min cmd /k "cd /d "%~dp0" && pnpm dev:frontend"

echo        Waiting for frontend (8 seconds)...
timeout /t 8 /nobreak >nul

REM --- Open Browser -------------------------------------------
echo.
echo  Opening browser to the Load Diagram Generator (BETA)...
start "" http://localhost:3000/load-diagram

echo.
echo  ======================================================
echo    Load Diagram Generator (BETA) is RUNNING
echo  ======================================================
echo.
echo    Frontend:  http://localhost:3000/load-diagram
echo    API:       http://localhost:4000
echo.
echo    Workflow:  Upload - Diagram (View/Edit) - Export
echo    Units:     Metric (mm/kg) or Imperial (in/lb)
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
