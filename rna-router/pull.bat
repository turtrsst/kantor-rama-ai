@echo off
echo ===== RNA Router Pull Lokal =====
cd /d C:\xampp\htdocs\rnarouter
echo Pull dari origin...
git pull origin arena/ffbada04-rna-router
echo Build ulang...
npm run build
echo Selesai. Jalankan: npm start -- --hostname 0.0.0.0 --port 3000
pause
