# Prompt Urut OpenCode — Jangkar SANDI + Exness ke KRA

> Dibuat 2026-11-09 untuk Yang Mulia (Alfa). Dokumen ini adalah kelanjutan dari
> `prompt-webapp-kra.md` Bagian 4: setelah webapp KRA v1 (6 agen, Visual Office,
> Group Chat, Mode Office + Content Creator) jadi atau sedang dibangun, fase ini
> menjangkarkan **SANDI (Divisi Finance)** dan **koneksi Exness (akun Demo + Real)**
> ke dalam webapp yang sama — tanpa keluar dari aturan yang sudah kita sepakati.
>
> Cara pakai: jalankan langkah demi langkah, **satu perintah per giliran**.
> Tempel prompt di tiap langkah apa adanya ke OpenCode, tunggu sampai kriteria
> "Lolos kalau" terpenuhi, baru lanjut ke langkah berikutnya. Minta OpenCode
> commit/checkpoint tiap langkah selesai.

---

## File yang harus sudah ada di proyek

Salin folder/file ini ke dalam folder proyek `kantor-rama-ai/` (kalau Yang Mulia
sudah punya 4 file — 3 `.md` + 1 `.json` — itu sebagian dari daftar ini, tambahkan
sisanya dari folder yang sama):

| File | Tujuan di proyek | Isi |
|---|---|---|
| `kra/prompt-webapp-kra.md` | referensi | Prompt dasar webapp KRA v1 (Bagian 1–5) |
| `kra/webapp-AGENTS.md` | `AGENTS.md` di root proyek | Aturan proyek yang dibaca otomatis OpenCode |
| `kra/agents/kra-agents.json` | `kra/agents/` | Definisi 6 agen + hierarki |
| `finance/sandi.json` | `finance/` | **Definisi SANDI: persona, peran, house rules, 15 skill** |
| `custom-connectors/custom.exness/CONNECTOR.md` | `custom-connectors/custom.exness/` | **Spesifikasi API Exness: auth Ed25519, endpoint, error code** |
| `custom-connectors/custom.exness/bin/exness-readonly.mjs` | `custom-connectors/custom.exness/bin/` | **Helper Node.js read-only (sudah teruji 5/5 self-test)** |
| `custom-connectors/custom.exness/README-SMOKE-TEST.md` | `custom-connectors/custom.exness/` | **Panduan uji koneksi manual di komputer sendiri** |
| `custom-connectors/custom.exness/connector.yaml` | `custom-connectors/custom.exness/` | Metadata konektor |

Perintah pertama ke OpenCode (sebelum Langkah 0):

```
Baca dulu @AGENTS.md, @kra/agents/kra-agents.json, @finance/sandi.json,
@custom-connectors/custom.exness/CONNECTOR.md dan
@custom-connectors/custom.exness/README-SMOKE-TEST.md. Kita lanjutkan webapp KRA
dengan fase Divisi Finance (SANDI + Exness) sesuai dokumen
@kra/prompt-opencode-bots-exness.md. Ikuti langkah-langkahnya berurutan, satu
langkah per giliran, dan jangan lanjut sebelum kriteria lolos tiap langkah terpenuhi.
```

---

## Aturan jangkar (tidak boleh dilanggar di langkah mana pun)

1. **Hierarki tetap:** Yang Mulia → RAMA → MARTA → NARA, RAGA, PUTRI → ARUNA.
   SANDI masuk sebagai **Divisi Finance, kepala divisi keuangan**, melapor ke RAMA.
   Keputusan trading/investasi **hanya RAMA dan Yang Mulia** yang membuat.
2. **SANDI menganalisa, tidak pernah mengeksekusi.** House rules dari `sandi.json`
   adalah hukum: analisa bersifat edukasi (bukan saran keuangan), tidak pernah
   menyebut harga yang tidak diambil dari data sesi itu, setiap analisa membawa
   skenario bear/base/bull + confidence + invalidation point, NO-ACTION adalah
   posisi yang sah, dan **tidak ada auto-trading, tidak ada eksekusi order**.
3. **v1 ini READ-ONLY untuk kedua akun — meskipun kedua key dibuat full access.**
   Key demo DAN key real sama-sama full access (keputusan Yang Mulia
   2026-11-09), tapi scope penuhnya BELUM dipakai di fase ini. Konektor
   hanya boleh membaca (discovery + detail akun + posisi). Tidak ada endpoint
   POST, tidak ada tombol beli/jual di akun mana pun. Mode Trader (latihan
   trading di demo, apalagi trading di real) adalah **fase terpisah nanti**,
   hanya kalau Yang Mulia memintanya secara eksplisit.
4. **Dua profil, dua key, satu key per akun:** `DEMO` (uang virtual, full access)
   dan `REAL` (uang asli, full access — keputusan 2026-11-09; key read-only
   lama diganti). UI harus selalu menampilkan label yang jelas: mana yang
   demo, mana yang real. Jangan pernah tertukar.
5. **Rahasia hanya lewat `.env` / Settings, tidak pernah di kode, tidak pernah
   di-commit, tidak pernah tampil di UI atau log.** Yang disimpan: API Key
   (`exnsk-...`), private key (128 karakter hex), Account ID, Gateway URL.
   Private key ditampilkan Exness sekali saja — webapp tidak boleh menampilkannya
   lagi setelah disimpan (tampilkan hanya 4 karakter terakhir, atau "tersimpan").
6. **SANDI tidak masuk Group Chat utama "Kantor KRA".** Dia punya konsol Finance
   sendiri. (Keputusan ini bisa diubah Yang Mulia nanti.)
7. **Tidak ada data karangan.** Board, analitik, harga, saldo, dan posisi mulai
   kosong. Angka hanya muncul kalau benar-benar diambil dari API Exness atau
   dari harga pasar yang diambil di sesi itu. Kalau belum diambil, tulis
   "BELUM DIAMBIL", jangan isi angka.
8. **Gratis dulu.** Jangan menambahkan API market-data berbayar (FMP, Finviz,
   Alpaca). Harga crypto dari CoinGecko (gratis, tanpa key) dan data akun dari
   Exness saja.
9. **IP allowlist:** panggilan API dari server webapp akan ditolak kalau IP
   server tidak ada di daftar Allowed IPs pada key Exness. Saat deploy, tambahkan
   IP publik server ke Allowed IPs di Key Management Exness. (IP komputer Muse
   adalah 104.29.200.165 — itu hanya berlaku untuk uji dari komputer Muse, bukan
   untuk server webapp nanti.)

---

## Langkah 0 — Persiapan dan verifikasi fondasi

**Tujuan:** memastikan semua file sudah di tempatnya dan webapp v1 bisa jalan.

**Prompt:**

```
Verifikasi fondasi dulu, jangan bangun apa-apa. (1) Pastikan file-file ini ada:
@AGENTS.md, @kra/agents/kra-agents.json, @finance/sandi.json,
@custom-connectors/custom.exness/CONNECTOR.md,
@custom-connectors/custom.exness/bin/exness-readonly.mjs,
@custom-connectors/custom.exness/README-SMOKE-TEST.md.
(2) Jalankan `node custom-connectors/custom.exness/bin/exness-readonly.mjs
--self-test` dan laporkan hasilnya. (3) Jalankan webapp yang sudah ada
(`npm run dev` atau perintah setara) dan laporkan apakah halaman utama, Visual
Office, dan Group Chat tampil tanpa error. Laporkan apa yang hilang sebelum kita
lanjut.
```

**Lolos kalau:** semua file ditemukan, `--self-test` lolos 5/5, webapp v1 jalan
tanpa error. Kalau ada yang hilang, berhenti dan perbaiki dulu.

---

## Langkah 1 — Divisi Finance: SANDI masuk roster KRA

**Tujuan:** SANDI tampil di webapp sebagai agen ke-7, kepala Divisi Finance,
dengan konsolnya sendiri — tanpa mengubah 6 agen yang sudah ada.

**Prompt:**

```
Tambahkan Divisi Finance ke webapp KRA sesuai @finance/sandi.json (satu-satunya
sumber kebenaran untuk SANDI — jangan karang persona atau skill di luar file itu).
(1) Roster agen bertambah: SANDI, agen ke-7, "Analis Keuangan — Saham, Crypto &
Forex", warna ungu gelap, avatar misterius (topeng/sandi). Status: "Divisi Finance,
kepala divisi, melapor ke RAMA". (2) Tambahkan halaman/konsol "Finance — SANDI"
dengan: Brief Pagi (regime RISK-ON/RISK-OFF/MIXED + harga BTC, ETH, S&P 500,
EUR/USD, USD/JPY dari CoinGecko gratis), Konsol Analisa (input ticker/pair,
verdict LONG/SHORT/WAIT, skenario bear/base/bull, entry zone, stop, invalidation,
position size), Watchlist, Jurnal Tesis, Kalkulator Ukuran Posisi (fixed-fractional,
ATR, Kelly). (3) Tempel house rules SANDI sebagai teks aturan di konsolnya, dan
tampilkan peringatan "Analisa bersifat edukasi, bukan saran keuangan" di setiap
hasil analisa. (4) Tambahkan aksi "Laporan ke RAMA" di konsol SANDI. (5) SANDI
TIDAK ditambahkan ke Group Chat "Kantor KRA". (6) Semua board mulai kosong —
jangan isi watchlist, jurnal, atau analisa contoh.
```

**Lolos kalau:** SANDI muncul di roster sebagai Divisi Finance, konsol Finance
terbuka, house rules tampil, semua board kosong, Group Chat tetap berisi 6 agen
lama saja.

---

## Langkah 2 — Modul Exness di server (bukan di browser)

**Tujuan:** webapp bisa bicara ke API Exness lewat server, memakai helper yang
sudah teruji — kredensial tidak pernah sampai ke frontend.

**Prompt:**

```
Bangun modul server Exness sesuai @custom-connectors/custom.exness/CONNECTOR.md
dan port helper @custom-connectors/custom.exness/bin/exness-readonly.mjs (Node.js
stdlib saja, tanpa dependensi baru). Modul ini HANYA berjalan di server, tidak
pernah di browser. (1) Implementasikan signing Ed25519 persis seperti helper:
payload JSON {api_key, idempotency_key: "", timestamp ms, sign_version: 1,
method, path, body_hash} diserialisasi sekali lalu di-base64url ke EXN-DATA,
ditandatangani ke EXN-SIGN; header EXN-API-KEY, EXN-IDEMPOTENCY-KEY,
EXN-TIMESTAMP, EXN-SIGN-VERSION: 1. (2) Dua profil dari environment variables:
EXN_DEMO_* dan EXN_REAL_* (masing-masing: API_KEY, PRIVATE_KEY, ACCOUNT_ID,
DISCOVERY_BASE_URL). (3) Operasi read-only saja: discovery
GET /v1/trading/access-point (cache URL Access Point 24 jam, simpan hanya URL —
tanpa kredensial), dan GET /v1/configuration/accounts/{id}/account. TIDAK ADA
endpoint trading (no POST, no order, no position). (4) Jangan pernah log atau
cetak key material atau signed header. (5) Tangani error dengan pesan yang
membedakan: 401 key tidak valid, 401 signature tidak valid, 404 akun tidak
ditemukan, 429 rate limit, dan jam server tidak sinkron. Jangan forward signed
header ke redirect.
```

**Lolos kalau:** `node` helper lama dan modul baru menghasilkan signature yang
sama pada test vector yang sama, tidak ada kredensial di log, dan tidak ada
endpoint trading di kode (cek dengan grep: tidak ada POST ke Exness).

---

## Langkah 3 — Settings: sambungkan dua akun Exness

**Tujuan:** Yang Mulia bisa memasukkan kedua key dari UI Settings, dengan label
demo/real yang tidak mungkin tertukar.

**Prompt:**

```
Tambahkan bagian "Koneksi Exness" di halaman Settings, di bawah koneksi yang
sudah ada. Dua kartu profil terpisah: (1) "DEMO — Uang Virtual (Full Access)"
dengan field API Key, Private Key, Account ID, Gateway URL; (2) "REAL — Uang Asli (Full Access)" dengan field yang sama. Setiap field disimpan server-side ke
.env (atau secret store server), TIDAK PERNAH dikirim ke frontend setelah
disimpan — tampilkan hanya status "tersimpan" dan 4 karakter terakhir API Key.
Tampilkan juga expiry date key dan catatan Allowed IPs (tambahkan IP publik
server ini ke Key Management Exness). Tambahkan tombol "Simpan" per profil dan
tombol "Hapus koneksi" dengan konfirmasi. Jangan pernah menampilkan private key
lengkap di layar mana pun.
```

**Lolos kalau:** kedua profil bisa disimpan, private key tidak tampil lengkap di
UI mana pun, dan refresh halaman tidak menghilangkan status tersimpan.

---

## Langkah 4 — Uji Konektivitas (wajib lolos sebelum lanjut)

**Tujuan:** membuktikan kedua akun benar-benar terhubung, dari dalam webapp
maupun dari terminal — ini uji yang sama dengan yang sudah disiapkan di
`README-SMOKE-TEST.md`.

**Prompt:**

```
Bangun "Uji Konektivitas Exness" di halaman Finance dan di Settings, satu tombol
"Test Connection" per profil (DEMO dan REAL). Saat ditekan, jalankan berurutan
dan tampilkan hasilnya per tahap: (1) Self-test signing (tanpa jaringan, harus
5/5 PASS); (2) Discovery — GET /v1/trading/access-point, tampilkan URL Access
Point yang ditemukan (atau "(cached)" kalau dari cache 24 jam); (3) Account
details — GET /v1/configuration/accounts/{id}/account, tampilkan ringkasan:
currency, leverage, margin call, stop out. Tampilkan PASS/FAIL per tahap dengan
pesan error yang jelas (401 = key/IP/expiry, 404 = Account ID salah, 429 = rate
limit, tunggu lalu ulangi). Jangan tampilkan key material di hasil uji. Sediakan
juga perintah terminal yang sama dari
@custom-connectors/custom.exness/README-SMOKE-TEST.md untuk uji manual.
```

**Lolos kalau:** keempat tahap PASS untuk profil DEMO **dan** profil REAL,
ringkasan akun tampil dengan angka yang benar-benar dari API, dan tidak ada key
yang bocor di layar. **Kalau ada tahap FAIL, berhenti di sini — jangan lanjut
ke Langkah 5.**

---

## Langkah 5 — SANDI membaca akun (analisa dari data nyata)

**Tujuan:** konsol SANDI menampilkan data akun Exness yang sebenarnya dan
menganalisa dari situ — tetap read-only.

**Prompt:**

```
Hubungkan konsol SANDI (Langkah 1) dengan modul Exness (Langkah 2). (1) Kartu
"Akun Saya" di halaman Finance: untuk tiap profil (DEMO dan REAL, dengan label
yang jelas), tampilkan balance, equity, margin, free margin, dan posisi terbuka
— semuanya dari API Exness, di-refresh per permintaan (tombol "Refresh"), bukan
angka statis. (2) Konsol Analisa SANDI boleh memakai data akun (ukuran akun +
toleransi risiko) untuk menghitung position size. (3) Setiap analisa tetap
membawa bear/base/bull, confidence, key unknowns, invalidation point, dan
peringatan edukasi. (4) TIDAK ADA tombol beli/jual, buka/tutup posisi, atau
eksekusi apa pun — di akun DEMO maupun REAL. Kalau ada komponen UI trading dari
template, hapus. (5) Semua angka yang belum diambil dari API tampil sebagai
"BELUM DIAMBIL", bukan angka karangan.
```

**Lolos kalau:** kartu akun menampilkan angka yang berubah mengikuti API (uji
dengan refresh), analisa memakai ukuran akun nyata untuk sizing, dan tidak ada
satu pun tombol trading di halaman mana pun.

---

## Langkah 6 — Audit keamanan dan checkpoint akhir

**Tujuan:** memastikan tidak ada rahasia yang bocor dan semua aturan jangkar
masih ditegakkan, sebelum fase ini dinyatakan selesai.

**Prompt:**

```
Audit akhir fase Divisi Finance sebelum selesai. (1) Grep seluruh repo untuk
bocoran rahasia: `exnsk-`, private key 128-hex, `EXN_PRIVATE_KEY=` berisi nilai,
dan file `.env` — pastikan tidak ada yang ter-commit (`.env` harus ada di
.gitignore; kredensial hanya di `.env` lokal / secret store server). (2)
Periksa ulang: tidak ada endpoint POST ke Exness, tidak ada tombol trading di
UI, SANDI tidak ada di Group Chat, house rules tampil di konsol, semua board
mulai kosong. (3) Tulis ringkasan di `docs/finance-phase.md`: apa yang dibangun,
apa yang masih stub (butuh key asli / IP server di allowlist), dan cara
menjalankan Uji Konektivitas (Langkah 4). (4) Commit sebagai checkpoint
"finance-phase-v1-readonly".
```

**Lolos kalau:** grep bersih, semua cek Langkah 1–5 masih lolos, dan ringkasan
tertulis.

---

## Yang TIDAK dibangun di fase ini (fase berikutnya, kalau Yang Mulia minta)

- **Mode Trader / latihan trading di akun Demo** — endpoint order, tombol
  beli/jual, dan approval gate per eksekusi. Baru dirancang setelah fase ini
  selesai dan Yang Mulia menyetujuinya secara eksplisit.
- **SANDI masuk Group Chat utama** — keputusan Yang Mulia nanti.
- **API market-data berbayar** — tetap gratis dulu.
- **n8n / 9router / freellmapi / YouTube-Concat** — itu bagian dari webapp v1
  di `prompt-webapp-kra.md`, bukan fase ini.

## Kalau OpenCode keluar jalur

Tegur dengan kalimat ini (sesuai `AGENTS.md`):

```
Kamu keluar dari aturan jangkar. Baca lagi @AGENTS.md dan bagian "Aturan jangkar"
di @kra/prompt-opencode-bots-exness.md, kembalikan yang menyimpang, lalu lanjutkan
dari langkah terakhir yang lolos. Jangan karang data, jangan tambah endpoint
trading, jangan tampilkan kredensial.
```
