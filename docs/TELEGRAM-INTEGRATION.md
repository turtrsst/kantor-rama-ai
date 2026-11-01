# Integrasi Telegram KRA — Pantau & Kendalikan Agen dari HP

Bot Telegram pribadi untuk pemilik KRA: menerima notifikasi (proposal baru,
upload YouTube selesai) dan menjawab perintah pemantauan. Bot **hanya**
melayani satu chat privat yang sudah dipasangkan (pairing); chat lain diabaikan.

## Ringkasan arsitektur

| Bagian | Lokasi |
| --- | --- |
| Bot API bridge (perintah, tombol approve/reject, webhook) | `api/lib/KraTelegramBridge.php` |
| Penyimpanan token/pairing (server-side, mode 0600) | `api/lib/KraIntegrationSettings.php` (`telegram()`) |
| Endpoint webhook publik (diverifikasi secret header) | `api/index.php?action=telegram-webhook` |
| Panel pengaturan | Creator Integration Settings → section **TELEGRAM · BOT MONITOR** |
| Notifikasi otomatis | proposal baru (`KraTaskEngine::propose`), upload YouTube sukses |

Token bot bersifat **write-only**: disimpan terenkripsi-at-rest mengikuti pola
secret integrasi lain (file privat di luar web root bila `KRA_PRIVATE_CONFIG_DIR`
diatur), tidak pernah dikirim balik ke browser, dan tidak pernah masuk Git.
Jangan pernah menempelkan token bot ke chat (termasuk ke asisten AI) — masukkan
langsung di panel KRA. Override environment: `KRA_TELEGRAM_BOT_TOKEN`,
`KRA_TELEGRAM_CHAT_ID`.

## Langkah setup (±5 menit)

1. **Buat bot di @BotFather** (aplikasi Telegram):
   - Buka chat **@BotFather** → kirim `/newbot`.
   - Beri nama (mis. `KRA Monitor`) dan username berakhiran `bot` (mis. `kantor_rama_monitor_bot`).
   - BotFather membalas dengan **bot token** berbentuk `123456789:AA...`. Simpan token ini; anggap seperti kata sandi.
2. **Simpan token di KRA**: Creator → Integration Settings → section Telegram →
   tempel token → **SAVE TOKEN**. Status berubah menjadi `TOKEN SAVED · BELUM PAIRING`.
3. **Pairing**: klik **BUAT KODE PAIRING** → KRA menampilkan perintah
   `/start KODE6`. Buka chat bot Anda di Telegram, kirim persis perintah itu
   (kode berlaku 10 menit, sekali pakai). Bot membalas konfirmasi; status panel
   menjadi `PAIRED`.
4. **Daftarkan webhook** (agar bot bisa menerima perintah): isi **Base URL publik
   KRA** (alamat HTTPS publik KRA, mis. `https://kantor-rama-ai.my.id`) → klik
   **DAFTARKAN WEBHOOK**. Webhook terdaftar ke
   `<base>/api/index.php?action=telegram-webhook` dengan `secret_token` acak;
   setiap update diverifikasi lewat header `X-Telegram-Bot-Api-Secret-Token`.
5. **Tes**: klik **KIRIM TES** — pesan harus masuk ke Telegram Anda. Lalu coba
   `/status` dari Telegram.

> **Catatan lokal/desktop:** notifikasi keluar (proposal, upload) bekerja dari
> mana saja selama server KRA punya akses internet. Perintah *masuk* dari
> Telegram membutuhkan webhook yang dapat dijangkau internet — artinya KRA
> harus ter-deploy di alamat HTTPS publik, atau gunakan tunnel HTTPS
> (mis. Cloudflare Tunnel) yang menunjuk ke KRA lokal Anda, lalu daftarkan
> base URL tunnel tersebut. Tanpa itu, bot tetap berguna sebagai kanal notifikasi satu arah.

## Perintah bot

| Perintah | Isi balasan |
| --- | --- |
| `/help` | Daftar perintah |
| `/status` | Ringkasan: proposal menunggu, tugas per status, YouTube, N100N |
| `/proposal` | Maks. 5 proposal `WAITING_APPROVAL` dengan tombol **✅ Setujui / ❌ Tolak** |
| `/tugas` | 10 tugas terbaru (ID, agen, judul, status) |
| `/crew` | 6 pesan terakhir Studio Crew (siapa bicara apa) |
| `/n100n` | Status N100N + daftar workflow |
| `/youtube` | Status koneksi channel + izin upload |

Tombol approve/reject memakai jalur yang sama dengan Task Board
(`KraTaskEngine::approve/reject` sebagai pengguna "Telegram"); callback
memvalidasi ulang chat terpasang, format ID (`KRA-###`), keberadaan tugas, dan
status masih `WAITING_APPROVAL` sebelum bertindak.

## Notifikasi otomatis

- **Proposal baru dibuat agen** → pesan berisi ID, agen, judul + petunjuk `/proposal`.
- **Upload YouTube selesai** → judul, privasi, tautan YouTube Studio.

Kegagalan kirim Telegram tidak pernah menggagalkan proses utama (best-effort,
dicatat ke log server).

## Melepas / mengamankan

- **LEPAS CHAT** di panel: menghapus pasangan chat; bot berhenti melayani perintah.
- Hapus token: centang *Hapus token tersimpan* → SAVE TOKEN (webhook juga dicabut).
- Bila token bocor: di @BotFather kirim `/revoke` untuk bot Anda, lalu simpan token baru di KRA dan pairing ulang.
- Rotasi secret webhook: klik lagi **DAFTARKAN WEBHOOK** (secret baru dibuat setiap pendaftaran).

## Troubleshooting

| Gejala | Penyebab umum | Solusi |
| --- | --- | --- |
| SAVE TOKEN ditolak | Format token salah | Salin ulang persis dari @BotFather (`angka:huruf...`) |
| `/start KODE` tidak dibalas | Webhook belum terdaftar / base URL tidak publik | Daftarkan webhook dulu (langkah 4), buat kode pairing baru |
| KIRIM TES gagal | Belum pairing, atau token salah | Pairing ulang; periksa token |
| Perintah tidak dijawab | Chat bukan yang terpasang, atau KRA tidak terjangkau dari internet | Gunakan chat privat yang dipasangkan; cek `getWebhookInfo` via @BotFather? Gunakan tombol **DAFTARKAN WEBHOOK** ulang |
| Notifikasi tidak masuk | Server KRA tidak bisa keluar ke `api.telegram.org` | Periksa firewall/egress hosting; cek log PHP (`[KraTelegram]`) |
