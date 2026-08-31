@echo off
title OptiFlow Flatbed Steel Load Planner - Installation Wizard
color 0A
cls
echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║                                                          ║
echo  ║   OptiFlow Flatbed Steel Load Planner                    ║
echo  ║   Installation Wizard                                    ║
echo  ║                                                          ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
echo   This wizard will:
echo.
echo    1. Verify Node.js is installed
echo    2. Install pnpm package manager
echo    3. Install all dependencies
echo    4. Start Docker containers (PostgreSQL)
echo    5. Build the shared computation library
echo    6. Run database migrations
echo    7. Create a desktop shortcut to launch the app
echo.
echo   Prerequisites:
echo    - Docker Desktop (for PostgreSQL database)
echo    - OR a PostgreSQL 14+ server running externally
echo.
echo   Press any key to begin installation...
pause >nul

:: ─── Step 1: Check Node.js ─────────────────────────────────
echo.
echo  ┌─────────────────────────────────────────────────────────┐
echo  │ [Step 1/7] Checking Node.js...                          │
echo  └─────────────────────────────────────────────────────────┘
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] Node.js is not installed.
    echo.
    echo  Please install Node.js 18+ from: https://nodejs.org
    echo  Then re-run this installer.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  [OK] Node.js %NODE_VER% detected
echo.

:: ─── Step 2: Install/Check pnpm ────────────────────────────
echo  ┌─────────────────────────────────────────────────────────┐
echo  │ [Step 2/7] Checking pnpm package manager...             │
echo  └─────────────────────────────────────────────────────────┘
where pnpm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  Installing pnpm...
    call npm install -g pnpm@9
    if %ERRORLEVEL% NEQ 0 (
        echo  [ERROR] Failed to install pnpm. Try running as Administrator.
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%i in ('pnpm --version') do set PNPM_VER=%%i
echo  [OK] pnpm v%PNPM_VER% ready
echo.

:: ─── Step 3: Install dependencies ──────────────────────────
echo  ┌─────────────────────────────────────────────────────────┐
echo  │ [Step 3/7] Installing dependencies...                   │
echo  │ (This may take 2-4 minutes on first run)                │
echo  └─────────────────────────────────────────────────────────┘
cd /d "%~dp0"
call pnpm install --no-frozen-lockfile
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] Dependency installation failed.
    echo  Check your internet connection and try again.
    pause
    exit /b 1
)
echo  [OK] All dependencies installed
echo.

:: ─── Step 4: Docker / Database ─────────────────────────────
echo  ┌─────────────────────────────────────────────────────────┐
echo  │ [Step 4/7] Setting up PostgreSQL database...            │
echo  └─────────────────────────────────────────────────────────┘
where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo  Docker detected. Starting PostgreSQL container...
    docker compose up -d postgres
    if %ERRORLEVEL% NEQ 0 (
        echo  [WARN] Docker Compose failed. Is Docker Desktop running?
        echo  You can start it manually: docker compose up -d postgres
    ) else (
        echo  [OK] PostgreSQL container running on port 5432
        echo  Waiting for database to be ready...
        timeout /t 8 /nobreak >nul
    )
) else (
    echo  [INFO] Docker not found. Using existing DATABASE_URL from .env
    echo  Make sure your PostgreSQL server is running.
)
echo.

:: ─── Step 5: Build shared package ──────────────────────────
echo  ┌─────────────────────────────────────────────────────────┐
echo  │ [Step 5/7] Building shared computation library...       │
echo  └─────────────────────────────────────────────────────────┘
call pnpm --filter @ptv-discovery-coach/shared build
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Shared package build failed. Check TypeScript errors.
    pause
    exit /b 1
)
echo  [OK] Shared library built (equipment, geometry, weight, rules, planner)
echo.

:: ─── Step 6: Database migrations ───────────────────────────
echo  ┌─────────────────────────────────────────────────────────┐
echo  │ [Step 6/7] Running database migrations...               │
echo  └─────────────────────────────────────────────────────────┘
cd packages\backend
call npx drizzle-kit push 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  [WARN] Database migration had issues.
    echo  If using Neon/external DB, this may already be up to date.
) else (
    echo  [OK] Database schema up to date
)
cd /d "%~dp0"
echo.

:: ─── Step 7: Create desktop shortcut ───────────────────────
echo  ┌─────────────────────────────────────────────────────────┐
echo  │ [Step 7/7] Creating desktop shortcut...                 │
echo  └─────────────────────────────────────────────────────────┘

set "SHORTCUT_PATH=%USERPROFILE%\Desktop\OptiFlow Load Planner.lnk"
set "TARGET_PATH=%~dp0LAUNCH-FLATBED.bat"
set "ICON_PATH=%SystemRoot%\System32\shell32.dll"

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%TARGET_PATH%'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'Launch OptiFlow Flatbed Steel Load Planner'; $s.IconLocation = '%ICON_PATH%,22'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo  [OK] Desktop shortcut created: "OptiFlow Load Planner"
) else (
    echo  [WARN] Could not create shortcut. You can use LAUNCH-FLATBED.bat directly.
)
echo.

:: ─── Done ──────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║                                                          ║
echo  ║   Installation Complete!                                 ║
echo  ║                                                          ║
echo  ╠══════════════════════════════════════════════════════════╣
echo  ║                                                          ║
echo  ║   To launch the application:                             ║
echo  ║                                                          ║
echo  ║     Double-click "OptiFlow Load Planner" on Desktop      ║
echo  ║     -or-                                                 ║
echo  ║     Run LAUNCH-FLATBED.bat from this folder              ║
echo  ║                                                          ║
echo  ║   The app will open at: http://localhost:3000            ║
echo  ║                                                          ║
echo  ║   Default login:                                         ║
echo  ║     Email: admin@optiflow.local                          ║
echo  ║     Password: admin123                                   ║
echo  ║     Role: Administrator (full access)                    ║
echo  ║                                                          ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
echo  For the full user guide, see: docs\FLATBED_LOAD_PLANNER_GUIDE.md
echo.
pause
