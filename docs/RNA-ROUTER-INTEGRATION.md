# Integrasi RNA Router ↔ KRA (gateway AI + automation)

Dokumen ini menjelaskan bundle **RNA Router** dan automation-nya di project KRA,
melanjutkan pola [`n100n/`](../n100n/) dan
[`docs/GITHUB-CHANGER-INTEGRATION.md`](GITHUB-CHANGER-INTEGRATION.md).

| Fakta | Nilai |
| --- | --- |
| Sumber | `turtrsst/RNA-Router` @ `arena/ffbada04-rna-router`, commit `34fcbf25e895ad6dd2e13ca5d83815b596dd95e3` (v1.0.0) |
| Lokasi bundle | `rna-router/` (Next.js 14 + Tailwind + Supabase/MySQL) |
| Port | `3000` |
| Provenance | [`rna-router/UPSTREAM.md`](../rna-router/UPSTREAM.md) |
| Branch deploy KRA | **`arena/cbf4b10e-kantor-rama-ai`** |

> ⚠️ **Berbeda dengan n100n/github-changer:** RNA Router **bukan zero dependency**.
> Ia butuh `npm ci` (dan `npm run build` untuk produksi) serta database Supabase/MySQL
> untuk key vault/usage. KRA **tidak** auto-start service ini di desktop.
> Yang zero dependency dan bisa langsung jalan adalah **automation**-nya.

---

## 1. Arsitektur

```text
┌──────────────── KRA (PHP / Electron) ─────────────────────────────────────┐
│ web/index.html   ⚡ RNA Router (tombol header + Settings → Integrations)  │
│   GET  api/index.php?action=rna-router-status / -models / -config          │
│   POST rna-router-chat (admin + supervisor)                                │
│   POST rna-router-event  ◄── HMAC ──┐                                     │
│   api/lib/KraRnaRouterClient.php     │                                     │
│   api/config.example.json → provider "rna-router" (chat agen KRA)         │
└─────────────────────────────────────┼─────────────────────────────────────┘
                                      │ HTTP :3000
┌──────────────── RNA Router (Next.js) ─▼───────────────────────────────────┐
│  GET  /api/health · GET /api/v1/models · POST /api/v1/chat/completions   │
│  Auto-fallback 429/quota → model lain  ·  /api/keys (key vault)           │
└──────────────────────────────▲────────────────────────────────────────────┘
                               │ polling tiap N menit
┌──────────────────────────────┴────────────────────────────────────────────┐
│ rna-router/scripts/kra-automation.js   ← zero dependency, Node ≥ 18       │
│ health + models (+ opsional chat probe) → laporan HMAC ke KRA             │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Yang ditambahkan

| Berkas | Fungsi |
| --- | --- |
| `rna-router/` | Snapshot upstream + `UPSTREAM.md`, `scripts/kra-automation.js`, `scripts/kra-automation.test.js`, skrip npm `automation:kra` / `test:automation`. |
| `api/lib/KraRnaRouterClient.php` | Klien HTTP server-side (health, models, chat). Validasi URL, retry hanya untuk GET, redaksi respons. |
| `api/lib/KraIntegrationSettings.php` | `rnaRouter()` / `saveRnaRouter()` / `rnaRouterEvent()`; kunci privat per workspace, environment menang. |
| `api/index.php` | 5 action: `rna-router-status`, `-models`, `-chat`, `-config`, `-event` (callback HMAC + anti-replay). |
| `api/config.example.json` | Provider **`rna-router`**: `baseUrl http://127.0.0.1:3000/api/v1`, model `muse-spark-1.2-free`, `fallbackProvider: ollama`. Jadi chat agen KRA bisa memakai gateway ini. |
| `web/rna_router.js`, `web/rna_router.css`, `web/index.html` | Tombol akses, panel status/health/model/automation, `TEST CHAT`, `SALIN PERINTAH AUTOMATION`, form koneksi. |
| `Start RNA Router.bat`, `Start RNA Router Automation.bat` | Peluncur Next.js dan scheduler automation. |
| `.htaccess`, `.gitignore` | Blok akses HTTP ke source Next.js; `.env.local`, `.next/`, `node_modules/`, log tidak masuk Git. |
| `tools/verify-rna-router-bundle.js`, `tools/test-rna-router-client.php` | Verifikasi struktur + unit test PHP tanpa jaringan. |

---

## 3. Menjalankan

### 3.1 Gateway

```bash
cd rna-router
cp .env.example .env.local    # isi NEXT_PUBLIC_SUPABASE_URL / keys atau DB_*
npm ci
npm run dev                   # http://127.0.0.1:3000
```

Dari root KRA: `npm run rna-router`. Windows/XAMPP: `Start RNA Router.bat`.
Untuk produksi: `npm --prefix rna-router run build && npm --prefix rna-router run start`.

Konfigurasi provider KRA (salin `api/config.example.json` → `api/config.json`,
file itu di-`.gitignore`):

```json
"rna-router": {
  "baseUrl": "http://127.0.0.1:3000/api/v1",
  "model": "muse-spark-1.2-free",
  "apiKeyEnv": "",
  "healthUrl": "http://127.0.0.1:3000/api/v1/models",
  "modelsUrl": "http://127.0.0.1:3000/api/v1/models",
  "fallbackProvider": "ollama"
}
```

`apiKeyEnv` sengaja kosong: gateway menerima request tanpa `x-api-key`.
Bila gateway Anda diamankan, isi via BYOK/overlay atau set env
`KRA_RNA_ROUTER_API_KEY` lalu sesuaikan konfigurasi. `fallbackProvider: ollama`
membuat chat KRA tetap hidup bila gateway sedang down.

### 3.2 Pairing secret (wajib sebelum automation)

`KRA_EVENT_SECRET` (Node) dan `KRA_RNA_ROUTER_EVENT_SECRET` (PHP) **hanya dibaca
dari environment** — tidak ada kolomnya di panel. Satu perintah menyamakannya:

```bat
"Pair KRA Event Secret.bat"
:: atau dari root repo: npm run rna-router:pair
```

Perintah ini menulis `rna-router/.kra-secrets.env` (gitignored) dengan **satu**
nilai acak untuk kedua variabel, lalu mencetak baris `SetEnv` (Apache/XAMPP)
atau `setx` (desktop/`php -S`) yang harus diterapkan ke proses PHP. Nilai lama
tidak pernah ditimpa. `scripts/kra-env.js` memuat file itu otomatis untuk
`kra-automation.js`; environment proses selalu menang.

**Panduan lengkap urut-urutan `git pull` → secret → 3 launcher ada di
[`DEPLOY-KRA-AUTOMATION-RUNBOOK.md`](DEPLOY-KRA-AUTOMATION-RUNBOOK.md).**

### 3.3 Automation (yang diminta)

```bash
# satu kali, untuk CI / uji
npm run rna-router:automation -- --once

# scheduler 15 menit + chat probe
KRA_EVENT_SECRET=<random> RNA_ROUTER_URL=http://127.0.0.1:3000 \
  npm run rna-router:automation -- --interval=15 --probe-chat
```

Windows: `Start RNA Router Automation.bat` (membaca `.kra-secrets.env` otomatis). Script **tidak butuh Next.js
berjalan di mesin yang sama** selama URL gateway bisa dijangkau; ia hanya
memanggil HTTP. Tanpa `KRA_EVENT_SECRET`, script tetap memantau tetapi hanya
mencetak laporan (dry-run), tidak mengirim ke KRA. Gunakan `--kra-url=`
pada pairing bila KRA disajikan Apache di `http://127.0.0.1/kantor-rama-ai`.

| Variabel | Sisi | Keterangan |
| --- | --- | --- |
| `RNA_ROUTER_URL` | Node | Default `http://127.0.0.1:3000`. |
| `RNA_ROUTER_API_KEY` | Node | Opsional, dikirim sebagai `x-api-key`. |
| `RNA_AUTOMATION_MODEL` | Node | Model untuk `--probe-chat`, default `muse-spark-1.2-free`. |
| `RNA_AUTOMATION_INTERVAL_MINUTES` / `--interval=N` | Node | Interval run. |
| `KRA_EVENT_URL` | Node | Default `http://127.0.0.1:8088/api/index.php?action=rna-router-event`. |
| `KRA_EVENT_SECRET` | Node | **Harus sama** dengan `KRA_RNA_ROUTER_EVENT_SECRET` di PHP. Diisi `.kra-secrets.env`. |
| `KRA_RNA_ROUTER_URL` | PHP | URL yang dijangkau server PHP. Default `http://127.0.0.1:3000`. |
| `KRA_RNA_ROUTER_API_KEY` | PHP | Opsional; tidak pernah dikirim ke browser. |
| `KRA_RNA_ROUTER_MODEL` | PHP | Model default untuk `TEST CHAT`. |
| `KRA_RNA_ROUTER_EVENT_SECRET` | PHP | Secret verifikasi HMAC callback. |

Laporan yang dikirim: `source`, `type`, `at`, `trigger`, `gateway`, `healthy`,
`version`, `features`, `modelCount`, `models[]`, `fallbackActive`, `probe`, `error`.
KRA menyimpan **whitelist field** saja dan menampilkannya di panel (kolom
"Automation", "Models on gateway", "Last error"). Signature:
`X-KRA-Signature: sha256=<HMAC-SHA256 atas body mentah>`, plus jendela waktu
15 menit (anti replay).

### 3.4 Panel UI

- Tombol header **⚡ RNA Router**: bila gateway hidup langsung membuka dashboard;
  bila belum, membuka panel untuk setup.
- **Settings → Integrations → RNA Router** selalu membuka panel.
- Panel: `CHECK CONNECTION`, `DAFTAR MODEL`, `TEST CHAT` (admin + supervisor),
  `SALIN PERINTAH AUTOMATION`, ringkasan health/fallback/event terakhir, dan
  form URL + model + API key (write-only).

Kebijakan shortcut browser identik dengan N100N/GitHub Changer: hanya HTTPS
publik, host yang sama, atau loopback/LAN dengan penulisan ulang host.

---

## 4. Endpoint API KRA

| Action | Method | Akses | Isi |
| --- | --- | --- | --- |
| `rna-router-status` | GET | viewer | Health gateway, versi, fitur, event terakhir. |
| `rna-router-models` | GET | viewer | Daftar model (`id`, `provider`). |
| `rna-router-chat` | POST | admin + supervisor | Satu chat completion uji; pesan dibatasi 4000 karakter. |
| `rna-router-config` | GET/POST | admin | URL + model + service key write-only. |
| `rna-router-event` | POST | HMAC | Callback automation dari Node. |

---

## 5. Publish ke branch `arena/cbf4b10e-kantor-rama-ai`

Perubahan ini masuk PR yang menargetkan branch deploy. Setelah merge:

1. `git pull` di mesin `\\100.76.172.67\c$\xampp\htdocs\kantor-rama-ai\`.
2. **PHP built-in server** langsung membaca file baru (tidak perlu restart).
3. **RNA Router** harus tetap dijalankan/direstart sendiri — push source tidak
   menyalakan proses Next.js. Jalankan `Start RNA Router.bat` + `Start RNA
   Router Automation.bat` (atau scheduled task/systemd
   `rna-router/systemd/rna-router.service`).
4. Samakan `KRA_EVENT_SECRET` (Node) dengan `KRA_RNA_ROUTER_EVENT_SECRET` (PHP)
   di environment masing-masing proses; restart Apache/PHP setelah mengubah env.
5. Bila ingin chat agen memakai gateway, set `defaultProvider: "rna-router"`
   di `api/config.json` server (jangan commit file ini).

### Checklist keamanan

- 🔴 Jangan commit `.env`, `.env.local`, `rna-router/.next/`, log, atau
  `api/config.json`.
- 🔴 Endpoint `/api/keys` upstream menyimpan kunci provider; jangan buka ke
  internet tanpa autentikasi. `.htaccess` KRA memblokir seluruh folder
  `rna-router/` bila document root sama.
- ✅ Callback KRA memakai `hash_equals` atas HMAC body mentah + batas waktu;
  tanpa secret semua event ditolak.
- ✅ `TEST CHAT` butuh admin + supervisor dan tidak menerima model bebas
  (divalidasi pola `A-Za-z0-9._:/-`).

---

## 6. Verifikasi & troubleshooting

```bash
npm run rna-router:test              # tes offline automation + HMAC
npm run verify:rna-router-bundle     # struktur, keamanan, tombol, CI
php tools/test-rna-router-client.php # unit test klien PHP tanpa jaringan
npm run verify:github-changer-bundle # integrasi sebelumnya tetap utuh
```

| Gejala | Periksa |
| --- | --- |
| Panel `OFFLINE` | Gateway belum jalan / `npm ci` belum dilakukan / URL salah (ingat: URL untuk **server PHP**, bukan browser). |
| `DEGRADED` | `/api/health` menjawab tapi `status` bukan `ok` — cek DB Supabase/MySQL. |
| `TEST CHAT` 403 | Perlu sesi admin workspace + role supervisor. |
| Event terakhir tidak berubah | `KRA_EVENT_SECRET` ≠ `KRA_RNA_ROUTER_EVENT_SECRET`, `KRA_EVENT_URL` salah (mode Apache butuh `/kantor-rama-ai/...`), atau selisih jam > 15 menit. |
| `npm ci` gagal | Butuh internet ke registry npm; di mesin produksi jalankan sekali saat setup. |
| Model tidak muncul | `/api/v1/models` butuh `lib/models.ts`; pastikan build Next.js berhasil. |
| Domain masih versi lama | Push/merge ke branch deploy, `git pull` di mesin domain, restart proses Node. |
