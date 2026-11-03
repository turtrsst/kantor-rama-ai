@echo off
setlocal
title KRA - RNA Router Automation
cd /d C:\xampp\htdocs\kantor-rama-ai\rna-router

rem .kra-secrets.env dibuat SEKALI oleh "Pair KRA Event Secret.bat" dan dibaca
rem otomatis oleh scripts/kra-env.js. Environment proses tetap menang.
if not exist ".kra-secrets.env" if "%KRA_EVENT_SECRET%"=="" (
    echo [PETUNJUK] Secret belum ada. Jalankan "Pair KRA Event Secret.bat" dulu.
    echo            Tanpa secret automation hanya mencetak laporan ^(dry-run^).
)
rem JANGAN set default di sini: environment proses mengalahkan .kra-secrets.env.
rem Nilai KRA_EVENT_URL / RNA_ROUTER_URL diambil dari file pairing, atau dari
rem environment yang sengaja Anda set sendiri sebelum menjalankan bat ini.

echo ==========================================
echo   RNA ROUTER AUTOMATION - health + models
echo   Interval: 15 menit ^(Ctrl+C berhenti^)
echo   Gateway : lihat .kra-secrets.env (default 127.0.0.1:3000)
echo   KRA     : lihat .kra-secrets.env (default 127.0.0.1:8088)
echo ==========================================
echo.
rem Pair KRA Event Secret.bat juga menyimpan KRA_EVENT_URL untuk mode Apache.
node scripts\kra-automation.js --interval=15
pause
exit /b 0
