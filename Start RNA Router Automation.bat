@echo off
setlocal
title KRA - RNA Router Automation
cd /d C:\xampp\htdocs\kantor-rama-ai\rna-router

if "%KRA_EVENT_SECRET%"=="" (
    echo [PERINGATAN] KRA_EVENT_SECRET belum diset di environment ini.
    echo             Automation hanya mencetak laporan, tidak mengirim ke KRA.
    echo             Samakan juga KRA_RNA_ROUTER_EVENT_SECRET pada server PHP KRA.
)
if "%RNA_ROUTER_URL%"=="" set "RNA_ROUTER_URL=http://127.0.0.1:3000"
if "%KRA_EVENT_URL%"=="" set "KRA_EVENT_URL=http://127.0.0.1:8088/api/index.php?action=rna-router-event"

echo ==========================================
echo   RNA ROUTER AUTOMATION - health + models
echo   Interval: 15 menit ^(Ctrl+C berhenti^)
echo   Gateway : %RNA_ROUTER_URL%
echo   KRA     : %KRA_EVENT_URL%
echo ==========================================
echo.
node scripts\kra-automation.js --interval=15
pause
exit /b 0
