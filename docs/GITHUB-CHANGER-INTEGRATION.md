# Integrasi GitHub Changer ↔ Kantor-Rama-AI (KRA)

Dokumen ini menjelaskan **bundel + jembatan dua arah** antara dashboard
[`turtrsst/github-changer`](https://github.com/turtrsst/github-changer) dan
project KRA. Polanya sengaja disamakan dengan integrasi
[`n100n/`](../n100n/) (lihat [`docs/N100N_DEPLOYMENT.md`](N100N_DEPLOYMENT.md)):
satu repo, beberapa runtime.

| Fakta | Nilai |
| --- | --- |
| Branch deploy KRA | **`arena/cbf4b10e-kantor-rama-ai`** (yang dipakai domain) |
| Sumber bundle | `turtrsst/github-changer` @ `arena/a2271201-github-changer`, commit `0635992476a2e0a53e795aeaf50dc2638981ef41`, v1.0.2 |
| Lokasi bundle | `github-changer/` (Node.js ≥ 18, zero dependency) |
| Port service | `4173` (default bind `127.0.0.1`) |
| Port KRA | PHP `:8088` (atau Apache), N100N `:5679` |
| Provenance | [`github-changer/UPSTREAM.md`](../github-changer/UPSTREAM.md) |

> ⚠️ **Push source ke GitHub tidak otomatis menyalakan service.** Sama seperti
> N100N, GitHub Changer adalah proses Node persisten. Kode yang dibundel baru
> berguna setelah prosesnya dijalankan di mesin yang benar (atau dinyalakan
> otomatis oleh desktop KRA).

---

## 1. Arsitektur

```text
┌──────────────────────────── KRA (PHP / Electron) ───────────────────────────┐
│  web/index.html  ✦ GitHub Changer (tombol header + menu Settings)           │
│        │  GET  api/index.php?action=github-changer-status / repos / activity │
│        │  POST github-changer-config / github-changer-sync                   │
│        ▼                                                                     │
│  api/lib/KraGitHubChangerClient.php  ── x-api-key ──┐                        │
│  api/lib/KraIntegrationSettings.php (rahasia privat)│                        │
└────────────────────────────────────────────────────┼────────────────────────┘
                                                     │ HTTP :4173
┌──────────────────────── GitHub Changer (Node) ─────▼────────────────────────┐
│  /api/kra/status · /repos · /activity · /sync   (x-api-key, tanpa sesi UI)  │
│  /webhook/github ── HMAC GitHub ──► git pull KRA ──► notifikasi HMAC ke KRA │
│  /api/index.php?action=github-changer-event ◄──────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │ git push / pull
                                      ▼
                        github.com/turtrsst/kantor-rama-ai
```

**Arah KRA → GitHub Changer**: PHP memanggil `/api/kra/*` memakai kunci
`x-api-key`. Endpoint ini *tidak* membutuhkan login OAuth dashboard, sehingga
status tetap bisa dibaca walau belum ada akun GitHub yang login di UI app.

**Arah GitHub Changer → KRA**: setiap run automasi (scheduler / webhook /
manual) mengirim ringkasan hasil ke `github-changer-event`, ditandatangani
`X-KRA-Signature: sha256=<HMAC>`. KRA menyimpan event terakhir (whitelist field)
dan menampilkannya di panel.

**Deploy (opsional)**: push ke branch `arena/cbf4b10e-kantor-rama-ai` →
[`.github/workflows/deploy-kra.yml`](../.github/workflows/deploy-kra.yml) →
CI `php -l` + `node --check` → sinyal HMAC ke `/webhook/github` di GitHub
Changer → `git pull` di mesin yang menyajikan domain.

---

## 2. Yang ditambahkan ke repo KRA

| Berkas | Fungsi |
| --- | --- |
| `github-changer/` | Snapshot aplikasi upstream + patch jembatan KRA (`UPSTREAM.md` merinci semuanya). |
| `api/lib/KraGitHubChangerClient.php` | Klien HTTP curl/streams, validasi URL, retry hanya untuk GET. |
| `api/lib/KraIntegrationSettings.php` | `githubChanger()` / `saveGitHubChanger()` / `githubChangerEvent()`; kunci disimpan privat per workspace, environment menang. |
| `api/index.php` | 6 action baru: `github-changer-status`, `-repos`, `-activity`, `-sync`, `-config`, `-event`. |
| `web/index.html`, `web/github_changer.js`, `web/github_changer.css` | Tombol akses di header, item menu Settings, panel status/konfigurasi, shortcut aman. |
| `desktop/main.js` | Auto-start sub-app + pairing rahasia otomatis (paritas N100N). |
| `Start GitHub Changer.bat` | Peluncur Windows/XAMPP. |
| `.htaccess`, `.gitignore` | Blok akses HTTP langsung ke source Node; `.env` / `data/` tidak masuk Git. |
| `.github/workflows/deploy-kra.yml` | Deploy HMAC opsional, **nonaktif** sampai `KRA_DEPLOY_ENABLED=true`. |
| `tools/verify-github-changer-bundle.js`, `tools/test-github-changer-client.php` | Verifikasi CI + unit test PHP tanpa jaringan. |

---

## 3. Menjalankan

### 3.1 Desktop KRA (paling mudah — pairing otomatis)

Buka aplikasi desktop KRA seperti biasa. `desktop/main.js` akan:

1. Membuat `github-changer/.env` dari `.env.example` bila belum ada, mengisi
   `KRA_GHC_API_KEY` dan `KRA_GHC_EVENT_SECRET` dengan nilai acak.
   Nilai yang sudah Anda isi **tidak ditimpa**.
2. Menyalakan `node github-changer/server/index.js` bila port 4173 belum
   dipakai, dan mematikannya saat KRA ditutup. Matikan dengan
   `KRA_GITHUB_CHANGER_AUTOSTART=0`.
3. Meneruskan ke proses PHP: `KRA_GITHUB_CHANGER_URL`,
   `KRA_GITHUB_CHANGER_API_KEY`, `KRA_GITHUB_CHANGER_EVENT_SECRET` — jadi panel
   langsung **CONNECTED** tanpa menyalin token manual.
4. Menyetel `KRA_GHC_EVENT_URL` ke `api/index.php?action=github-changer-event`
   pada server PHP yang aktif.

Status sub-app tersedia lewat IPC `kra:get-runtime-status` → `githubChanger`.

> Mode Apache/XAMPP: pairing environment desktop tidak berlaku. Isi koneksi
> lewat panel **GitHub Changer → SAVE CONNECTION** atau environment server
> (lihat tabel di bawah).

### 3.2 Windows / XAMPP manual

```bat
cd /d C:\xampp\htdocs\kantor-rama-ai
Start GitHub Changer.bat
```

Peluncur itu memanggil `node github-changer/scripts/pair-kra.js` yang mengisi
`KRA_GHC_API_KEY` + `KRA_GHC_EVENT_SECRET` di `.env` dan **mencetak** tiga
variabel yang harus diset di server PHP KRA (atau isi `base_url` + API key lewat
panel **GitHub Changer → SAVE CONNECTION**). Dari root repo juga bisa:
`npm run github-changer:pair -- --kra-url=http://127.0.0.1:8088`.
Nilai yang sudah ada tidak pernah ditimpa.

Untuk mode Apache/XAMPP set dulu `set "KRA_URL=http://127.0.0.1/kantor-rama-ai"`
(sebelum menjalankan `.bat`) supaya `KRA_GHC_EVENT_URL` benar; defaultnya
`http://127.0.0.1:8088` (PHP built-in desktop). **Kedua `*_EVENT_SECRET` hanya
dibaca dari environment PHP** — tidak ada kolom panel. Urutan lengkap
`git pull` + pairing + ketiga launcher ada di
[`DEPLOY-KRA-AUTOMATION-RUNBOOK.md`](DEPLOY-KRA-AUTOMATION-RUNBOOK.md).

Atau dari root repo: `npm run github-changer`. Buka
`http://127.0.0.1:4173`. **Ini bukan `http://localhost/github-changer/...`** —
kode Node tidak dijalankan Apache. `.htaccess` memang sengaja menolak akses
langsung ke folder `github-changer/`.

### 3.3 Linux / macOS

```bash
cd github-changer
cp .env.example .env
# isi GITHUB_CLIENT_ID + KRA_GHC_API_KEY + KRA_GHC_EVENT_SECRET
npm run doctor
npm start
```

Berkas `.env` dibaca otomatis oleh `github-changer/server/lib/env.js`
(tambahan bundle KRA, zero dependency; upstream hanya membaca environment
shell). Environment proses selalu menang atas isi `.env`.

---

## 4. Pairing rahasia

| Sisi | Variabel | Keterangan |
| --- | --- | --- |
| GitHub Changer (Node) | `KRA_GHC_API_KEY` | **Wajib** untuk mengaktifkan `/api/kra/*`. Tanpa ini endpoint menjawab 503. |
| GitHub Changer (Node) | `KRA_GHC_EVENT_SECRET` | Secret HMAC notifikasi ke KRA. |
| GitHub Changer (Node) | `KRA_GHC_EVENT_URL` | Default `http://127.0.0.1:8088/api/index.php?action=github-changer-event`. |
| KRA (PHP) | `KRA_GITHUB_CHANGER_URL` | URL yang bisa dijangkau **server PHP** (bukan browser). Default `http://127.0.0.1:4173`. |
| KRA (PHP) | `KRA_GITHUB_CHANGER_API_KEY` | **Harus sama** dengan `KRA_GHC_API_KEY`. |
| KRA (PHP) | `KRA_GITHUB_CHANGER_EVENT_SECRET` | **Harus sama** dengan `KRA_GHC_EVENT_SECRET`. |
| Desktop | `KRA_GITHUB_CHANGER_AUTOSTART=0` | Matikan auto-start. |
| Keduanya | `GITHUB_CLIENT_ID` | OAuth Device Flow untuk login GitHub asli (tidak ada client secret). |

Nilai yang disimpan lewat panel KRA bersifat **write-only**: tidak pernah
dikirim balik ke browser. Di hosted mode, `KRA_PRIVATE_CONFIG_DIR` wajib
berada di luar document root.

---

## 5. Tombol & panel UI

- **Header `✦ GitHub Changer`** — bila service hidup, langsung membuka
  dashboard di tab baru (di Electron lewat browser sistem). Bila belum
  terhubung, membuka panel supaya koneksi bisa disetel. Titik warna: hijau
  = connected, merah = offline/setup, kuning = sedang dicek.
- **Settings → Integrations → GitHub Changer** — selalu membuka panel status.
- Panel berisi: `OPEN GITHUB CHANGER ↗`, `CHECK CONNECTION`,
  `REPOS & RIWAYAT`, `SYNC NOW`, ringkasan (versi, jumlah repo, login GitHub,
  scheduler, branch guard, sinkronisasi terakhir, event bridge), dan form
  koneksi.

Shortcut browser hanya dibuat untuk (a) HTTPS publik, (b) host yang sama
dengan halaman KRA, atau (c) service privat/loopback saat browser juga berada
di LAN yang sama — loopback ditulis ulang ke host halaman. URL dengan
userinfo/query/fragment selalu ditolak (kebijakan identik dengan N100N).

`SYNC NOW` membutuhkan sesi **admin + supervisor**; `github-changer-config`,
`-repos`, dan `-activity` membutuhkan admin workspace (data repo memuat path
absolut mesin). Status ringkas tetap bisa dibaca viewer. Endpoint `-event` publik tetapi diawasi HMAC +
batas waktu 15 menit (anti replay).

### Daftar action API KRA

| Action | Method | Akses | Isi |
| --- | --- | --- | --- |
| `github-changer-status` | GET | viewer | Status koneksi, versi, repo, automasi, event terakhir. |
| `github-changer-repos` | GET | admin | Daftar repo hasil scan (path absolut mesin + URL remote sanitasi). |
| `github-changer-activity` | GET | admin | Riwayat Git `from → to` terakhir. |
| `github-changer-sync` | POST | admin + supervisor | Jalankan `runAutomation` (`fetch`/`pull`/`push`). |
| `github-changer-config` | GET/POST | admin | Baca/simpan URL + service key (write-only). |
| `github-changer-event` | POST | HMAC | Callback hasil automasi dari Node. |

Endpoint Node: `GET /api/kra/status`, `GET /api/kra/repos`,
`GET /api/kra/activity?limit=`, `POST /api/kra/sync` — semuanya wajib
`x-api-key`.

---

## 6. Publish / deploy ke branch `arena/cbf4b10e-kantor-rama-ai`

Integrasi ini dikerjakan di branch kerja Arena dan dipublikasikan lewat **PR**
ke branch deploy. Setelah di-merge:

1. **Mesin yang menyajikan domain harus `git pull`.** Push ke GitHub hanya
   menyimpan kode; PHP built-in server membaca file baru otomatis, tetapi
   **service Node GitHub Changer dan N100N harus tetap berjalan/restart**.
2. Jalankan `Start GitHub Changer.bat` (atau scheduled task / autostart
   desktop) di `C:\xampp\htdocs\kantor-rama-ai\github-changer`.
3. **Opsional — deploy otomatis.** Aktifkan di repo KRA:
   - Variables: `KRA_DEPLOY_ENABLED=true`, `KRA_DEPLOY_TARGET=notify`,
     `KRA_PHP_VERSION=8.4`.
   - Secrets: `KRA_DEPLOY_WEBHOOK_URL=https://ghc.<domain>/webhook/github`,
     `KRA_DEPLOY_WEBHOOK_SECRET` = `automation.webhookSecret`.
   - Di GitHub Changer: `automation.enabled=true`,
     `automation.branch=arena/cbf4b10e-kantor-rama-ai`,
     `automation.webhookRepository=turtrsst/kantor-rama-ai`,
     `automation.webhookBranch=arena/cbf4b10e-kantor-rama-ai`,
     `automation.repos=C:\xampp\htdocs\kantor-rama-ai`,
     `automation.onlyClean=true`, `automation.webhookEnabled=true`.
   - Pilih **salah satu** pemicu: webhook GitHub langsung **atau** workflow
     Actions, jangan dua-duanya (nanti `git pull` dua kali).
   - Contoh Cloudflare Tunnel (3 hostname + `/webhook/github`) ada di
     `github-changer/config/cloudflared-kra.yml.example` dan
     [`github-changer/docs/deploy-kra.md`](../github-changer/docs/deploy-kra.md).

> Pengaman `automation.branch` melewati repo yang tidak sengaja checkout di
> `main`, jadi domain tidak pernah salah menarik branch.

### Checklist keamanan sebelum publish

- 🔴 Jangan commit `github-changer/.env`, `github-changer/data/`,
  `api/config.json`, `.temp/`, atau `n100n/.env` (sudah di-`.gitignore`).
- 🔴 Repo KRA publik: lindungi domain dengan Cloudflare Access; ada
  `KraTerminalBridge` dan MySQL default tanpa password.
- 🔴 Isi `APP_PASSWORD` / `APP_SECRET` / `APP_API_TOKEN` N100N dengan nilai
  acak bila service dibuka ke jaringan; jangan pakai password bootstrap.
- ✅ Bootstrap GitHub Changer yang **tanpa sesi** kini menyembunyikan
  `automation.webhookSecret` dan `deployCommand`; UI yang sudah login tetap
  bisa menyalin secretnya sendiri.
- ✅ `/api/kra/*` nonaktif tanpa `KRA_GHC_API_KEY`, perbandingan kunci
  waktu-konstan, dan tidak memakai cookie dashboard.
- ✅ Callback KRA memverifikasi HMAC atas **body mentah** + `hash_equals` +
  jendela waktu; payload disimpan dengan whitelist field.

---

## 7. Verifikasi & troubleshooting

```bash
npm run github-changer:pair           # pairing manual XAMPP (cetak env untuk PHP)
npm run verify:github-changer-bundle   # struktur, keamanan, tombol, CI
npm run github-changer:test            # 79 tes offline termasuk /api/kra/*
npm run github-changer                 # jalankan service :4173
php tools/test-github-changer-client.php   # unit test PHP tanpa jaringan
npm run verify:n100n-bundle            # pastikan integrasi lama tetap utuh
```

| Gejala | Periksa |
| --- | --- |
| Panel `SETUP REQUIRED` | `KRA_GITHUB_CHANGER_API_KEY` (PHP) belum sama dengan `KRA_GHC_API_KEY` (Node). |
| `HTTP 503: KRA bridge nonaktif` | `KRA_GHC_API_KEY` kosong di proses Node; cek `.env` / environment. |
| `HTTP 401: x-api-key tidak cocok` | Dua kunci beda, atau ada spasi di `.env`. |
| Tombol shortcut tidak muncul | URL hanya bisa dijangkau server PHP (loopback di mesin lain). Pakai URL publik HTTPS atau host yang sama. |
| `SYNC NOW` dibalas 403 | Perlu sesi admin workspace + role supervisor. |
| Event terakhir tidak berubah | `KRA_GITHUB_CHANGER_EVENT_SECRET` (PHP) ≠ `KRA_GHC_EVENT_SECRET` (Node), atau `KRA_GHC_EVENT_URL` salah; cek selisih jam kedua proses (toleransi 15 menit). |
| `automation.branch` selalu `skipped` | Checkout server bukan `arena/cbf4b10e-kantor-rama-ai`. |
| Domain masih versi lama | Push/merge ke branch deploy, `git pull` di mesin domain, restart service Node. |
| `EADDRINUSE :4173` | Masih ada `npm start` lama; matikan atau `set PORT=4174`. |

---

## 8. Memperbarui snapshot upstream

Bundle ini **bukan fork otomatis**. Untuk menarik versi baru:

```bash
cd /tmp && git clone -b arena/a2271201-github-changer https://github.com/turtrsst/github-changer.git ghc-upstream
rsync -a --exclude '.git' --exclude 'data' --exclude '.env' --exclude 'node_modules' \
      --exclude '.github' /tmp/ghc-upstream/ /home/user/kantor-rama-ai/github-changer/
```

Lalu terapkan kembali patch KRA yang tercantum di
[`github-changer/UPSTREAM.md`](../github-changer/UPSTREAM.md)
(`server/lib/env.js`, `server/lib/kra.js`, rute `/api/kra/*`, redaksi bootstrap,
notifikasi `notifyKra`, `.env.example`, tes). Jalankan
`npm run verify:github-changer-bundle` dan `npm run github-changer:test`
sebelum commit.
