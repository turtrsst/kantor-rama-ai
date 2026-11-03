#!/bin/bash
set -euo pipefail

echo "=== RNA Router Server Start ==="
echo "Branch: arena/ffbada04-rna-router"

# 1. Check env
if [ ! -f ".env" ]; then
  echo "⚠️  File .env tidak ditemukan. Copi dari .env.example lalu isi DB_* dan JWT_SECRET."
  exit 1
fi

# 2. Install
if [ ! -d "node_modules" ]; then
  echo "📦 npm install ..."
  npm install
fi

# 3. Build
echo "🔨 npm run build ..."
npm run build

# 4. MySQL migration reminder (optional)
echo "💡 Jika database belum dibuat, jalankan:"
echo "    mysql -u root -p < supabase/migrations/001_init_mysql.sql"

# 5. Start on port 3000 (bind 0.0.0.0 untuk akses luar)
echo "🚀 Jalanin: npm start (port 3000, bind 0.0.0.0)"
export PORT=3000
export HOST=0.0.0.0
export HOST=0.0.0.0
export PORT=3000
exec node .next/standalone/server.js
