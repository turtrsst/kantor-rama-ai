# Laporan Integrasi N100N · YouTube · Concat

**Tanggal:** 1 November 2026 · **Branch:** `arena/cbf4b10e-kantor-rama-ai`
**Permintaan:** (1) N100N menjadi sub-app menyatu di KRA, (2) CREATOR
INTEGRATION SETTINGS dibuat asli agar YouTube Studio tersambung dan bisa
mengirim video langsung, (3) repo Concat diklon ke KRA dan masuk workflow
AI Agent N100N untuk editing.

## Ringkasan

| # | Permintaan | Status |
|---|---|---|
| 1 | N100N satu paket sebagai sub-app KRA | ✅ Selesai — source sudah vendored & mutakhir; kini auto-start + auto-pairing dari aplikasi desktop, tombol OPEN N100N APP berfungsi lokal |
| 2 | YouTube asli (Client ID/Secret Google Cloud Anda) sampai bisa kirim ke YouTube Studio | ✅ Selesai di sisi kode — OAuth upload-scope + auto-refresh + resumable upload + form UI. Tinggal Anda isi kredensial & klik AUTHORIZE (checklist di bawah) |
| 3 | Concat diklon & masuk workflow N100N | ✅ Selesai — source ter-vendor di `concat/`, bridge MCP→HTTP dibuat, workflow contoh end-to-end lulus uji |

---

## 1. N100N sebagai sub-app KRA

**Kondisi awal:** source N100N (repo Anda sendiri, `turtrsst/n100n`) sebenarnya
sudah tersalin ke `n100n/` pada commit sebelumnya — dan sudah **persis sama
dengan HEAD upstream** (`77fe261…`), jadi tidak ada yang perlu disalin ulang.
Yang kurang: ia hanya "source yang ikut repo", belum hidup sebagai sub-app
(dokumen lama bahkan menegaskan bundling tidak menjalankannya).

**Yang dikerjakan** (`desktop/main.js`, `web/app.js`, `docs/N100N_DEPLOYMENT.md`):

- Aplikasi desktop kini **menyalakan N100N otomatis** saat KRA dibuka
  (probe port 5679 → bila sudah jalan sendiri, tidak diganggu; bila belum,
  spawn `node --env-file=.env n100n/server.js`, tunggu siap, matikan saat
  KRA ditutup). Bisa dimatikan dengan `KRA_N100N_AUTOSTART=0`.
- **First-run tanpa setting manual:** `n100n/.env` dibuat otomatis dari
  `.env.example` dengan `APP_PASSWORD`/`APP_SECRET`/`APP_API_TOKEN`/
  `KRA_API_KEY` acak (nilai yang sudah ada tidak ditimpa). Password login UI
  = `APP_PASSWORD` di file tersebut.
- **Pairing dua arah otomatis** di mode desktop: token diteruskan ke PHP
  (`KRA_N100N_API_KEY`, `KRA_FLOW_API_KEY`) dan ke N100N (`KRA_TUGAS_URL`,
  `KRA_API_KEY`) lewat environment proses — panel N100N di Creator langsung
  "connected" tanpa copy-paste token.
- Tombol **OPEN N100N APP** kini muncul juga untuk instalasi lokal
  sama-mesin (sebelumnya hanya HTTPS publik), dan di Electron membuka
  browser sistem. Jaminan lama tetap ada: URL ber-kredensial/query tidak
  pernah ditautkan, dan halaman publik tidak menautkan endpoint privat —
  verifier `tools/verify-n100n-bundle.js` diperbarui untuk mengunci
  kebijakan baru ini.
- Status sub-app tersedia via IPC `kra:get-runtime-status`.

## 2. YouTube: dari read-only menjadi bisa upload (asli)

**Kondisi awal:** integrasinya sebenarnya sudah asli dan rapi (OAuth beneran,
secret di luar web root mode 0600, state anti-CSRF, revoke saat disconnect) —
tetapi **sengaja dibatasi read-only**: scope hanya `youtube.readonly`, tidak
ada refresh token, tidak ada upload sama sekali (kode agen bahkan dilarang
mengklaim bisa upload).

**Yang dikerjakan:**

- **Scope upload**: authorize kini meminta `youtube.readonly` +
  `youtube.upload`. Scope yang benar-benar diberikan Google disimpan;
  UI menampilkan status "Upload permission granted" atau meminta
  authorize ulang bila koneksi lama belum mencakupnya.
- **Auto-refresh token** (`KraYouTubeOAuth::accessToken()`) — upload tidak
  akan gagal hanya karena access token berumur 1 jam.
- **Uploader resmi** (`api/lib/KraYouTubeUploader.php`): protokol *resumable
  upload* YouTube Data API v3 — buka sesi → kirim per 8 MiB → lanjutkan dari
  offset Google bila putus → thumbnail opsional. File sumber hanya dari
  folder media server (`.temp/`, `files/`, `n100n/files/`, `KRA_MEDIA_DIR`)
  dengan path relatif anti-traversal.
- **Action `youtube-upload`** (supervisor, wajib `confirm: true`) — satu-
  satunya pintu upload; agen AI tidak bisa memicunya sendiri. Guardrail
  teks di `KraAgentChat`/`KraReActEngine` dan artefak approval workflow
  diperbarui mengakui kemampuan ini dengan syarat video ID sebagai bukti.
- **Form upload** di CREATOR INTEGRATION SETTINGS (file, judul, deskripsi,
  tags, thumbnail, visibilitas, made-for-kids, checkbox konfirmasi).
- **Alur desktop diperbaiki:** AUTHORIZE di Electron kini membuka browser
  sistem (navigasi keluar memang diblokir shell) lalu KRA mem-polling status;
  callback mendarat di halaman statis `web/youtube-connected.html`. Ditambah
  endpoint callback bersih `api/youtube-callback.php` untuk didaftarkan di
  Google Cloud.
- Panduan lengkap: `docs/YOUTUBE-INTEGRATION.md`.

**Yang harus Anda lakukan** (kredensial tidak pernah saya minta/lihat):

1. Google Cloud Console: pastikan **YouTube Data API v3** aktif; consent
   screen berisi scope `youtube.readonly` + `youtube.upload`; klik
   **Publish app (Production)** agar refresh token tidak mati 7 hari.
2. Daftarkan redirect URI sesuai cara Anda menjalankan KRA, mis.
   `http://127.0.0.1:8088/api/youtube-callback.php` (desktop) atau
   `http://localhost/kantor-rama-ai/api/youtube-callback.php` (XAMPP).
3. Di KRA: Creator → INTEGRATION SETTINGS → isi Client ID/Secret/Redirect
   URI yang sama persis → SAVE → **AUTHORIZE YOUTUBE CHANNEL**.

**Batasan dari Google (di luar kendali KRA):** project yang belum diaudit
YouTube API Services dipaksa **private** untuk semua upload API — video tetap
masuk YouTube Studio sebagai draft dan bisa Anda publish dari sana (sesuai
tujuan "mengirim langsung ke YouTube Studio"). Kuota default 10.000
unit/hari = ±6 upload/hari (1600 unit per upload).

## 3. Concat masuk workflow N100N

- **Source ter-vendor** di `concat/` dari `github.com/jub0t/Concat` @
  `f0c0169628c61de7311f7fc15ee5be82dd611d2e` (1.259 file, ±47 MB, tanpa
  `.git`), mengikuti pola `n100n/UPSTREAM.md` — lengkap dengan
  `concat/UPSTREAM.KRA.md`, blokir `.htaccess`, dan catatan lisensi
  **AGPL-3.0** (KRA memanggilnya sebagai proses terpisah → lisensi KRA
  tidak terpengaruh).
- **Bridge baru** `tools/kra-concat-bridge/server.js`: HTTP kecil tanpa
  dependency yang menjalankan `concat --mcp headless` dan meneruskan
  `POST /call {tool, arguments}` ke MCP stdio Concat, mengembalikan
  `structuredContent` apa adanya. Skema argumen tool diambil dari source &
  tes e2e upstream (`project_create {location,name,video}`,
  `media_import {path,file}`, `clips_add_sequence {path,mediaIds,start}`,
  `title_add`, `export_start {path,output,preset}`, `export_wait {job,…}`),
  bukan tebakan.
- **Workflow contoh** `n100n/workflows/contoh-concat-edit.json` (17 node,
  ter-seed otomatis): buat proyek → impor media → susun klip → judul →
  simpan → export → tunggu selesai; item akhir menandai
  `siap_upload_youtube` untuk diteruskan supervisor ke uploader KRA.
- Panduan: `docs/CONCAT-INTEGRATION.md` + kartu Concat baru di Creator.

---

## Hasil uji coba (dijalankan di sandbox)

| Uji | Hasil |
|---|---|
| `npm --prefix n100n test` (suite upstream) | ✅ **43/43 lulus** |
| Bridge + fake Concat MCP: `/health`, `/tools`, `/call` | ✅ hidup, handshake + tool roundtrip benar |
| Workflow `contoh-concat-edit` via API n100n (17 node) | ✅ `status: success`, output `state: "done"`, `siap_upload_youtube: true` |
| Desktop main (stub Electron): auto-buat `n100n/.env`, deteksi instance berjalan, spawn instance baru sampai "Sub-app ready", absennya PHP tertangani | ✅ semua jalur terbukti |
| Sintaks PHP 8 file berubah (php-parser) + `node --check` JS | ✅ bersih |
| 8 verifier repo (chat-modes, creator-roster, three-office, n100n-bundle, header-ui, office-roster, server-security, vault-settings) | ✅ semua lulus |

**Tidak bisa diuji dari sandbox ini** (jujur dicatat, bukan dilewati diam-diam):

| Hal | Kenapa | Cara uji di mesin Anda |
|---|---|---|
| Login Google & callback asli | Egress sandbox tidak mengizinkan googleapis.com | Ikuti checklist §2 di atas; status harus "CONNECTED · nama channel" |
| Upload video sungguhan | Butuh token asli + egress Google | Upload file kecil sebagai Private; cek muncul di YouTube Studio dan link balasan KRA bisa dibuka |
| GUI Electron penuh | Binary Electron tidak bisa diunduh di sandbox | `npm start` → log harus memuat `[KRA N100N] Sub-app ready`; tombol OPEN N100N APP membuka UI :5679 |
| Binary Concat asli (Rust) | Tidak ada cargo/display; build Rust berat | Pasang rilis Concat → arahkan `CONCAT_BIN` → jalankan workflow contoh pada footage asli (bridge/workflow sudah teruji melawan tiruan yang mengikuti protokol & skema upstream persis) |

## File yang berubah

- **Baru:** `concat/` (snapshot upstream), `tools/kra-concat-bridge/`
  (server + fake + README), `n100n/workflows/contoh-concat-edit.json`,
  `api/lib/KraYouTubeUploader.php`, `api/youtube-callback.php`,
  `web/youtube-connected.html`, `docs/YOUTUBE-INTEGRATION.md`,
  `docs/CONCAT-INTEGRATION.md`, laporan ini.
- **Diubah:** `desktop/main.js`, `api/index.php`,
  `api/lib/KraYouTubeOAuth.php`, `api/lib/KraIntegrationSettings.php`,
  guardrail `KraAgentChat.php`/`KraReActEngine.php`/`KraCreatorWorkflowFactory.php`,
  `web/index.html`, `web/app.js`, `web/creator_mode.css`, `.htaccess`,
  `docs/N100N_DEPLOYMENT.md`, `tools/verify-n100n-bundle.js`.

## Langkah Anda berikutnya (berurutan)

1. `git pull` branch ini di mesin Anda → jalankan KRA seperti biasa
   (desktop: N100N menyala sendiri; login UI-nya pakai `APP_PASSWORD` dari
   `n100n/.env` yang dibuatkan otomatis).
2. Selesaikan checklist Google Cloud §2 → AUTHORIZE → uji upload Private
   satu video pendek.
3. Pasang binary Concat (rilis resmi) → jalankan bridge
   (`CONCAT_BIN=... node tools\kra-concat-bridge\server.js`) → isi env
   `CONTOH_CONCAT_*` di `n100n/.env` → jalankan workflow *Contoh: Edit Video
   Concat* → review hasil → upload dari Integration Settings.
4. Bila semua mulus, alur Creator Anda lengkap: **Studio Crew (naskah) →
   N100N workflow → Concat (edit+export) → review → YouTube Studio**.
