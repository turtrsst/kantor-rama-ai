#!/bin/bash
# Notifikasi fallback — bisa dipanggil saat fallback terjadi
MSG="RNA Router: Fallback terjadi dari ${1:-model} ke ${2:-model} (status ${3:-unknown})"
echo "$(date '+%Y-%m-%d %H:%M:%S') - $MSG" >> rna-fallback-log.txt
# Desktop notification jika notify-send tersedia (Linux desktop)
which notify-send >/dev/null 2>&1 && notify-send -t 8000 "RNA Router Fallback" "$MSG" || true
echo "Notifikasi tersimpan: $MSG"
