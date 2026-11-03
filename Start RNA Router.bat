@echo off
setlocal
title KRA - RNA Router (Next.js :3000)
cd /d C:\xampp\htdocs\kantor-rama-ai\rna-router

if not exist "package.json" (
    echo [ERROR] Bundel rna-router tidak ditemukan. Pull branch arena/cbf4b10e-kantor-rama-ai.
    goto :fail
)
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
