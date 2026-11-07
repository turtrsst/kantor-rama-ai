@echo off
setlocal
title KRA - N100N Automation Engine (Node :5679)

rem Selalu mulai dari folder script ini (jangan hardcode path lama).
cd /d "%~dp0"

if not exist "server.js" (
    echo [ERROR] server.js tidak ditemukan di %CD%
    goto :fail
)

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js tidak ditemukan di PATH. Pasang Node 22.5+ dulu.
    goto :fail
)

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [SETUP] .env dibuat dari .env.example. Isi APP_PASSWORD dan APP_API_TOKEN.
    ) else (
        echo [ERROR] .env tidak ditemukan. Salin .env.example lalu isi kredensial.
        goto :fail
    )
)

echo ========================================================
echo   KRA N100N AUTOMATION ENGINE
echo   Folder : %CD%
echo   Port   : 5679  (APP_PORT di .env)
echo   Health : http://127.0.0.1:5679/api/health
echo ========================================================
echo.

node --env-file=.env server.js
goto :end

:fail
echo.
echo Startup dibatalkan.
pause
exit /b 1

:end
