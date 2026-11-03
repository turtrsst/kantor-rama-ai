@echo off
setlocal
title KRA - Install RNA Router Automation ke folder rnarouter

rem Pakai ini bila RNA Router Anda sudah terpasang lama di folder "rnarouter"
rem dan TIDAK ingin memakai salinan bundle "rna-router" dari repo.
rem Hanya 3 script yang disalin; .env.local, package.json, node_modules,
rem dan konfigurasi database Anda TIDAK diubah.

cd /d "%~dp0"
set "RNA_DIR=%RNA_ROUTER_DIR%"
if "%RNA_DIR%"=="" if exist "rnarouter\package.json" set "RNA_DIR=rnarouter"
if "%RNA_DIR%"=="" if exist "rna-router\package.json" set "RNA_DIR=rna-router"
if "%RNA_DIR%"=="" set "RNA_DIR=rnarouter"

if not exist "%RNA_DIR%\package.json" (
    echo [ERROR] Folder tujuan tidak ditemukan: %CD%\%RNA_DIR%
    echo         Set dulu, misalnya:
    echo           set "RNA_ROUTER_DIR=C:\xampp\htdocs\rnarouter"
    echo           "Install RNA Router Automation.bat"
    goto :fail
)
if not exist "%~dp0rna-router\scripts\kra-automation.js" (
    echo [ERROR] Bundel automation belum ada di repo. Merge PR lalu git pull dulu.
    goto :fail
)

cd /d "%RNA_DIR%"
if not exist "scripts" mkdir "scripts"
copy /y "%~dp0rna-router\scripts\kra-automation.js" "scripts\" >nul
copy /y "%~dp0rna-router\scripts\kra-env.js"        "scripts\" >nul
copy /y "%~dp0rna-router\scripts\pair-kra.js"       "scripts\" >nul

echo ==========================================
echo   INSTALL SELESAI
echo   Target : %CD%\scripts
echo   File   : kra-automation.js, kra-env.js, pair-kra.js
echo ==========================================
echo.
echo Sekarang jalankan berurutan:
echo   1^) "Pair KRA Event Secret.bat"        ^(buat .kra-secrets.env di folder ini^)
echo   2^) Terapkan SetEnv / setx ke PHP KRA, restart Apache / desktop
echo   3^) "Start RNA Router.bat"             ^(gateway :3000^)
echo   4^) "Start RNA Router Automation.bat"  ^(scheduler 15 menit^)
echo.
echo Uji cepat dari folder ini:
echo   node scripts\kra-automation.js --once
echo.
pause
exit /b 0

:fail
echo.
echo Instalasi dibatalkan.
pause
exit /b 1
