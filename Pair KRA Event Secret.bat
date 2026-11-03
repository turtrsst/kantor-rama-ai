@echo off
setlocal
title KRA - Pair Event Secret (RNA Router + PHP)

cd /d "%~dp0"
set "RNA_DIR=%RNA_ROUTER_DIR%"
if "%RNA_DIR%"=="" if exist "rna-router\package.json" set "RNA_DIR=rna-router"
if "%RNA_DIR%"=="" if exist "rnarouter\package.json" set "RNA_DIR=rnarouter"
if "%RNA_DIR%"=="" set "RNA_DIR=rna-router"
if not exist "%RNA_DIR%\package.json" (
    echo [ERROR] Folder RNA Router tidak ditemukan: %CD%\%RNA_DIR%
    echo         Lakukan git pull, atau set RNA_ROUTER_DIR.
    goto :fail
)
cd /d "%RNA_DIR%"

rem Pastikan script pairing tersedia juga di instalasi "rnarouter" lama.
if not exist "scripts\pair-kra.js" (
    if not exist "%~dp0rna-router\scripts\pair-kra.js" (
        echo [ERROR] Bundel pairing belum ada. Merge PR lalu git pull dulu.
        goto :fail
    )
    if not exist "scripts" mkdir "scripts"
    copy /y "%~dp0rna-router\scripts\pair-kra.js"        "scripts\" >nul
    copy /y "%~dp0rna-router\scripts\kra-env.js"         "scripts\" >nul
    copy /y "%~dp0rna-router\scripts\kra-automation.js"  "scripts\" >nul
    echo [SETUP] Script pairing disalin ke %CD%\scripts
)

rem KRA_URL bisa di-override, misalnya untuk mode Apache/XAMPP:
rem   set "KRA_URL=http://127.0.0.1/kantor-rama-ai"
if "%KRA_URL%"=="" set "KRA_URL=http://127.0.0.1:8088"

echo ==========================================
echo   PAIRING: KRA_EVENT_SECRET (Node)
echo         = KRA_RNA_ROUTER_EVENT_SECRET (PHP)
echo   Folder: %CD%
echo   KRA   : %KRA_URL%
echo ==========================================
echo.
node scripts\pair-kra.js --kra-url=%KRA_URL%
if errorlevel 1 goto :fail

echo.
echo [LANJUT] Terapkan baris SetEnv / setx yang dicetak di atas ke server PHP,
echo          restart Apache / desktop KRA, baru jalankan
echo          "Start RNA Router Automation.bat".
echo.
pause
exit /b 0

:fail
echo.
echo Pairing dibatalkan.
pause
exit /b 1
