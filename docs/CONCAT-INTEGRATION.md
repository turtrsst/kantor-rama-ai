# Concat × KRA × N100N — editing video terprogram untuk alur Creator

[Concat](https://github.com/jub0t/Concat) adalah editor video open-source
pengganti CapCut (lokal, tanpa watermark) yang bisa digerakkan mesin lewat
**MCP** (`concat --mcp`) dan JSON-RPC. Source-nya kini dibundel di repo ini
pada folder `concat/` (lihat `concat/UPSTREAM.KRA.md`), dan KRA
menghubungkannya ke workflow AI lewat jembatan kecil:

```
┌──────────┐  run workflow   ┌────────┐  POST /call   ┌──────────────────┐  stdio MCP   ┌──────────────┐
│   KRA    │ ──────────────► │ n100n  │ ────────────► │ kra-concat-bridge│ ───────────► │ concat --mcp │
│  (PHP)   │ ◄────────────── │ engine │ ◄──────────── │  (tools/, Node)  │ ◄─────────── │  (headless)  │
└──────────┘   hasil + path  └────────┘   JSON hasil  └──────────────────┘              └──────────────┘
                                                                                              │ export .mp4
                                              supervisor review ──► UPLOAD TO YOUTUBE STUDIO (KRA)
```

Concat tetap **proses terpisah**; tidak ada kode Concat yang ditautkan ke
PHP/JS KRA. Bridge menerjemahkan `POST /call {tool, arguments}` menjadi
`tools/call` MCP dan mengembalikan `structuredContent` Concat apa adanya.

## Komponen

| Bagian | Lokasi |
|---|---|
| Source Concat (snapshot) | `concat/` — commit `f0c0169…`, lisensi AGPL-3.0 |
| Bridge HTTP→MCP (zero-dep Node) | `tools/kra-concat-bridge/server.js` |
| Tiruan MCP untuk uji tanpa Concat | `tools/kra-concat-bridge/fake-concat-mcp.js` |
| Contoh workflow siap jalan | `n100n/workflows/contoh-concat-edit.json` |
| Dokumen MCP upstream | `concat/docs/MCP.md` |

## Menjalankan di mesin Anda

1. **Siapkan binary Concat** (pilih satu):
   - Rilis resmi: https://github.com/jub0t/Concat/releases (disarankan).
   - Build dari source bundel: ikuti `concat/CONTRIBUTING.md`
     (butuh toolchain Rust; workspace di `concat/src/`).
2. **Jalankan bridge** dari root repo KRA:

   ```bat
   set CONCAT_BIN=C:\Program Files\Concat\concat.exe
   set BRIDGE_TOKEN=<token-acak-panjang>
   node tools\kra-concat-bridge\server.js
   ```

   Detail env (`BRIDGE_PORT`, `CONCAT_MCP_MODE`, `CONCAT_MCP_ROOTS`, …) ada
   di `tools/kra-concat-bridge/README.md`.
3. **Arahkan n100n ke bridge** — di `n100n/.env`:

   ```env
   KRA_CONCAT_BRIDGE_URL=http://127.0.0.1:5681
   KRA_CONCAT_BRIDGE_TOKEN=<token-yang-sama-dengan-BRIDGE_TOKEN>
   CONTOH_CONCAT_DIR=C:\Users\<Anda>\Videos\KRA
   CONTOH_CONCAT_MEDIA=C:\Users\<Anda>\Videos\KRA\mentah.mp4
   CONTOH_CONCAT_OUTPUT=C:\xampp\htdocs\kantor-rama-ai\n100n\files\hasil-akhir.mp4
   CONTOH_CONCAT_TITLE=Judul Pembuka Video
   ```

   Perhatikan: Concat headless hanya menulis di bawah **folder home**
   pengguna. Karena contoh di atas mengekspor ke `n100n\files` (di luar
   home), jalankan bridge dengan:

   ```bat
   set CONCAT_MCP_ROOTS=C:\xampp\htdocs\kantor-rama-ai\n100n\files
   ```

   …agar hasil export langsung mendarat di folder media yang dikenali
   uploader YouTube KRA.
4. **Jalankan workflow** *Contoh: Edit Video Concat (bridge MCP)* dari UI
   n100n atau dari panel N100N Workflow Bridge di Creator KRA. Item input
   dapat menimpa env per run:

   ```json
   [{ "location": "C:/Users/Anda/Videos/KRA", "name": "Episode 12",
      "media": "C:/Users/Anda/Videos/KRA/mentah.mp4",
      "title": "Judul di layar",
      "output": "C:/xampp/htdocs/kantor-rama-ai/n100n/files/ep12.mp4" }]
   ```

   Alur node: `project_create → media_import → clips_add_sequence →
   title_add → project_save → export_start → export_wait`. Hasil akhir
   item berisi `output_file` dan `siap_upload_youtube: true`.
5. **Review & upload**: supervisor memeriksa file hasil, lalu mengirimnya
   lewat **Creator → INTEGRATION SETTINGS → UPLOAD TO YOUTUBE STUDIO**
   (lihat `docs/YOUTUBE-INTEGRATION.md`). Workflow ini sengaja *tidak*
   mengupload apa pun secara otomatis.

## Mengembangkan alurnya

- Daftar tool + skema argumen Concat selalu bisa dilihat dari
  `GET http://127.0.0.1:5681/tools` (dibangkitkan Concat dari tipe API-nya):
  trim/split/move klip, keyframe, efek, captions, template, `preview_frame`
  (frame PNG untuk dicek agen vision), dll.
- Pola node yang dipakai contoh ini mudah diperluas: **code** (susun
  `call = {tool, arguments}` dari rencana + hasil sebelumnya) → **http**
  (`POST {{bridge}}/call`, body `"{{ $json.call }}"`) → **code** (periksa
  `$json.ok`, ambil `$json.data`).
- Untuk potongan vertikal Shorts/Reels, kirim
  `"video": { "width": 1080, "height": 1920, "rateNum": 30, "rateDen": 1 }`
  pada item input.

## Uji tanpa Concat asli

Lihat bagian "Uji tanpa Concat asli" di `tools/kra-concat-bridge/README.md`
— bridge diarahkan ke `fake-concat-mcp.js`, lalu workflow contoh dijalankan
lewat API n100n; seluruh rantai (17 node) harus berakhir `status: success`
dengan `state: "done"`. Rangkaian ini sudah dijalankan dan dicatat di
`docs/LAPORAN-INTEGRASI-N100N-YOUTUBE-CONCAT.md`.

## Lisensi & pemeliharaan snapshot

Concat berlisensi **AGPL-3.0-or-later**; file `concat/LICENSE` wajib tetap
ada. Karena KRA hanya memanggilnya sebagai proses terpisah lewat MCP,
lisensi kode KRA tidak berubah. Bila Anda memodifikasi Concat dan
mendistribusikannya (termasuk menyediakan lewat jaringan), source
modifikasi Concat wajib dibuka dengan lisensi yang sama. Cara memperbarui
snapshot `concat/` ke commit upstream yang lebih baru dijelaskan di
`concat/UPSTREAM.KRA.md`.
