@echo off
setlocal
title KRA - PHP 8.2
cd /d C:\xampp\htdocs\kantor-rama-ai

set "KRA_MEMORY_ROOT=C:\vault\KRA"

echo ==========================================
echo   KANTOR-RAMA-AI - PHP Development Server
echo   PHP 8.2.12
echo ==========================================
echo.

rem ---- Preflight checks ----
if not exist "C:\xampp\htdocs\kantor-rama-ai\api\index.php" (
    echo [ERROR] Project directory missing: C:\xampp\htdocs\kantor-rama-ai
    echo Check the project was deployed to the server.
    goto :fail
)
if not exist "C:\xampp\php\php.exe" (
    echo [ERROR] PHP executable not found: C:\xampp\php\php.exe
    echo Install XAMPP PHP 8.2 on this server first.
    goto :fail
)
if not exist "C:\vault\KRA" (
    echo [ERROR] Memory vault missing: C:\vault\KRA
    echo Create the Obsidian vault folder on the server.
    goto :fail
)

echo Server: http://100.76.172.67:8088/web/index.html
echo Vault:  C:\vault\KRA
echo.

netstat -ano | findstr /r /c:":8088 .*LISTENING" >nul
if not errorlevel 1 (
    echo KRA server already running.
    start "" http://100.76.172.67:8088/web/index.html
    goto :end
)

start "" http://100.76.172.67:8088/web/index.html
C:\xampp\php\php.exe -S 100.76.172.67:8088 -t .

:end
pause
exit /b 0

:fail
echo.
echo Startup aborted due to preflight failure.
pause
exit /b 1
