# Laporan Upgrade Creator — 1 Nov 2026

Lima peningkatan dikerjakan sesuai urutan yang disetujui: (1) Creator Skill Pack,
(2) Integrasi Telegram, (3) Group chat respons cepat, (4) Konsol mobile,
(5) Loop YouTube Analytics. Laporan ini membedakan dengan tegas mana yang
**terverifikasi otomatis di sandbox** dan mana yang **butuh smoke-test pemilik**
(sandbox tidak punya runtime PHP, GUI Electron, maupun kredensial asli).

---

## 1) Creator Skill Pack — 11 skill baru untuk 4 specialist

| Specialist | Skill baru |
| --- | --- |
| Nara `creator_research` | trend-radar, fact-check, analytics-review |
| Aruna `creator_writer` | hook-smith, retention-script, seo-metadata, repurpose-shorts |
| Dito `creator_producer` | shot-list, concat-edit-brief, repurpose-shorts |
| Lintang `creator_reviewer` | policy-guard, prepublish-qa, fact-check, analytics-review |

- File: `resources/skills/creator-*/SKILL.md`; semuanya terdaftar **approved** di
  `resources/skills/SKILLS_LOCK.json` dengan SHA-256 byte-perfect (total 116 skill).
- `KraSkillEngine` kini memetakan keempat specialist Creator; menyebut ID skill
  (mis. `/creator-hook-smith`) di pesan memaksa skill itu aktif; blok
  `## Ringkasan aturan` (maks. 4 skill × ±700 karakter) disuntikkan ke prompt —
  sebelumnya hanya nama skill yang masuk prompt.
- `creator-concat-edit-brief` wajib menghasilkan satu blok JSON array berisi satu
  item `{location,name,media,title,output,video?}` siap ditempel ke workflow
  `contoh-concat-edit` (N100N → bridge → Concat MCP).
- UI: balasan live di Studio Terminal menampilkan chip `⚡ skill-aktif` di bubble.

## 2) Telegram — pantau & approve dari HP

- Backend: `api/lib/KraTelegramBridge.php` (Bot API, webhook + secret header,
  pairing satu chat privat, perintah `/status /proposal /tugas /crew /n100n
  /youtube /help`, tombol **✅ Setujui / ❌ Tolak** proposal via inline keyboard).
- Token write-only di server (`KraIntegrationSettings`), panel di Creator
  Integration Settings → **TELEGRAM · BOT MONITOR**. Panduan:
  [`docs/TELEGRAM-INTEGRATION.md`](TELEGRAM-INTEGRATION.md).
- Notifikasi otomatis: proposal baru & upload YouTube sukses.
- Tambahan perbaikan: `api/index.php` kini memuat `KraYouTubeUploader.php`
  (sempat hilang dari daftar require — upload akan gagal tanpanya).

**Yang perlu Anda lakukan (±5 menit):**
1. Chat **@BotFather** → `/newbot` → simpan bot token (jangan bagikan ke chat mana pun).
2. Panel Telegram di KRA → tempel token → **SAVE TOKEN** → **BUAT KODE PAIRING** →
   kirim `/start KODE` ke bot Anda → isi Base URL publik HTTPS → **DAFTARKAN WEBHOOK** → **KIRIM TES**.
3. Catatan: perintah *masuk* butuh KRA terjangkau internet (deploy HTTPS atau
   tunnel). Notifikasi keluar bekerja dari KRA lokal sekalipun.

## 3) Group chat Studio Crew — paralel + typing indicator

- Server: flag `fanout` mempersempit satu request ke satu specialist; hanya
  request `fanoutPrimary` yang mencatat pesan user (tidak duplikat 4×).
- Klien: 4 request berjalan **bersamaan**; bubble "sedang mengetik" per agen
  diganti di tempat saat balasan tiba (urutan tetap stabil); status menampilkan
  progres `n/4 selesai`. Ada pengaman kompatibilitas bila server lama tanpa fanout.
- Desktop: `PHP_CLI_SERVER_WORKERS=4` untuk server PHP bawaan (POSIX).
  **Di Windows `php -S` tetap satu proses** sehingga request mengantre — kecepatan
  tidak berubah di desktop Windows lokal, tetapi typing UI tetap terasa; di hosting
  Apache/produksi paralel penuh (≈ waktu agen terlambat, bukan jumlahnya).

## 4) Konsol mobile

- `web/mobile.css` (aditif, hanya `@media ≤820px` — desktop tidak berubah):
  input 16px (anti zoom-otomatis iOS), target sentuh ≥38px, modal menjadi sheet
  nyaris layar-penuh, titlebar ringkas, safe-area iPhone, tabel bisa digeser.
- PWA dasar: `web/manifest.webmanifest` + `web/kra-icon.svg` + meta theme-color/
  apple → KRA dapat **Add to Home Screen** dan tampil standalone.
  (Service worker sengaja tidak dipasang agar tidak ada cache basi untuk konsol admin.)

## 5) YouTube Analytics loop

- Consent OAuth kini meminta `yt-analytics.readonly` (selain readonly + upload).
- `KraYouTubeOAuth::analyticsSummary()`: total 28 hari (views, watch jam,
  rata-rata tonton, subscriber bersih, likes, komentar) + top 5 video (judul dari
  Data API). Action supervisor `youtube-analytics`; kartu **CHANNEL ANALYTICS ·
  28 HARI** di panel YouTube (auto-load saat channel terhubung).
- Tindak lanjut: minta Nara/Lintang membaca kartu lalu menelaah dengan
  `/creator-analytics-review` di Studio Terminal.

**Yang perlu Anda lakukan (sekali):**
1. Google Cloud Console (proyek OAuth yang sama) → **Enable "YouTube Analytics API"**.
2. Di KRA klik **AUTHORIZE / Connect sekali lagi** agar consent memasukkan scope
   analytics. Setelah itu kartu Analytics terisi otomatis.

---

## Hasil pengujian

### Uji runtime PHP asli — `tools/runtime-harness/` (PHP 8.3.33 via WebAssembly)
Backend dieksekusi sungguhan terhadap file repo (host FS), bukan hanya diparsing:

| Pengujian | Hasil |
| --- | --- |
| 31 kasus runtime (`run.mjs`): digest skill pack, token/pairing/secret Telegram, proposal→callback approve, fan-out 1-vs-4 recipient, analytics error path | ✅ **31/31 PASS** |
| Lint parser PHP asli (`lint.php`, token_get_all TOKEN_PARSE) — 38 file `api/` | ✅ 0 gagal |
| `tools/verify-skills.php` bawaan repo, dieksekusi penuh | ✅ PASS semua |
| Bridge HTTP→MCP vs fake Concat (`e2e-bridge.mjs`): create/import/export_start/export_wait | ✅ 4/4 |
| Suite test N100N (`npm test`) | ✅ 43/43 |

Bug yang ditemukan uji runtime ini & sudah diperbaiki:
1. Specialist Creator yang diminta eksplisit di channel Office sebelumnya *diam-diam* dialihkan ke persona Office — sekarang ditolak tegas (sesuai maksud `verify-chat-modes`).
2. Entri balasan error tidak membawa `routing` — sekarang konsisten dengan entri sukses.
3. `routing.skills` kurang-lapor (hanya pilihan kata-kunci router) padahal prompt memakai set default — sekarang melaporkan skill efektif via `KraSkillEngine::activeSkills()` (satu sumber kebenaran dengan `digest()`), chip UI jadi akurat.
4. Secret webhook Telegram kini dirotasi tiap pendaftaran dan hanya disimpan setelah Telegram menerimanya.

### Uji statis (sandbox Node 22)

| Pemeriksaan | Hasil |
| --- | --- |
| `tools/verify-creator-upgrades.js` (baru, 40+ assertion incl. hash lock) | ✅ PASS |
| 20 verify script repo lain yang dapat berjalan | ✅ PASS (2 assertion lama diperbarui ke kontrak fan-out: `verify-chat-modes`, `verify-creator-roster`) |
| `node --check` `web/app.js`, `desktop/main.js` | ✅ OK |
| 6 verify script (atlas/landscape/pathfinding/render-queue/transit) | ⚠️ gagal dimuat di sandbox (modul `three`/node_modules tidak terpasang) — sudah begitu sebelum perubahan ini, bukan regresi |
| `verify-phase3-skills.php` | ⚠️ butuh MySQL sejak assertion pertama — tidak dapat dinilai di sandbox |
| Live: Telegram Bot API (token asli), Google OAuth/Analytics, provider chat live, Electron, Concat asli (Rust) | ⏳ **butuh smoke-test pemilik** — jaringan sandbox tidak punya rute ke `api.telegram.org`/`googleapis.com`, dan token/consent adalah milik pemilik (tidak pernah ditempel di chat). Di sandbox, panggilan keluar terbukti berhenti rapi di lapisan transport tanpa fatal. |

### Checklist smoke-test pemilik (±10 menit)
1. Studio Terminal → tab Studio Crew → kirim 1 pesan: 4 bubble typing muncul, balasan 4 agen masuk (chip ⚡ terlihat), status akhir menampilkan "paralel".
2. Tulis `/creator-concat-edit-brief ...` ke Dito → keluaran berisi satu blok JSON array.
3. Setup Telegram sesuai langkah 2 → `/status` terbalas → buat proposal dari chat → notifikasi masuk & tombol approve bekerja.
4. Enable YouTube Analytics API → Connect ulang → kartu Analytics menampilkan angka 28 hari.
5. Buka KRA dari HP (jaringan sama/hosting) → Add to Home Screen → layout satu kolom, modal settings nyaman disentuh.

---

## Addendum — Fleksibilitas perintah agen (1 Nov 2026, sesi lanjutan)

Hasil analisis potensi kegagalan penerimaan/eksekusi perintah (dibuktikan
dengan probe runtime), lalu diperbaiki:

| # | Temuan (terbukti via probe) | Perbaikan |
| --- | --- | --- |
| 1 | Perintah natural ("buatkan naskah…", "tulis script lalu simpan") tidak pernah jadi tugas — gerbang proposal hanya kenal frasa persis | `isCreateRequest()`: kata kerja buat/tulis/susun + kata benda artefak (naskah/script/laporan/dokumen/…), "simpan sebagai…", "jadikan tugas". Modify diperluas serupa. Tombol manual **📌 Jadikan Tugas** di setiap bubble agen (Studio + Office) |
| 2 | Isi proposal bisa stub kosong bila AI tidak memakai code fence; `/create laporan.md` mengabaikan nama file | Target kode tanpa fence → **tidak** dibuat proposal; target dokumen memakai isi balasan utuh; nama file telanjang dikenali; default dokumen `proposals/<slug>.md` |
| 3 | Tanpa MySQL riwayat chat hilang total → agen amnesia antar-pesan | Fallback JSON `.temp/chat-history.json` (flock, maks. 300/channel) di `KraDb::logChat/getChatHistory` |
| 4 | Router: kata "creator" menarik skill acak & memotong set efektif; "cek fakta" (ID) tidak cocok dengan ID skill Inggris; sapaan berisi "lalu" menjadi ReAct; "budidaya"→Budi, "dimasa"→Dimas | Stopword fragmen generik + alias kata-kunci Indonesia per skill; sinyal ReAct berbasis frasa; resolusi nama agen pakai word-boundary |
| 5 | Folder proyek basi (dipindah/dihapus) membunuh semua chat | Diturunkan jadi peringatan `workspaceWarning` — chat berjalan tanpa workspace, status UI menampilkannya (Studio + Office) |
| 6 | Fan-out paralel tidak bisa konvergen; fallback model & skill tertahan tak terlihat; kegagalan N100N/upload senyap | Mode **💬 Diskusi** (berurutan, saling membaca) di samping ⚡ Paralel, tersimpan per browser; baris meta `↪ fallback` & `⏸ ditahan` di bubble kedua mode; notifikasi Telegram saat workflow N100N gagal dimulai & upload YouTube gagal |

Pengujian addendum: harness runtime bertambah 13 kasus regresi (T30–T42) →
**44/44 PASS**, lint PHP 38/38, `verify-skills.php` lulus penuh, bridge E2E
4/4, 21 verify script JS lulus (1 assertion diperbarui ke kontrak mode ganda).

Catatan desain yang disengaja: perintah "buatkan hook/judul/caption" *tidak*
otomatis jadi file (biasanya diinginkan inline di chat) — tombol Jadikan
Tugas adalah jalurnya. Proposal tetap selalu `WAITING_APPROVAL`.

## Berkas kunci yang berubah
`resources/skills/creator-*/` (11 baru) + `SKILLS_LOCK.json` ·
`api/lib/{KraSkillEngine,KraIntegrationSettings,KraTelegramBridge(baru),
KraTaskEngine,KraAgentChat,KraYouTubeOAuth}.php` · `api/index.php` ·
`web/{index.html,app.js,creator_mode.css,creator_studio_terminal.css,
mobile.css(baru),manifest.webmanifest(baru),kra-icon.svg(baru)}` ·
`desktop/main.js` · `tools/verify-creator-upgrades.js(baru)` ·
`docs/TELEGRAM-INTEGRATION.md(baru)`.
