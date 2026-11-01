# Menjalankan N100N yang dibundel bersama KRA

Source upstream N100N disimpan di `n100n/` pada snapshot commit `77fe26134c83103e3f4175a43cf852b91dacc8a1` (sama dengan HEAD upstream `turtrsst/n100n` saat terakhir diperiksa). Satu repo, dua runtime: KRA tetap PHP, N100N adalah service Node persisten. **Push ke GitHub/hosting web tidak otomatis menjalankan atau menerbitkan server Node** — untuk URL publik, service-nya tetap harus di-deploy (lihat "Deployment publik"). Di desktop, KRA sekarang menyalakannya untuk Anda (lihat seksi berikut).

## Desktop: N100N sebagai sub-app otomatis

Aplikasi desktop KRA (`desktop/main.js`) memperlakukan N100N sebagai sub-app lokal, dengan pola yang sama seperti PHP server bawaannya:

1. Saat KRA dibuka, desktop memeriksa `http://127.0.0.1:5679`. Bila N100N sudah jalan sendiri (mis. lewat scheduled task Anda), ia dibiarkan apa adanya — tidak ditimpa, tidak dimatikan saat KRA ditutup.
2. Bila belum jalan, KRA menyalakan `node --env-file=.env n100n/server.js` (Node dari `KRA_NODE_BIN`, atau `node` di PATH, atau Node bawaan Electron sebagai cadangan), menunggu sampai siap, dan mematikannya saat KRA ditutup. Matikan perilaku ini dengan env `KRA_N100N_AUTOSTART=0`.
3. **First run tanpa konfigurasi**: bila `n100n/.env` belum ada, KRA membuatnya dari `.env.example` dan mengisi `APP_PASSWORD`, `APP_SECRET`, `APP_API_TOKEN`, dan `KRA_API_KEY` dengan nilai acak. Password login UI N100N adalah `APP_PASSWORD` di file itu — buka `http://127.0.0.1:5679`. Nilai yang sudah Anda isi sendiri tidak pernah ditimpa.
4. **Pairing otomatis dua arah** (mode PHP bawaan desktop): token yang sama diteruskan ke proses PHP lewat environment (`KRA_N100N_BASE_URL`, `KRA_N100N_API_KEY`, `KRA_FLOW_API_KEY`), dan ke N100N lewat `KRA_BASE_URL`/`KRA_TUGAS_URL`/`KRA_API_KEY`. Jadi tombol **CHECK N100N CONNECTION** dan **LOAD WORKFLOWS** di Creator langsung berfungsi tanpa menyalin token manual. Pada mode XAMPP/Apache, pairing env tidak berlaku — isi lewat Creator Integration Settings seperti biasa (token ada di `n100n/.env`).
5. Tombol **OPEN N100N APP** muncul bila URL N100N adalah HTTPS publik, **atau** browser dan N100N berada di mesin yang sama (kasus desktop/XAMPP lokal). Di Electron tombol ini membuka browser sistem.

Status sub-app terpapar ke UI lewat IPC `kra:get-runtime-status` (`n100n.managed/running/port`).

## Uji lokal manual (tanpa desktop)

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

Karena field Base URL dipakai bersama untuk panggilan KRA-server dan shortcut browser, URL publik itu harus dapat dijangkau dari kedua sisi. URL privat yang hanya dapat dicapai PHP tidak akan mendapat tombol shortcut UI bila halaman KRA dibuka dari mesin lain.

## Hubungkan dua arah

1. **KRA → N100N:** pada Creator → Integration Settings, set N100N Base URL ke URL yang bisa dicapai oleh server PHP KRA, dan masukkan `APP_API_TOKEN` N100N pada input API key. Nilai ini disimpan server-side; tidak dikirim ke JavaScript. (Di desktop mode PHP bawaan, langkah ini sudah dilakukan otomatis lewat environment.)
2. **N100N → KRA (opsional):** di environment N100N, set `KRA_BASE_URL=https://kantor-rama-ai.my.id` dan `KRA_API_KEY` sama dengan `KRA_FLOW_API_KEY` yang dikonfigurasi pada server KRA. Jangan salin key ke workflow JSON atau browser.
3. Simpan persistent volume untuk `APP_DATA_DIR` agar workflow dan riwayat SQLite tidak hilang saat deploy/restart.
4. Batasi port/akses service; gunakan HTTPS untuk UI publik dan password admin unik. Jangan biarkan `APP_PASSWORD` kosong/default, dan ganti `APP_SECRET` serta `APP_API_TOKEN` dengan nilai acak.
5. Dari KRA, tekan **CHECK N100N CONNECTION**, lalu **LOAD WORKFLOWS**. Untuk mengakses editor/dasbor N100N, tekan **OPEN N100N APP**.

## Workflow contoh bawaan

Selain dua contoh upstream, snapshot lokal memuat `n100n/workflows/contoh-concat-edit.json` — alur editing video Concat lewat bridge MCP (`tools/kra-concat-bridge/`), terdokumentasi di `docs/CONCAT-INTEGRATION.md`. File ini tambahan lokal di atas snapshot upstream; saat memperbarui snapshot dari upstream, pertahankan file ini.

KRA dan N100N tetap aplikasi berbeda walaupun source ada di satu repo. Push GitHub hanya menyimpan kode; agar URL publik hidup, Node service dan hostname-nya tetap harus di-deploy serta dikonfigurasi di hosting.
