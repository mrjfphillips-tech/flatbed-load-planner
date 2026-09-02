@echo off
title Load Diagram Generator (BETA) - Installation Wizard
color 0E
cls
echo.
echo  ==============================================================
echo.
echo    Load Diagram Generator  [ BETA ]
echo    Installation Wizard
echo.
echo  ==============================================================
echo.
echo   This wizard will:
echo.
echo    1. Verify Node.js is installed
echo    2. Install pnpm package manager
echo    3. Install all dependencies
echo    4. Build the shared computation library
echo    5. Run database migrations
echo    6. Seed the trailer profile templates (EU + North America)
echo    7. Create a BETA desktop shortcut to launch the tool
echo.
echo   Prerequisites:
echo    - A reachable PostgreSQL database (DATABASE_URL in
echo      packages\backend\.env), e.g. the configured Neon instance,
echo      or Docker Desktop for a local PostgreSQL.
echo.
echo   Press any key to begin installation...
pause >nul

:: --- Step 1: Check Node.js ---------------------------------
echo.
echo  [Step 1/7] Checking Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] Node.js is not installed.
    echo  Please install Node.js 20+ from https://nodejs.org and re-run.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  [OK] Node.js %NODE_VER% detected
echo.

:: --- Step 2: Install/Check pnpm ----------------------------
echo  [Step 2/7] Checking pnpm package manager...
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

:: --- Step 3: Install dependencies --------------------------
echo  [Step 3/7] Installing dependencies...
echo  (This may take 2-4 minutes on first run)
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

:: --- Step 4: Build shared package --------------------------
echo  [Step 4/7] Building shared computation library...
call pnpm --filter @ptv-discovery-coach/shared build
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Shared package build failed. Check TypeScript errors.
    pause
    exit /b 1
)
echo  [OK] Shared library built (units, packing engine, validator)
echo.

:: --- Step 5: Database migrations ---------------------------
echo  [Step 5/7] Running database migrations...
call pnpm --filter @ptv-discovery-coach/backend db:migrate
if %ERRORLEVEL% NEQ 0 (
    echo  [WARN] Migration reported an issue.
    echo  If the schema is already up to date, this is safe to ignore.
)
echo.

:: --- Step 6: Seed trailer templates ------------------------
echo  [Step 6/7] Seeding trailer profile templates...
call pnpm --filter @ptv-discovery-coach/backend db:seed:load-diagram
if %ERRORLEVEL% NEQ 0 (
    echo  [WARN] Template seeding reported an issue.
    echo  The trailer dropdown may be empty until templates are seeded.
) else (
    echo  [OK] Trailer templates seeded (EU metric + NA imperial)
)
echo.

:: --- Step 7: Create desktop shortcut -----------------------
echo  [Step 7/7] Creating BETA desktop shortcut...

set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Load Diagram Generator (BETA).lnk"
set "TARGET_PATH=%~dp0LAUNCH-LOAD-DIAGRAM-BETA.bat"
set "ICON_PATH=%SystemRoot%\System32\shell32.dll"

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%TARGET_PATH%'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'Launch Load Diagram Generator (BETA)'; $s.IconLocation = '%ICON_PATH%,43'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo  [OK] Desktop shortcut created: "Load Diagram Generator (BETA)"
) else (
    echo  [WARN] Could not create shortcut.
    echo  You can run LAUNCH-LOAD-DIAGRAM-BETA.bat from this folder instead.
)
echo.

:: --- Done --------------------------------------------------
echo.
echo  ==============================================================
echo.
echo    Installation Complete!  [ BETA ]
echo.
echo    To launch the Load Diagram Generator (BETA):
echo.
echo      Double-click "Load Diagram Generator (BETA)" on the Desktop
echo      -or-
echo      Run LAUNCH-LOAD-DIAGRAM-BETA.bat from this folder
echo.
echo    The tool opens at: http://localhost:3000/load-diagram
echo.
echo    Beta test guide: docs\LOAD_DIAGRAM_GENERATOR_BETA_TEST_GUIDE.md
echo    User manual:     docs\LOAD_DIAGRAM_GENERATOR_USER_MANUAL.md
echo.
echo  ==============================================================
echo.
pause
