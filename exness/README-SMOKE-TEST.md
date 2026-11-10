# Uji koneksi Exness (smoke test) — dijalankan di komputer Yang Mulia

Key TIDAK PERNAH meninggalkan komputer ini. Yang dikirim ke Muse hanya hasil
output `--discover` dan `--account-details` (tidak berisi kredensial).

## Syarat

- Node.js 20 atau lebih baru (`node --version` untuk mengecek).
- File `exness-readonly.mjs` di folder ini.
- 4 nilai dari Key Management Exness, per key:
  - `EXN_API_KEY` — API Key (`exnsk-...`)
  - `EXN_PRIVATE_KEY` — private key, teks 128 karakter hex (ditampilkan sekali saja)
  - `EXN_ACCOUNT_ID` — nomor akun (demo untuk key demo, real untuk key real)
  - `EXN_DISCOVERY_BASE_URL` — URL Gateway HTTPS dari widget DNS di Key Management

## Langkah 1 — key DEMO dulu (full access, uang virtual)

PowerShell, di folder file ini:

```powershell
$env:EXN_API_KEY="exnsk-..."
$env:EXN_PRIVATE_KEY="..."
$env:EXN_ACCOUNT_ID="..."
$env:EXN_DISCOVERY_BASE_URL="https://..."
node exness-readonly.mjs --self-test
node exness-readonly.mjs --discover
node exness-readonly.mjs --account-details
```

`--self-test` tidak memakai jaringan (hanya cek rumus tanda tangan).
`--discover` mencetak URL Access Point. `--account-details` mencetak detail akun
(mata uang, leverage, margin-call, stop-out) — kirim output ini ke Muse.

## Langkah 2 — key REAL (read-only)

Tutup PowerShell lalu buka lagi (supaya env var demo terhapus), isi keempat nilai
dengan key real, jalankan tiga perintah yang sama.

## Kalau gagal

- `Request failed: HTTP 401` — key salah, IP tidak diizinkan, atau key kedaluwarsa.
  Periksa Allowed IPs di Key Management (IP komputer Muse: 104.29.200.165 — tapi
  uji ini jalan dari komputer Yang Mulia, jadi IP yang berlaku adalah IP komputer
  Yang Mulia; kalau IP dibatasi, tambahkan IP itu atau kosongkan dulu).
- `Request failed: HTTP 404` — Account ID salah.
- `Request failed: HTTP 429` — rate limit; tunggu sebentar lalu ulangi.
- Error lain: kirim pesan error-nya (tanpa key) ke Muse.
