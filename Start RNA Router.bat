@echo off
setlocal
title KRA - RNA Router (Next.js :3000)

rem Selalu mulai dari folder repo (tidak hardcoded lagi).
cd /d "%~dp0"

rem Nama folder bisa "rna-router" (bundel repo) ATAU "rnarouter" (instalasi
rem lama Anda). Override mutlak lewat RNA_ROUTER_DIR, absolut atau relatif.
set "RNA_DIR=%RNA_ROUTER_DIR%"
if "%RNA_DIR%"=="" if exist "rna-router\package.json" set "RNA_DIR=rna-router"
if "%RNA_DIR%"=="" if exist "rnarouter\package.json" set "RNA_DIR=rnarouter"
if "%RNA_DIR%"=="" set "RNA_DIR=rna-router"

if not exist "%RNA_DIR%\package.json" (
    echo [ERROR] Folder RNA Router tidak ditemukan: %CD%\%RNA_DIR%
    echo         Jalankan git pull dulu, atau set:
    echo           set "RNA_ROUTER_DIR=C:\xampp\htdocs\rnarouter"
    goto :fail
)
cd /d "%RNA_DIR%"

if not exist ".env.local" (
    copy ".env.example" ".env.local" >nul
    echo [SETUP] .env.local dibuat. Isi Supabase / MySQL sebelum memakai key vault.
)
if not exist "node_modules\next" (
    echo [SETUP] Dependensi belum ada; menjalankan npm ci ^(butuh internet^)...
    call npm ci || goto :fail
)

echo ==========================================
echo   RNA ROUTER - bundled with KRA
echo   Folder: %CD%
echo   URL   : http://127.0.0.1:3000
echo   Docs  : docs\RNA-ROUTER-INTEGRATION.md
echo ==========================================
echo.
echo Catatan: ini aplikasi Next.js, BUKAN PHP. Jalankan automation KRA
echo         terpisah lewat "Start RNA Router Automation.bat".
echo.
start "" http://127.0.0.1:3000
call npm run dev -- -H 0.0.0.0
goto :end

:fail
echo.
echo Startup dibatalkan.
pause
exit /b 1

:end
pause
exit /b 0
