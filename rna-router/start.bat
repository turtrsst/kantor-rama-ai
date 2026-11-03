@echo off
echo RNA Router Server starting...
cd /d C:\xampp\htdocs\rnarouter
call npm start -- --hostname 0.0.0.0 --port 3000
