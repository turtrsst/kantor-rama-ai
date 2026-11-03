# RNA Router — provenance bundel KRA

Snapshot **sumber** [turtrsst/RNA-Router](https://github.com/turtrsst/RNA-Router)
dibundel ke `turtrsst/kantor-rama-ai` mengikuti pola `n100n/` dan
`github-changer/`: satu repo, beberapa runtime.

| Fakta | Nilai |
| --- | --- |
| Repo upstream | `turtrsst/RNA-Router` (public) |
| Branch | `arena/ffbada04-rna-router` |
| Commit dipin | `34fcbf25e895ad6dd2e13ca5d83815b596dd95e3` (`fix: widget useIntervalState typo -> useState`) |
| Versi | `1.0.0` (`package.json`) |
| Stack | **Next.js 14** + Tailwind + Supabase/MySQL, Node ≥ 18 |
| Port | `3000` (`npm run dev` / `npm start`) |
| Tanggal bundle | 2026-11-03 |
| Tidak dibundel | `.git/`, `node_modules/`, `.next/`, `.env*`, log runtime, `rna-fallback-log.txt` |

## Perbedaan penting dengan dua bundle lainnya

`n100n/` dan `github-changer/` **zero dependency** dan langsung bisa dijalankan
dengan `node server.js`. RNA Router adalah aplikasi **Next.js** yang membutuhkan
`npm install` (+ `npm run build` untuk produksi) dan database Supabase/MySQL
untuk fitur key vault/usage. Karena itu KRA **tidak** menyalakannya otomatis
lewat desktop; peluncurnya adalah `Start RNA Router.bat` / `npm run rna-router`.

Yang benar-benar berjalan tanpa install adalah **automation KRA** di
`scripts/kra-automation.js` (Node murni, zero dependency): ia memantau
`/api/health` + `/api/v1/models`, opsional menguji `/api/v1/chat/completions`,
lalu mengirim laporan bertanda tangan HMAC ke KRA. Lihat
[`docs/RNA-ROUTER-INTEGRATION.md`](../docs/RNA-ROUTER-INTEGRATION.md).

## Tambahan lokal KRA

| Berkas | Perubahan |
| --- | --- |
| `scripts/kra-automation.js` | **Baru.** Scheduler health/model + signed event ke `action=rna-router-event`. Mendukung `--once`, `--interval=N`, `--probe-chat`. |
| `scripts/kra-automation.test.js` | **Baru.** Tes offline dengan mock gateway + mock KRA (verifikasi HMAC, penolakan signature palsu, dry-run tanpa secret). |
| `scripts/kra-env.js`, `scripts/pair-kra.js` | **Baru.** Pemuat `.kra-secrets.env` + generator **satu** secret bersama untuk Node dan PHP (`Pair KRA Event Secret.bat`). |
| `package.json` | Skrip `automation:kra` dan `test:automation`. |
| `UPSTREAM.md` | Dokumen ini. |

Di sisi KRA (di luar folder ini): `api/lib/KraRnaRouterClient.php`, pengaturan
`KraIntegrationSettings::rnaRouter()`, action `rna-router-*`, tombol/panel di
`web/rna_router.js`, entri provider `rna-router` di `api/config.example.json`,
serta `.htaccess` yang menolak akses HTTP langsung ke source Next.js.
Runbook deploy: [`docs/DEPLOY-KRA-AUTOMATION-RUNBOOK.md`](../docs/DEPLOY-KRA-AUTOMATION-RUNBOOK.md).

## Menjalankan

```bash
cd rna-router
cp .env.example .env.local      # isi Supabase / MySQL
npm ci
npm run dev                     # http://127.0.0.1:3000
node scripts/kra-automation.js --once
```

Dari root KRA: `npm run rna-router`, `npm run rna-router:automation`,
`npm run rna-router:test`.

## Keamanan

- Jangan commit `.env`, `.env.local`, `rna-router.db`, atau log fallback.
- `KRA_EVENT_SECRET` (Node) harus sama dengan
  `KRA_RNA_ROUTER_EVENT_SECRET` (PHP). Tanpa secret, automation hanya mencetak
  laporan dan tidak mengirim apa pun.
- Endpoint `/api/keys` milik upstream menyimpan kunci provider; jangan dibuka
  ke internet tanpa autentikasi. `.htaccess` KRA memblokir seluruh folder
  `rna-router/` bila document root sama.
