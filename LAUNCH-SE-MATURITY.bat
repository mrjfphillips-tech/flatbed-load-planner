@echo off
title PTV SE Maturity Assessment
echo.
echo  ============================================
echo    PTV SE Maturity Assessment — Opening...
echo  ============================================
echo.
start "" "%~dp0demo-se-maturity.html"
echo  Opened in your default browser.
echo.
echo  (This is a standalone tool — no server needed)
echo  Close this window anytime.
echo.
timeout /t 3 /nobreak >nul
