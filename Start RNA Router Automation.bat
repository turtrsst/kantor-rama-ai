@echo off
setlocal
title KRA - RNA Router Automation

cd /d "%~dp0"
set "RNA_DIR=%RNA_ROUTER_DIR%"
if "%RNA_DIR%"=="" if exist "rna-router\package.json" set "RNA_DIR=rna-router"
if "%RNA_DIR%"=="" if exist "rnarouter\package.json" set "RNA_DIR=rnarouter"
if "%RNA_DIR%"=="" set "RNA_DIR=rna-router"
if not exist "%RNA_DIR%\package.json" (
    echo [ERROR] Folder RNA Router tidak ditemukan: %CD%\%RNA_DIR%
    echo         Lakukan git pull, atau set RNA_ROUTER_DIR ke folder rnarouter Anda.
    goto :fail
)
cd /d "%RNA_DIR%"

rem Instalasi lama bernama "rnarouter" belum punya script automation KRA.
rem Salin dari bundel repo bila belum ada (tidak menimpa file yang sudah ada
rem kecuali versi bundel, dan TIDAK menyentuh .env.local / package.json).
if not exist "scripts\kra-automation.js" (
    if not exist "%~dp0rna-router\scripts\kra-automation.js" (
        echo [ERROR] Bundel automation belum ada. Merge PR lalu git pull dulu.
        goto :fail
    )
    if not exist "scripts" mkdir "scripts"
    copy /y "%~dp0rna-router\scripts\kra-automation.js" "scripts\" >nul
    copy /y "%~dp0rna-router\scripts\kra-env.js"         "scripts\" >nul
    copy /y "%~dp0rna-router\scripts\pair-kra.js"        "scripts\" >nul
    echo [SETUP] Script automation KRA disalin ke %CD%\scripts
)

rem .kra-secrets.env dibuat SEKALI oleh "Pair KRA Event Secret.bat" dan dibaca
rem otomatis oleh scripts/kra-env.js. Environment proses tetap menang.
if not exist ".kra-secrets.env" if "%KRA_EVENT_SECRET%"=="" (
    echo [PETUNJUK] Secret belum ada. Jalankan "Pair KRA Event Secret.bat" dulu.
    echo            Tanpa secret automation hanya mencetak laporan ^(dry-run^).
)
rem JANGAN set default KRA_EVENT_URL / RNA_ROUTER_URL di sini: environment
rem proses mengalahkan .kra-secrets.env. Nilai diambil dari file pairing.

echo ==========================================
echo   RNA ROUTER AUTOMATION - health + models
echo   Folder  : %CD%
echo   Interval: 15 menit ^(Ctrl+C berhenti^)
echo ==========================================
echo.
node scripts\kra-automation.js --interval=15
if errorlevel 1 goto :fail
pause
exit /b 0

:fail
echo.
echo Automation dibatalkan / berhenti.
pause
exit /b 1
