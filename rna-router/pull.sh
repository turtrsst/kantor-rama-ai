#!/bin/bash
# Pull latest RNA Router dari origin (branch arena/ffbada04-rna-router)
set -euo pipefail

echo "=== Pull RNA Router ==="
git fetch origin
# Pastikan di branch yang benar
git checkout arena/ffbada04-rna-router || true
git pull origin arena/ffbada04-rna-router

echo "Build ulang..."
npm run build 2>&1 | tail -n 3

echo "Restart server (optional): bash start.sh"
