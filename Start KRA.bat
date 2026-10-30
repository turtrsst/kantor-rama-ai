@echo off
setlocal
title KRA - PHP 8.4
cd /d C:\xampp\htdocs\kantor-rama-ai

set "KRA_MEMORY_ROOT=C:\vault\KRA"
set "KRA_PHP_BIN=C:\php84\php.exe"

echo ==========================================
echo   KANTOR-RAMA-AI - PHP Development Server
echo   Runtime: %KRA_PHP_BIN%
echo ==========================================
echo.

rem ---- Preflight checks ----
if not exist "C:\xampp\htdocs\kantor-rama-ai\api\index.php" (
    echo [ERROR] Project directory missing: C:\xampp\htdocs\kantor-rama-ai
    echo Check the project was deployed to the server.
    goto :fail
)
if not exist "%KRA_PHP_BIN%" (
    echo [ERROR] PHP executable not found: %KRA_PHP_BIN%
    echo Install PHP 8.4 at C:\php84\php.exe or update KRA_PHP_BIN in this launcher.
    goto :fail
)
"%KRA_PHP_BIN%" -r "if (PHP_VERSION_ID < 80400 || PHP_VERSION_ID >= 80500) { fwrite(STDERR, 'PHP 8.4.x required; found ' . PHP_VERSION . PHP_EOL); exit(1); } echo 'Using PHP ' . PHP_VERSION . PHP_EOL;"
if errorlevel 1 goto :fail
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
"%KRA_PHP_BIN%" -S 100.76.172.67:8088 -t .

:end
pause
exit /b 0

:fail
echo.
echo Startup aborted due to preflight failure.
pause
exit /b 1
