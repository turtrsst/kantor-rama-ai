# GitHub Changer — provenance bundel KRA

Folder ini adalah snapshot **sumber** aplikasi [turtrsst/github-changer](https://github.com/turtrsst/github-changer),
dibundel ke dalam repo `turtrsst/kantor-rama-ai` dengan pola yang sama seperti
`n100n/`: satu repo, dua runtime. KRA tetap PHP (`api/`), GitHub Changer tetap
service Node mandiri pada port **4173**.

| Fakta | Nilai |
| --- | --- |
| Repo upstream | `turtrsst/github-changer` (public) |
| Branch upstream | `arena/a2271201-github-changer` |
| Commit dipin | `0635992476a2e0a53e795aeaf50dc2638981ef41` (`fix: modal detail di atas overlay, push tanpa commit ditandai noChanges, peringatan SSH, v1.0.2`) |
| Versi aplikasi | `1.0.2` (`package.json`) |
| Lisensi | MIT |
| Tanggal bundle | 2026-11-02 |
| Yang **tidak** dibundel | `.git/`, `.env`, `data/` (token/sesi/log), `node_modules/`, `.github/workflows/deploy-kra.yml` |

Workflow deploy upstream tidak disalin ke dalam folder ini karena GitHub hanya
membaca `.github/workflows/` di root repo; salinannya ada di
[`.github/workflows/deploy-kra.yml`](../.github/workflows/deploy-kra.yml) dan
dinonaktifkan sampai `KRA_DEPLOY_ENABLED=true` di-set. Dokumen asli
`docs/deploy-kra.md` tetap disertakan sebagai referensi; panduan yang berlaku
untuk repo ini ada di [`docs/GITHUB-CHANGER-INTEGRATION.md`](../docs/GITHUB-CHANGER-INTEGRATION.md).

## Tambahan lokal KRA (di atas snapshot upstream)

| Berkas | Perubahan |
| --- | --- |
| `server/lib/kra.js` | **Baru.** Utilitas jembatan KRA: verifikasi `x-api-key` waktu-konstan, redaksi konfigurasi rahasia, sanitasi URL remote, dan notifikasi keluar bertanda tangan HMAC-SHA256 ke `api/index.php?action=github-changer-event`. |
| `server/lib/env.js` | **Baru.** Pemuat `.env` zero-dependency. Upstream menyuruh `cp .env.example .env` tetapi `npm start` tidak pernah membacanya; bundle KRA membutuhkannya untuk pairing desktop. Environment proses tetap menang. |
| `server/lib/config.js` | Mengimpor `env.js` lebih dulu supaya `.env` terbaca sebelum parameter dievaluasi. |
| `server/api.js` | Endpoint mesin-ke-mesin `GET /api/kra/status`, `GET /api/kra/repos`, `GET /api/kra/activity`, `POST /api/kra/sync` (wajib `x-api-key` = `KRA_GHC_API_KEY`; 503 bila kunci tidak diset). Bootstrap tanpa sesi tidak lagi membocorkan `automation.webhookSecret` / `deployCommand`; UI yang sudah login tetap bisa menyalin secret-nya sendiri. |
| `server/lib/automation.js` | Setiap run automasi (schedule / webhook / manual) mengirim ringkasan hasil ke KRA, best-effort — **termasuk run yang `skipped`** (mis. belum login GitHub). Trigger `kra` tidak dikirim dua kali karena respons `/api/kra/sync` sudah memuat hasilnya. |
| `.env.example` | Tiga variabel jembatan: `KRA_GHC_API_KEY`, `KRA_GHC_EVENT_URL`, `KRA_GHC_EVENT_SECRET`. |
| `scripts/pair-kra.js` | **Baru.** Helper pairing XAMPP: isi `.env` dengan kunci acak dan cetak variabel yang harus diset di PHP KRA. |
| `scripts/smoke-test.js` | Tes regresi untuk endpoint `/api/kra/*`, penolakan kunci palsu, dan redaksi secret pada bootstrap publik. |
| `package.json` | `npm run check` menyertakan berkas jembatan. |

Semua perubahan di atas **hanya ada di bundle KRA ini**. Repo upstream tidak
diubah. Saat menarik snapshot baru dari upstream, pertahankan berkas/baris
bertanda "KRA" di atas (atau jalankan ulang patch yang terdokumentasi di
`docs/GITHUB-CHANGER-INTEGRATION.md`).

## Cara menjalankan

```bash
cd github-changer
cp .env.example .env       # isi GITHUB_CLIENT_ID + KRA_GHC_API_KEY
npm run doctor
npm start                  # http://127.0.0.1:4173
npm test                   # 79 pemeriksaan offline, termasuk jembatan KRA
```

Dari root repo KRA: `npm run github-changer` (lihat `package.json`). Peluncur
Windows: `Start GitHub Changer.bat`.

## Isolasi & keamanan

- `.htaccess` KRA menolak akses HTTP langsung ke `github-changer/` — UI harus
  disajikan oleh proses Node, bukan Apache/PHP.
- `.env`, `data/`, dan `*.log` ada di `.gitignore`; jangan pernah commit token
  OAuth, sesi, atau `KRA_GHC_API_KEY`.
- Jembatan `/api/kra/*` **nonaktif** sampai `KRA_GHC_API_KEY` diisi, dan tidak
  memakai sesi browser. Tanpa kunci yang sama di sisi KRA, PHP tidak bisa
  memanggilnya.
- `automation.branch` di upstream dikunci ke branch deploy KRA; jangan menarik
  `main` secara diam-diam. Lihat `docs/deploy-kra.md`.
