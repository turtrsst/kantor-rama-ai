# Kantor KRA — Finance Phase & Exness Read-Only Integration

> *"Kerja cepat boleh, tapi jujur dan aman itu wajib."*

Dokumen ini menjelaskan arsitektur Divisi Finance standalone (**SANDI**, **MAEL**, **JARJIT**) serta integrasi **Exness Read-Only** yang berjalan di server Vite/Node (`server/kraServer.mjs`) dan ditampilkan di Lantai 3 serta `FinanceConsoleModal`.

## 1. Struktur Organisasi (Terpisah dari Kantor KRA)
- **8 Agen Inti Kantor KRA (Lantai 1 & 2, masuk Group Chat "Kantor KRA")**:
  - `rama` (CEO / Koordinator Utama)
  - `marta` (Sekretaris)
  - `nara` (DevOps & Security)
  - `putri` (Content & Script — Approval Gate Yang Mulia)
  - `raga` (Video Editor & Voicebox — Remotion khusus Yang Mulia)
  - `meimei` (QA Gate & Verifikator — PASS/REVISE)
  - `aruna` (Publisher & Growth — berhenti di "Siap Terbit" sampai kredensial YouTube resmi tersedia)
  - `fizi` (Community & Support)
- **3 Agen Divisi Finance Standalone (Lantai 3 — TIDAK masuk Group Chat "Kantor KRA")**:
  - `sandi` (Crypto & Financial Analyst — Market Brief, Watchlist, Thesis Journal, Position Sizing)
  - `mael` (Treasury & Risk Guard — Penjaga modal, aturan risiko ketat, pembaca Exness read-only)
  - `jarjit` (Airdrop Hunter — Zero fake listing, sumber dokumentasi protokol resmi + risiko Sybil/lockup/gas)

## 2. Keamanan Exness Read-Only (Server-Side Only)
1. **Strict GET-Only**:
   - Seluruh pemanggilan API Exness hanya dilakukan melalui backend (`server/kraServer.mjs` dan `exness/bin/exness-readonly.mjs`) dengan metode HTTP **`GET`** saja.
   - Tidak ada endpoint maupun tombol untuk membuka posisi (`BUY`/`SELL`), menutup posisi (`CLOSE`), atau mengirim `POST` order ke Exness.
2. **Dual Profiles (`DEMO` dan `REAL`)**:
   - Mendukung konfigurasi terpisah untuk profil **DEMO** dan **REAL** melalui Settings (`POST /api/exness/save`) atau variabel env:
     - `EXNESS_DEMO_BASE_URL`, `EXNESS_DEMO_API_ID`, `EXNESS_DEMO_CLIENT_ID`, `EXNESS_DEMO_KEY_MODE`, `EXNESS_DEMO_PRIVATE_KEY`
     - `EXNESS_REAL_BASE_URL`, `EXNESS_REAL_API_ID`, `EXNESS_REAL_CLIENT_ID`, `EXNESS_REAL_KEY_MODE`, `EXNESS_REAL_PRIVATE_KEY`
   - Secret disimpan server-side pada `.kra-secrets.json` (`chmod 0600`) dan `.kra-env.local` (`chmod 0600`, plus kompatibel membaca variabel env `.env.local` saat startup) yang sudah masuk `.gitignore`.
   - Browser/UI hanya menerima status masked (4 karakter terakhir) lewat `GET /api/exness/status`.
3. **Auth & Cache Keamanan**:
   - Signature Ed25519 mendukung mode **`EXN-DATA`** (hex seed) dan **`EXN-SIGN`** (hex / PEM PKCS#8).
   - Akses point URL di-cache lokal per profil di `exness/.access-point.demo.json` / `exness/.access-point.real.json` (TTL 24 jam, tanpa token/secret, masuk `.gitignore`).
   - HTTPS-only enforcement, `redirect: 'error'`, dan timeout `15s`.
4. **4-Stage Connectivity Test (`POST /api/exness/test`)**:
   1. `Credentials Valid`: mengecek `baseUrl` HTTPS, `apiId`, `clientId`, dan format key Ed25519.
   2. `Signature OK`: memverifikasi pembuatan header otentikasi `EXN-DATA`/`EXN-SIGN`.
   3. `Endpoint Reachable`: mencoba `GET /rest-apigw/v2/auth/access-point`.
   4. `Response Schema Valid`: memvalidasi struktur payload akun Exness read-only (`clientAccount`, `balance`, `equity`, `leverage`, `marginCallLevel`, `stopOutLevel`).

## 3. Kebijakan Zero Fake Data & Disclaimer
- Semua metrik yang belum ditarik atau belum diset tampil jujur sebagai **`BELUM DISET`** atau **`BELUM DIAMBIL`**.
- **Watchlist**, **Thesis Journal**, **Pipeline Content Creator**, dan **Daftar Airdrop** dimulai dalam kondisi **kosong (`[]`)**.
- **Disclaimer SANDI**: *Analisa, market brief, dan kalkulator position sizing (Fixed-Fractional, ATR-Based, Half-Kelly) bersifat edukatif — bukan saran investasi / bukan financial advice.*
