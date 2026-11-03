@echo off
setlocal
title KRA - GitHub Changer (Node :4173)

rem Selalu mulai dari folder tempat .bat ini berada (tidak hardcoded lagi).
cd /d "%~dp0"
if not exist "github-changer\server\index.js" (
    echo [ERROR] Bundel GitHub Changer tidak ditemukan di:
    echo         %CD%\github-changer\server\index.js
    echo.
    echo         Situs yang sudah online BELUM berarti kode baru sudah ada di mesin ini.
    echo         Merge PR ke arena/cbf4b10e-kantor-rama-ai, lalu jalankan:
    echo           git pull --ff-only origin arena/cbf4b10e-kantor-rama-ai
    goto :fail
)
cd /d "%~dp0github-changer"

rem ---- First run: salin template .env (JANGAN commit file ini) ----
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo [SETUP] .env dibuat dari .env.example.
)

rem KRA_URL default = PHP built-in desktop :8088. Untuk Apache/XAMPP set:
rem   set "KRA_URL=http://127.0.0.1/kantor-rama-ai"
if "%KRA_URL%"=="" set "KRA_URL=http://127.0.0.1:8088"
node scripts\pair-kra.js --kra-url=%KRA_URL%
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
echo   KRA   : %~dp0
echo   API   : %KRA_URL%
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
