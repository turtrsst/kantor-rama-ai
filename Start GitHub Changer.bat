@echo off
setlocal
title KRA - GitHub Changer (Node :4173)
cd /d C:\xampp\htdocs\kantor-rama-ai\github-changer

if not exist "server\index.js" (
    echo [ERROR] Bundled GitHub Changer tidak ditemukan:
    echo         C:\xampp\htdocs\kantor-rama-ai\github-changer\server\index.js
    echo         Pastikan branch arena/cbf4b10e-kantor-rama-ai sudah di-pull.
    goto :fail
)

rem ---- First run: salin template .env (JANGAN commit file ini) ----
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo [SETUP] .env dibuat dari .env.example.
)
node scripts\pair-kra.js --kra-url=http://127.0.0.1:8088
if errorlevel 1 goto :fail

rem ---- Binding lokal. Untuk akses LAN / Cloudflare Tunnel, set HOST=0.0.0.0
rem      dan aktifkan APP_PIN / Cloudflare Access. ----
if "%HOST%"=="" set "HOST=127.0.0.1"
if "%PORT%"=="" set "PORT=4173"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js belum ada di PATH. Butuh Node.js 18 atau lebih baru.
    goto :fail
)

echo ==========================================
echo   GITHUB CHANGER - bundled with KRA
echo   URL   : http://127.0.0.1:%PORT%
echo   KRA   : C:\xampp\htdocs\kantor-rama-ai
echo ==========================================
echo.
echo Catatan: service Node ini TIDAK dijalankan Apache/PHP.
echo          Tombol "GitHub Changer" di KRA membuka dashboard ini.
echo.

netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
    echo Port %PORT% sudah dipakai; membuka dashboard yang sudah berjalan.
    start "" http://127.0.0.1:%PORT%
    goto :end
)

start "" http://127.0.0.1:%PORT%
node server\index.js
goto :end

:fail
echo.
echo Startup dibatalkan.
pause
exit /b 1

:end
pause
exit /b 0
