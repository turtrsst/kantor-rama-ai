@echo off
setlocal
title KRA - Pair Event Secret (RNA Router + PHP)
cd /d C:\xampp\htdocs\kantor-rama-ai\rna-router

if not exist "scripts\pair-kra.js" (
    echo [ERROR] File pairing tidak ditemukan. Lakukan git pull branch deploy dulu.
    goto :fail
)

rem KRA_URL bisa di-override, misalnya untuk mode Apache/XAMPP:
rem   set "KRA_URL=http://127.0.0.1/kantor-rama-ai"
if "%KRA_URL%"=="" set "KRA_URL=http://127.0.0.1:8088"

echo ==========================================
echo   PAIRING: KRA_EVENT_SECRET (Node)
echo         = KRA_RNA_ROUTER_EVENT_SECRET (PHP)
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
