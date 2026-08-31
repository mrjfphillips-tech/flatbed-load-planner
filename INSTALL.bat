@echo off
title PTV Discovery Coach - Installation Wizard
color 0B
echo.
echo  ============================================
echo    PTV Discovery Coach - Installation Wizard
echo  ============================================
echo.
echo  This will set up everything you need to run
echo  the PTV Discovery Coach application.
echo.
echo  Press any key to begin...
pause >nul

:: ─── Step 1: Check for Node.js ─────────────────────────────
echo.
echo  [Step 1/6] Checking for Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  Node.js is not installed.
    echo  Downloading Node.js 22 LTS portable...
    echo.
    
    if not exist "%TEMP%\node-portable.zip" (
        powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.15.0/node-v22.15.0-win-x64.zip' -OutFile '%TEMP%\node-portable.zip' }"
    )
    
    if not exist "C:\node-portable\node.exe" (
        echo  Extracting Node.js...
        powershell -Command "& { Expand-Archive -Path '%TEMP%\node-portable.zip' -DestinationPath 'C:\' -Force }"
        if exist "C:\node-v22.15.0-win-x64" (
            rename "C:\node-v22.15.0-win-x64" "node-portable"
        )
    )
    
    set "PATH=C:\node-portable;%PATH%"
    set "NODE_CMD=C:\node-portable\node.exe"
    set "NPM_CMD=C:\node-portable\node.exe C:\node-portable\node_modules\npm\bin\npm-cli.js"
    echo  [OK] Node.js 22 installed to C:\node-portable
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
    echo  [OK] Node.js %NODE_VER% found
    set "NODE_CMD=node"
    set "NPM_CMD=npm"
)

:: ─── Step 2: Install dependencies ──────────────────────────
echo.
echo  [Step 2/6] Installing dependencies...
echo  (This may take 2-3 minutes)
echo.
call %NPM_CMD% install --no-audit --no-fund
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] npm install failed. See errors above.
    echo  Try running as Administrator if you see permission errors.
    pause
    exit /b 1
)
echo.
echo  [OK] Dependencies installed

:: ─── Step 3: Create .env if missing ────────────────────────
echo.
echo  [Step 3/6] Checking configuration...
if not exist "packages\backend\.env" (
    echo  Creating default .env file...
    (
        echo # PTV Discovery Coach - Backend Configuration
        echo # Fill in your values below
        echo.
        echo # Database ^(SQLite for local dev^)
        echo DATABASE_URL="file:./dev.db"
        echo.
        echo # Auth0 ^(get from Auth0 dashboard^)
        echo AUTH0_AUDIENCE=https://ptv-discovery-coach
        echo AUTH0_ISSUER_BASE_URL=https://YOUR-TENANT.auth0.com
        echo.
        echo # OpenAI ^(for AI features^)
        echo OPENAI_API_KEY=sk-your-key-here
        echo.
        echo # Leexi ^(optional^)
        echo LEEXI_API_KEY_ID=
        echo LEEXI_API_KEY_SECRET=
        echo.
        echo # Frontend URL
        echo FRONTEND_URL=http://localhost:3000
    ) > "packages\backend\.env"
    echo  [OK] Created packages\backend\.env
    echo.
    echo  *** IMPORTANT: Edit packages\backend\.env with your API keys ***
    echo  *** before running the app for the first time.               ***
) else (
    echo  [OK] .env file already exists
)

:: ─── Step 4: Generate Prisma client ────────────────────────
echo.
echo  [Step 4/6] Generating database client...
cd packages\backend
call %NPM_CMD% exec prisma generate
if %ERRORLEVEL% NEQ 0 (
    echo  [WARN] Prisma generate had issues - may need manual fix
) else (
    echo  [OK] Prisma client generated
)

:: ─── Step 5: Create database ───────────────────────────────
echo.
echo  [Step 5/6] Setting up database...
call %NPM_CMD% exec prisma db push -- --accept-data-loss 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  [WARN] Database setup had issues - may need .env configuration first
) else (
    echo  [OK] Database tables created
)
cd ..\..

:: ─── Step 6: Build ─────────────────────────────────────────
echo.
echo  [Step 6/6] Building the application...
call %NPM_CMD% run build --workspace=packages/shared
if %ERRORLEVEL% NEQ 0 (
    echo  [WARN] Shared package build had issues
)
call %NPM_CMD% run build --workspace=packages/backend
if %ERRORLEVEL% NEQ 0 (
    echo  [WARN] Backend build had issues - check TypeScript errors
) else (
    echo  [OK] Backend built successfully
)

:: ─── Done ──────────────────────────────────────────────────
echo.
echo  ============================================
echo    Installation Complete!
echo  ============================================
echo.
echo  Next steps:
echo.
echo  1. Edit packages\backend\.env with your API keys
echo     (Auth0, OpenAI, and optionally Leexi)
echo.
echo  2. Start the backend:
echo     npm run dev:backend
echo.
echo  3. Start the frontend (in a second terminal):
echo     npm run dev:frontend
echo.
echo  4. Open http://localhost:3000 in your browser
echo.
echo  For the full guide, open INSTALL_GUIDE.html
echo.
echo  ============================================
echo.
pause
