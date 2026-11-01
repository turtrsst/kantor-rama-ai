# Integrasi YouTube KRA — dari OAuth sampai Upload ke YouTube Studio

Dokumen ini menjelaskan cara menyambungkan channel YouTube Anda ke KRA
secara **asli** (bukan simulasi), sampai video hasil produksi bisa dikirim
langsung ke YouTube Studio dari KRA.

Alurnya sekarang lengkap:

```
Client ID/Secret (Google Cloud Anda)
  → disimpan server-side di KRA (di luar web root, tidak pernah ke browser)
  → AUTHORIZE: login Google + setujui scope youtube.readonly + youtube.upload
  → token + refresh token tersimpan; akses token diperbarui otomatis
  → supervisor menjalankan "UPLOAD TO YOUTUBE STUDIO" (konfirmasi manual)
  → video masuk YouTube Studio (default Private sebagai draft)
```

Komponen kode: `api/lib/KraIntegrationSettings.php` (penyimpanan rahasia),
`api/lib/KraYouTubeOAuth.php` (OAuth + refresh), `api/lib/KraYouTubeUploader.php`
(resumable upload YouTube Data API v3), action `youtube-upload` di
`api/index.php`, dan form di **Creator → INTEGRATION SETTINGS**.

---

## 1. Siapkan Google Cloud (sekali saja)

Anda sudah punya Client ID & Secret — pastikan pengaturannya persis seperti
ini di [Google Cloud Console](https://console.cloud.google.com/):

1. **Aktifkan API**: APIs & Services → Library → cari **YouTube Data API v3**
   → Enable.
2. **OAuth consent screen**:
   - User type **External**, isi nama aplikasi + email support.
   - **Scopes** tambahkan dua-duanya:
     `https://www.googleapis.com/auth/youtube.readonly` dan
     `https://www.googleapis.com/auth/youtube.upload`.
   - Tambahkan akun Google Anda sebagai **Test user** selama masih Testing.
   - **PENTING — klik "Publish app" (Production)** setelah siap. Selama status
     masih *Testing*, refresh token **kedaluwarsa dalam 7 hari** dan KRA akan
     meminta authorize ulang terus. Production untuk pemakaian pribadi tidak
     butuh verifikasi selama user-nya Anda sendiri (akan ada layar peringatan
     "unverified app" yang bisa dilewati lewat *Advanced → Go to project*).
3. **Credentials → OAuth client ID → Web application** — isi
   **Authorized redirect URIs** dengan alamat callback KRA Anda. Boleh
   daftarkan beberapa baris sekaligus:

   | Cara menjalankan KRA | Redirect URI yang didaftarkan |
   |---|---|
   | Aplikasi desktop KRA (Electron) | `http://127.0.0.1:8088/api/youtube-callback.php` |
   | XAMPP lokal | `http://localhost/kantor-rama-ai/api/youtube-callback.php` |
   | Server publik | `https://kantor-rama-ai.my.id/api/youtube-callback.php` |

   Alamat di atas adalah *path file* `api/youtube-callback.php` (tanpa query).
   Rute lama `api/index.php?action=youtube-oauth-callback` juga tetap bekerja
   bila sudah terdaftar.

## 2. Masukkan kredensial ke KRA

1. Buka KRA → **CONTENT CREATOR → INTEGRATION SETTINGS**.
2. Isi **Client ID**, **Client Secret**, dan **Authorized redirect URI**
   (harus *persis sama* dengan yang didaftarkan di Google Cloud — field ini
   sudah terisi saran otomatis untuk instalasi Anda).
3. **SAVE OAUTH SETTINGS**. Secret hanya dikirim ke server KRA dan disimpan
   di luar web root (folder privat `KRA_PRIVATE_CONFIG_DIR` atau folder temp
   sistem `kra-private-*`, mode 0600). Secret **tidak pernah** ditampilkan
   lagi dan tidak masuk Git.

Alternatif tanpa UI: environment server `KRA_YOUTUBE_CLIENT_ID`,
`KRA_YOUTUBE_CLIENT_SECRET`, `KRA_YOUTUBE_REDIRECT_URI` (mengalahkan nilai UI).

> Jangan pernah menaruh Client Secret di chat, screenshot, atau commit Git.
> Bila terlanjur tersebar: Google Cloud Console → Credentials → reset secret.

## 3. Sambungkan channel (Authorize)

Klik **AUTHORIZE YOUTUBE CHANNEL**:

- Di **aplikasi desktop**: browser sistem Anda terbuka untuk login Google
  (jendela KRA tidak berpindah). Setelah menyetujui, tab browser menampilkan
  halaman "YouTube terhubung" dan status di KRA berubah otomatis.
- Di **web**: halaman KRA beralih ke Google lalu kembali sendiri.

Status berubah menjadi **CONNECTED · \<nama channel\>**. Di bawahnya KRA
menyebutkan apakah izin **upload** sudah termasuk. Bila Anda pernah connect
sebelum fitur upload ada, klik AUTHORIZE sekali lagi dan setujui scope upload.

Google menampilkan peringatan "Google hasn't verified this app" untuk
aplikasi yang belum diaudit — untuk project milik sendiri itu normal:
*Advanced → Go to (project)*.

## 4. Upload video ke YouTube Studio

1. Taruh file video final di salah satu folder media server KRA:
   `.temp/`, `files/`, `n100n/files/` (atau folder dari env `KRA_MEDIA_DIR`).
   Contoh: hasil export workflow Concat diarahkan ke `n100n/files/`.
2. Di INTEGRATION SETTINGS (bagian **UPLOAD · YOUTUBE DATA API V3**) isi:
   nama file (relatif terhadap folder media), judul, deskripsi, tags,
   thumbnail opsional (`.jpg`/`.png` ≤ 2 MB, path relatif juga), visibilitas.
3. Centang konfirmasi review, lalu **UPLOAD TO YOUTUBE STUDIO**. Upload
   berjalan di server (resumable, per 8 MiB, bisa melanjutkan dari offset
   terakhir bila koneksi putus sesaat) — biarkan jendela terbuka sampai ada
   balasan berisi link Studio.

Hal-hal yang perlu diketahui:

- **Default Private.** Selama Google Cloud project Anda belum lolos audit
  YouTube API Services, Google **mengunci semua upload API menjadi private**
  apa pun pilihan Anda. Itu justru cocok dengan alur "kirim ke Studio":
  video masuk sebagai draft private, Anda cek & publish dari YouTube Studio.
  Agar bisa langsung public/unlisted dari API, ajukan verifikasi OAuth +
  compliance audit di Google (proses terpisah, di luar KRA).
- **Kuota**: default 10.000 unit/hari; satu upload (`videos.insert`) = 1600
  unit → ±6 upload/hari. Thumbnail set = 50 unit. Minta penambahan kuota
  lewat Google bila produksi harian lebih besar.
- Upload hanya bisa dijalankan **supervisor yang login** dan selalu meminta
  konfirmasi eksplisit; agen AI KRA tidak bisa mengupload sendiri dan
  diinstruksikan untuk tidak mengklaim upload tanpa video ID hasil action ini.

## 5. Putuskan koneksi

**DISCONNECT** mencabut (revoke) token di Google bila terjangkau dan
menghapus token tersimpan di KRA. Client ID/Secret tetap tersimpan agar
mudah menyambung ulang.

## Troubleshooting

| Gejala | Penyebab & obat |
|---|---|
| `redirect_uri_mismatch` dari Google | URI di form KRA ≠ yang terdaftar di Google Cloud. Samakan persis (skema, host, port, path, tanpa slash ekstra). |
| Sering minta authorize ulang / "token refresh failed" | Consent screen masih **Testing** (refresh token mati 7 hari), password Google berubah, atau akses dicabut dari akun Google. Publish app ke Production, lalu authorize ulang. |
| "grant does not include upload permission" | Koneksi lama sebelum scope upload. Klik AUTHORIZE lagi dan setujui scope `youtube.upload`. |
| Video selalu Private walau memilih Public | Project belum terverifikasi Google (lihat catatan kuota/audit di atas). Publish manual dari Studio, atau ajukan verifikasi. |
| `quotaExceeded` | Kuota harian habis (1600/upload). Tunggu reset tengah malam Pacific atau ajukan kuota tambahan. |
| File tidak ditemukan | File harus di `.temp/`, `files/`, `n100n/files/`, atau `KRA_MEDIA_DIR`, dan diisi sebagai path relatif (contoh `hasil/final.mp4`). |
| Thumbnail gagal tapi video sukses | Batas 2 MB / format. Video tetap terupload; pasang thumbnail dari YouTube Studio. |
| Tab desktop membuka `youtube-connected.html?youtube=error` | State OAuth kedaluwarsa (>10 menit), otorisasi dibatalkan, atau redirect URI salah. Ulangi dari AUTHORIZE. |
