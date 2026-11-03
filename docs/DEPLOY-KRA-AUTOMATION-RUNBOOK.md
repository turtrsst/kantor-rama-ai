# Runbook deploy: `git pull` + 3 launcher + pairing secret

Panduan **copy-paste** untuk mesin yang menyajikan domain (dalam catatan project:
`100.76.172.67`, XAMPP Windows). Semua perintah dijalankan sebagai operator di
mesin itu, **bukan** di Arena.

> Ringkasan alur: **merge PR → `git pull` → generate 1 secret → pasang secret di
> PHP → nyalakan 3 service → cek panel.**
>
> `KRA_EVENT_SECRET` (Node, penanda tangan HMAC) **harus sama persis** dengan
> `KRA_RNA_ROUTER_EVENT_SECRET` (PHP, verifikasi HMAC). `Pair KRA Event Secret.bat`
> menuliskan keduanya dari satu nilai acak, jadi tidak ada lagi menyalin manual.

---

## 0. Sebelum mulai (30 detik)

- Pastikan **PR #1 sudah di-merge** ke `arena/cbf4b10e-kantor-rama-ai` di GitHub.
  Branch inilah yang dipakai mesin domain; jangan `git pull` dari branch kerja
  `arena/c624bf43-kantor-rama-ai`.
- Tentukan **base URL KRA yang dijangkau proses server** (bukan browser):

  | Cara KRA dijalankan | `KRA_URL` |
  | --- | --- |
  | Desktop KRA / `php -S 127.0.0.1:8088` | `http://127.0.0.1:8088` |
  | Apache / XAMPP (document root `htdocs`) | `http://127.0.0.1/kantor-rama-ai` |

  Ini menentukan `KRA_EVENT_URL` dan URL callback GitHub Changer bila domain
  diakses lewat Apache.
- Pastikan Node.js ≥ 18 (`node -v`), Git, dan PHP 8.4 tersedia.
- Semua `.bat` meng-hardcode `C:\xampp\htdocs\kantor-rama-ai`. Kalau path
  install beda, ubah baris `cd /d` di keempat file `.bat`.

---

## 1. `git pull` di mesin domain

Buka **Command Prompt** (bisa Git Bash, tapi `.bat` butuh CMD):

```bat
cd /d C:\xampp\htdocs\kantor-rama-ai
git status -sb
git branch --show-current
```

Kalau branch bukan `arena/cbf4b10e-kantor-rama-ai`:

```bat
git checkout arena/cbf4b10e-kantor-rama-ai
```

Kalau ada perubahan lokal yang belum disimpan (mis. `api/config.json`,
`.env`, `n100n/.env`), jangan dipaksa:

```bat
git stash push -m "sebelum pull otomasi"
```

Lalu tarik **hanya** branch deploy:

```bat
git fetch origin arena/cbf4b10e-kantor-rama-ai
git pull --ff-only origin arena/cbf4b10e-kantor-rama-ai
git stash pop
```

(`git stash pop` hanya kalau tadi benar-benar `stash`.)

Cek hasilnya:

```bat
git log --oneline -3
dir Start*.bat
dir rna-router\scripts\kra-automation.js
dir models\dsh-superagent-intern\model.json
dir web\rna_router.js
```

Yang harus terlihat: commit hasil merge PR #1 (cek `git log --oneline -3`), `Start GitHub Changer.bat`,
`Start RNA Router.bat`, `Start RNA Router Automation.bat`,
`Pair KRA Event Secret.bat`.

> ⚠️ `git pull` **hanya mengganti berkas**. PHP built-in/Apache membaca file baru
> sendiri, tetapi **proses Node/Next.js yang lama tetap jalan dengan kode lama** —
> makanya langkah 5 wajib: tutup jendela service lama lalu jalankan lagi.

---

## 2. Set `KRA_URL` sekali (opsional tapi disarankan)

Supaya `Pair KRA Event Secret.bat` dan `Start GitHub Changer.bat` memakai base
URL yang benar di **semua** jendela CMD, pakai `setx` lalu tutup & buka ulang
CMD:

```bat
setx KRA_URL "http://127.0.0.1:8088"
```

Atau untuk Apache/XAMPP:

```bat
setx KRA_URL "http://127.0.0.1/kantor-rama-ai"
```

Alternatif cepat tanpa `setx` (berlaku hanya di jendela CMD itu):

```bat
set "KRA_URL=http://127.0.0.1/kantor-rama-ai"
```

Kalau tidak diset sama sekali, defaultnya `http://127.0.0.1:8088`.

---

## 3. Generate secret (dua pasang, dua perintah)

```bat
cd /d C:\xampp\htdocs\kantor-rama-ai
"Pair KRA Event Secret.bat"
node github-changer\scripts\pair-kra.js --kra-url=%KRA_URL%
```

**Perintah pertama** membuat `rna-router\.kra-secrets.env` (gitignored) berisi:

```text
KRA_EVENT_SECRET=<hex acak>
KRA_RNA_ROUTER_EVENT_SECRET=<hex yang SAMA persis>
RNA_ROUTER_URL=http://127.0.0.1:3000
KRA_RNA_ROUTER_URL=http://127.0.0.1:3000
KRA_EVENT_URL=<KRA_URL>/api/index.php?action=rna-router-event
```

Perintah itu juga **mencetak** baris `SetEnv` / `setx` yang siap ditempel di
langkah 4. Aman dijalankan ulang: secret yang sudah ada **tidak ditimpa**.

**Perintah kedua** membuat `github-changer\.env` bila belum ada dan mencetak:

```text
KRA_GITHUB_CHANGER_URL=http://127.0.0.1:4173
KRA_GITHUB_CHANGER_API_KEY=<hex>
KRA_GITHUB_CHANGER_EVENT_SECRET=<hex>
```

Simpan nilai-nilai itu sementara di Notepad. **Jangan** commit, jangan taruh di
`.htaccess` (repo publik), jangan kirim ke chat.

> Bedanya: `KRA_GITHUB_CHANGER_API_KEY` **boleh** juga diisi lewat panel
> **GitHub Changer → SAVE CONNECTION** (write-only). Tetapi kedua
> `*_EVENT_SECRET` **hanya dibaca dari environment PHP** — tidak ada kolom di
> panel. Inilah sebabnya langkah 4 tidak bisa dilewat.

---

## 4. Pasang secret di sisi PHP (pilih SALAH SATU)

### A. XAMPP / Apache — paling deterministik

Buat file **di luar repo**: `C:\xampp\apache\conf\extra\httpd-kra-secrets.conf`

```apache
# Nilai diambil dari output langkah 3. File ini TIDAK masuk Git.
SetEnv KRA_RNA_ROUTER_EVENT_SECRET        <hex dari Pair KRA Event Secret.bat>
SetEnv KRA_RNA_ROUTER_URL                http://127.0.0.1:3000
SetEnv KRA_GITHUB_CHANGER_EVENT_SECRET   <hex dari pair-kra.js>
SetEnv KRA_GITHUB_CHANGER_API_KEY        <hex dari pair-kra.js>
SetEnv KRA_GITHUB_CHANGER_URL            http://127.0.0.1:4173
```

Tambahkan satu baris di akhir `C:\xampp\apache\conf\httpd.conf`:

```apache
Include conf/extra/httpd-kra-secrets.conf
```

Cek sintaks lalu **restart Apache** lewat XAMPP Control Panel (**Stop → Start**,
bukan sekadar refresh browser):

```bat
cd /d C:\xampp\apache\bin
httpd -t
```

`SetEnv` baru terbaca setelah Apache restart; `getenv()` di PHP akan
mengembalikan nilainya.

### B. Desktop KRA / `php -S` — lewat environment proses

```bat
setx KRA_RNA_ROUTER_EVENT_SECRET "<hex dari langkah 3>"
setx KRA_RNA_ROUTER_URL "http://127.0.0.1:3000"
setx KRA_GITHUB_CHANGER_EVENT_SECRET "<hex dari pair-kra.js>"
setx KRA_GITHUB_CHANGER_API_KEY "<hex dari pair-kra.js>"
setx KRA_GITHUB_CHANGER_URL "http://127.0.0.1:4173"
```

Lalu **tutup total aplikasi desktop KRA dan buka lagi** (atau hentikan & jalankan
ulang perintah `php -S`). `setx` hanya berlaku untuk proses yang **baru**
diluncurkan; jendela CMD/service yang sudah berjalan tidak berubah.

> Ringkasan pencocokan yang harus benar:
>
> | Node | PHP | Sumber nilai |
> | --- | --- | --- |
> | `KRA_EVENT_SECRET` | `KRA_RNA_ROUTER_EVENT_SECRET` | `.kra-secrets.env` / langkah 4 |
> | `KRA_GHC_EVENT_SECRET` | `KRA_GITHUB_CHANGER_EVENT_SECRET` | `.env` / langkah 4 |
> | `KRA_GHC_API_KEY` | `KRA_GITHUB_CHANGER_API_KEY` | `.env` / panel / langkah 4 |

---

## 5. Nyalakan 3 service (masing-masing jendela sendiri, jangan ditutup)

Tutup dulu jendela lama `GitHub Changer` / `RNA Router` / automation kalau masih
jalan dari versi sebelum `git pull`. Lalu, dari `C:\xampp\htdocs\kantor-rama-ai`:

```bat
"Start GitHub Changer.bat"
```

- Menjalankan `node github-changer\scripts\pair-kra.js` lagi (**idempotent**),
  lalu service `:4173`. Bila port sudah dipakai, otomatis cuma membuka dashboard.

```bat
"Start RNA Router.bat"
```

- First run: menyalin `.env.example` → `.env.local` dan menjalankan `npm ci`
  (**butuh internet sekali**), lalu `next dev` di `:3000`.
- Isi `NEXT_PUBLIC_SUPABASE_URL` / kredensial di `.env.local` bila ingin memakai
  key vault & usage analytics. `/api/health` dan `/api/v1/models` tetap jalan
  tanpa database.

```bat
"Start RNA Router Automation.bat"
```

- Membaca `.kra-secrets.env` otomatis lewat `scripts/kra-env.js`; **tidak perlu**
  `set KRA_EVENT_SECRET` manual.
- Tiap 15 menit mencetak: `[RNA automation] … healthy=true models=N sent=true`.
  Biarkan jendela ini terbuka (Ctrl+C = berhenti). Untuk produksi, ganti dengan
  Task Scheduler / `systemd/rna-router.service` yang memanggil
  `node scripts/kra-automation.js --interval=15`.

Urutan aman: **PHP KRA → GitHub Changer → RNA Router → Automation**. Kalau
gateway belum hidup, event tetap terkirim dengan `healthy=false` (berguna untuk
deteksi, bukan error).

---

## 6. Verifikasi (5 menit)

| Cek | Hasil yang diharapkan |
| --- | --- |
| `http://kantor-rama-ai.my.id/index.html` → **`Ctrl+F5`** | Tombol **✦ GitHub Changer** dan **⚡ RNA Router** muncul; terminal Content Creator rapi (tab tidak nempel kotak gelap, composer 2 baris); tab chat **Dira** ada. |
| Panel **⚡ RNA Router → CHECK CONNECTION** | `CONNECTED`, grid `Event bridge: HMAC active`, `Auto fallback: AKTIF`. |
| Panel **DAFTAR MODEL** / **TEST CHAT** | Daftar model muncul; TEST CHAT menjawab (butuh akun **admin + supervisor**). |
| Panel **✦ GitHub Changer** | Status `CONNECTED`, activity/repos terbaca. |
| `cd rna-router && node scripts\kra-automation.js --once` | Baris `sent=true`. Kolom **Automation** di panel berubah jadi timestamp baru. |
| `git log --oneline -1` | Commit terbaru hasil merge PR #1. |

Catatan: panel membutuhkan sesi login SIAS. `eventSecretConfigured` di panel
`rna-router-config` / `github-changer-config` hanya **`true/false`** — nilai
secret tidak pernah dikirim ke browser.

---

## 7. Troubleshooting

| Gejala | Penyebab & perbaikan |
| --- | --- |
| `sent=false (signature tidak valid …)` | Kedua secret beda. Ulangi langkah 4 dengan nilai dari **langkah 3**, lalu restart Apache/desktop. Cek juga selisih jam kedua mesin (toleransi 15 menit). |
| `sent=false (KRA_EVENT_SECRET belum diset)` | `.kra-secrets.env` hilang/terhapus, atau dijalankan dari folder lain. Jalankan `Pair KRA Event Secret.bat` lagi. |
| Event `healthy=false models=0 error=fetch failed` | Gateway `:3000` belum jalan. Ini **bukan** masalah secret — event tetap diterima KRA. Nyalakan `Start RNA Router.bat`. |
| `eventSecretConfigured: false` di panel | `SetEnv` belum di-`Include` / Apache belum direstart, atau `setx` tapi desktop belum dibuka ulang. |
| `git pull` ditolak | Ada perubahan lokal: `git stash push` → pull → `git stash pop`. Jangan `git reset --hard` bila `api/config.json` berisi kredensial. |
| `npm ci` gagal | Mesin butuh akses `registry.npmjs.org` sekali saat setup; jalankan ulang `Start RNA Router.bat`. |
| `EADDRINUSE :3000` / `:4173` | Masih ada proses lama. Tutup jendela lama atau `taskkill /PID <pid> /F` setelah `netstat -ano \| findstr :3000`. |
| Domain masih tampilan lama | `Ctrl+F5`; cache key `app.js`, `ui_refresh.css`, `ui_polish.css`, `creator_studio_terminal.css` sudah dinaikkan di commit ini. |
| `KRA_EVENT_URL` salah (Apache) | Ulangi `Pair KRA Event Secret.bat` dengan `set "KRA_URL=http://127.0.0.1/kantor-rama-ai"`. Kalau file sudah ada, hapus `rna-router\.kra-secrets.env` dulu lalu pairing ulang (secret baru → **ulangi langkah 4**). |
| `git pull` terjadi dua kali | Jangan aktifkan **dua-duanya**: webhook GitHub Changer **dan** `.github/workflows/deploy-kra.yml`. Pilih satu. |

---

## 8. Checklist keamanan

- 🔴 Jangan commit `rna-router/.kra-secrets.env`, `github-changer/.env`,
  `rna-router/.env.local`, `api/config.json`, atau `n100n/.env` — semuanya sudah
  di `.gitignore`.
- 🔴 Jangan taruh secret di `.htaccess`, `web/`, atau file yang tersaji publik.
- ✅ `.htaccess` memblokir `github-changer/` dan `rna-router/` lewat Apache.
- ✅ Callback `rna-router-event` / `github-changer-event` memakai `hash_equals`
  atas HMAC **body mentah** + jendela 15 menit; tanpa secret semua event ditolak.
- ✅ Service key PHP bersifat write-only; `TEST CHAT` butuh admin + supervisor.
- ✅ Setelah `git pull`, **restart proses Node** — kode baru tidak otomatis
  dipakai proses lama.

---

Dokumen terkait: [`RNA-ROUTER-INTEGRATION.md`](RNA-ROUTER-INTEGRATION.md),
[`GITHUB-CHANGER-INTEGRATION.md`](GITHUB-CHANGER-INTEGRATION.md),
[`INTERN-SUPERAGENT.md`](INTERN-SUPERAGENT.md).
