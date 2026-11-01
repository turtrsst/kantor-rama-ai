---
name: creator-concat-edit-brief
description: "Mengubah storyboard menjadi brief editing yang bisa dieksekusi mesin: satu blok JSON persis untuk item input workflow N100N 'contoh-concat-edit' (bridge MCP Concat). Untuk Dito (Producer)."
---

# Creator Concat Edit Brief

Jembatan antara rencana manusia dan editor mesin. Output skill ini adalah
**satu blok ```json** yang bisa ditempel apa adanya ke INPUT ITEMS pada panel
N100N Workflow Bridge (atau dikirim sebagai item run dari KRA), ditambah
catatan editing yang belum bisa dikerjakan contoh workflow.

## Ringkasan aturan

- Keluarkan tepat satu blok ```json berisi array dengan satu objek item workflow.
- Field wajib: location (folder induk proyek), name, media (file mentah utama), title (judul di layar), output (path .mp4 hasil export di folder media KRA).
- Tambahkan video {width,height,rateNum,rateDen} hanya bila bukan 1920x1080 30fps; Shorts = 1080x1920.
- Di luar blok JSON: daftar "sentuhan manual" yang masih perlu manusia di Concat (trim presisi, keyframe, efek) — jangan berpura-pura semuanya otomatis.

## Format blok JSON

```json
[{ "location": "C:/Users/NAMA/Videos/KRA", "name": "Episode 12", "media": "C:/Users/NAMA/Videos/KRA/mentah.mp4", "title": "Judul di layar", "output": "C:/xampp/htdocs/kantor-rama-ai/n100n/files/ep12.mp4" }]
```

## Langkah

1. Ambil shot list (creator-shot-list); pilih satu file mentah utama untuk
   potongan kasar otomatis ini.
2. Tentukan `output` di folder media yang dikenali uploader KRA
   (`n100n/files/`, `.temp/`, atau `files/`) agar siap direview & diupload.
3. Susun blok JSON + daftar sentuhan manual (urutan klip lanjutan, caption,
   musik) sebagai pekerjaan lanjutan di Concat/window mode.

## Larangan

- Mengarang path file yang belum dipastikan ada; tulis [ISI PATH] bila belum tahu.
- Mengklaim video sudah diedit/terupload — brief ini baru rencana eksekusi.
