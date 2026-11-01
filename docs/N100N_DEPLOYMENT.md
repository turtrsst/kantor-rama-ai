# Menjalankan N100N yang dibundel bersama KRA

Source upstream N100N sekarang disimpan di `n100n/` pada snapshot commit `77fe26134c83103e3f4175a43cf852b91dacc8a1`. Ini membawa aplikasi dan tesnya ke satu repo KRA, **tetapi tidak otomatis menjalankan atau menerbitkan server Node**. KRA tetap PHP; N100N adalah service Node yang harus berjalan terus dan memiliki penyimpanan persisten.

## Uji lokal

Butuh Node.js **22.5+** (Node `node:sqlite`):

```bash
cp n100n/.env.example n100n/.env
# Edit n100n/.env: ganti APP_PASSWORD, APP_SECRET, APP_API_TOKEN dengan nilai acak yang berbeda.
npm run n100n:test
npm run n100n
```

UI lokal: `http://127.0.0.1:5679`. Jangan gunakan nilai rahasia contoh/default saat membuka akses jaringan. File `.env`, database SQLite, `files/`, dan `node_modules/` tidak boleh di-commit. Jika service berada di dalam document root yang sama, set `APP_DATA_DIR` ke direktori persistent **di luar** document root. `.htaccess` KRA menolak akses HTTP langsung ke folder source `n100n/`; UI harus disajikan oleh proses Node melalui hostname service-nya.

## Deployment publik

Untuk URL KRA `https://kantor-rama-ai.my.id`, jalankan N100N pada Node host/VPS atau platform yang mendukung service Node persisten dan disk persisten. Beri service hostname HTTPS tersendiri, misalnya `https://automation.example.id`, dengan reverse proxy/TLS ke port Node 5679. Jangan mencoba mengakses `127.0.0.1:5679` dari browser pengguna: loopback di konfigurasi KRA adalah mesin PHP, sedangkan loopback di browser adalah komputer pengguna.

KRA akan menampilkan tombol **OPEN N100N APP** hanya bila URL service yang tersimpan adalah HTTPS dan bukan localhost/IP private. Karena field Base URL dipakai bersama untuk panggilan KRA-server dan shortcut browser, URL itu harus dapat dijangkau dari kedua sisi. URL privat yang hanya dapat dicapai PHP tidak akan mendapat tombol shortcut UI.

## Hubungkan dua arah

1. **KRA → N100N:** pada Creator → Integration Settings, set N100N Base URL ke URL yang bisa dicapai oleh server PHP KRA, dan masukkan `APP_API_TOKEN` N100N pada input API key. Nilai ini disimpan server-side; tidak dikirim ke JavaScript.
2. **N100N → KRA (opsional):** di environment N100N, set `KRA_BASE_URL=https://kantor-rama-ai.my.id` dan `KRA_API_KEY` sama dengan `KRA_FLOW_API_KEY` yang dikonfigurasi pada server KRA. Jangan salin key ke workflow JSON atau browser.
3. Simpan persistent volume untuk `APP_DATA_DIR` agar workflow dan riwayat SQLite tidak hilang saat deploy/restart.
4. Batasi port/akses service; gunakan HTTPS untuk UI publik dan password admin unik. Jangan biarkan `APP_PASSWORD` kosong/default, dan ganti `APP_SECRET` serta `APP_API_TOKEN` dengan nilai acak.
5. Dari KRA, tekan **CHECK N100N CONNECTION**, lalu **LOAD WORKFLOWS**. Untuk mengakses editor/dasbor N100N, tekan **OPEN N100N APP**.

KRA dan N100N tetap aplikasi berbeda walaupun source ada di satu repo. Push GitHub hanya menyimpan kode; agar URL publik hidup, Node service dan hostname-nya tetap harus di-deploy serta dikonfigurasi di hosting.
