# Laporan Implementasi KRA Multiuser, Workspace, Paket & Memori Hybrid

Tanggal: **2 November 2026**; branch: `arena/cbf4b10e-kantor-rama-ai`;
baseline sebelum pekerjaan komersial: `b67fefe`.

Dokumen operasional lengkap tetap berada di
[`COMMERCIAL-AND-WORKSPACES.md`](COMMERCIAL-AND-WORKSPACES.md). Laporan ini
mencatat hasil implementasi, bukti pengujian yang benar-benar dijalankan, dan
pekerjaan yang hanya dapat dibuktikan di mesin pemilik.

## Ringkasan hasil

Blueprint yang disetujui telah diterapkan dari fondasi tenant sampai UI dan
dokumentasi:

1. **Tenant context server-side** untuk user SIAS, workspace aktif, role
   member, deployment mode, legacy claim, dan entitlement.
2. **Workspace terisolasi** untuk chat, agent, task, workflow, proyek, usage,
   provider BYOK, Vault, serta kredensial YouTube, Telegram, dan N100N.
3. **Content Creator tidak lagi terbuka untuk semua login SIAS.** Akses hanya
   melalui admin SIAS persis, langganan pemilik workspace yang aktif, atau
   lisensi offline yang valid. Role operasional seperti supervisor tidak
   menjadi bypass billing.
4. **Paket berbayar** sesuai harga yang diminta:
   - PRO: Rp9.000/bulan atau Rp100.000/tahun;
   - PLUS: Rp15.000/bulan atau Rp150.000/tahun;
   - PLATINUM: Rp50.000/bulan atau Rp500.000/tahun.
5. **Billing manual dan webhook generik bertanda tangan**, trial PRO 7 hari,
   grace langganan 3 hari, pembatalan, antrean order admin, dan aktivasi oleh
   admin platform.
6. **Lisensi offline Ed25519 `KRA1`** untuk distribusi local-first, termasuk
   CLI penerbit di `tools/license-issue.php`. Private key tidak disimpan di
   repo.
7. **Memori hybrid anti-amnesia:** percakapan mentah tetap di MySQL/JSON,
   sedangkan ringkasan, keputusan, preferensi, fakta, dan tugas terbuka
   dikompilasi menjadi catatan Obsidian per workspace. Recall dibatasi pada
   workspace aktif.
8. **Proyek local-first yang aman:** folder default dipisahkan sebagai
   `KRA Workspaces/<workspace-id>/`; hosted mode menahan proyek di area
   workspace-nya dan browser tidak menerima path host yang tidak perlu.
9. **Gate fitur di API**, bukan hanya UI, untuk Creator, skills lanjutan,
   Diskusi, YouTube, Analytics, N100N/Concat, Telegram, workflow, Vault,
   provider, proyek, dan kuota bulanan.
10. **UI komersial dan onboarding** untuk memilih workspace, melihat paket,
    checkout manual, trial, lisensi, member, proyek, provider, setup, memori,
    dan administrasi order/langganan.

Perbaikan audit terakhir yang ikut masuk:

- token lisensi instalasi dari environment/file global tidak diwariskan ke
  workspace hosted non-legacy;
- workflow Office murni tidak lagi menuntut fitur Creator;
- pemeriksaan kuota workspace/member/proyek memulihkan tenant context
  pemanggil;
- onboarding tidak lagi memakai variabel status yang tidak terdefinisi dan
  tidak mewajibkan langganan berbayar untuk kesiapan Office dasar;
- toggle Crew dapat disinkronkan ulang ketika entitlement turun;
- error kuota registrasi proyek dibedakan dari error registrasi biasa.

Semantik binding lisensi saat ini perlu diketahui sebelum menerbitkan lisensi
multi-binding: bila payload memuat lebih dari satu binding
(workspace/user/username/email), **satu binding yang cocok sudah memberi
akses**. Jika kebijakan bisnis yang diinginkan adalah semua binding harus
cocok sekaligus, ubah kebijakan itu sebelum lisensi multi-binding diterbitkan.

## Verifikasi yang dijalankan

Semua perintah berikut dijalankan ulang setelah perbaikan frontend/backend
terakhir, pada 2 November 2026:

| Pemeriksaan | Hasil |
| --- | --- |
| PHP-WASM lint `tools/runtime-harness/lint.php` | **46 file, 0 gagal** |
| Runtime legacy `VITEST=1 node run.mjs` | **44 PASS, 0 FAIL** |
| Runtime komersial `VITEST=1 node run.mjs test-commercial.php` | **23 PASS, 0 FAIL, 1 SKIP** |
| `node --check` untuk `web/app.js`, `web/login.js`, Electron main/preload, verifier komersial | **PASS** |
| `npm run verify:commercial` | **PASS** |
| Verifier non-Electron di `tools/verify-*.js` | **22 PASS, 0 FAIL** |
| `git diff --check` terhadap baseline `b67fefe` | **PASS** |
| Delta final terhadap baseline | **42 file, tanpa penghapusan file** sebelum laporan ini ditambahkan |

Satu `SKIP` pada runtime komersial adalah tanda tangan Ed25519: build
PHP-WASM sandbox tidak menyediakan extension sodium. Binding payload dan
grace lisensi tetap diuji; tanda tangan kriptografisnya harus dibuktikan
dengan PHP pemilik yang memiliki sodium.

Enam verifier berbasis Electron tidak dijalankan karena binary Electron di
sandbox tidak terpasang dengan benar. Itu kegagalan lingkungan, bukan hasil
uji aplikasi.

Ancestry Git sandbox sempat tereseed ke graft lama. Pemulihan dilakukan
dengan membuktikan staged tree terhadap `origin` di `b67fefe`, membuat commit
implementasi, lalu merge `-X ours`. Tree hasil merge identik dengan tree yang
telah diverifikasi: `337605f1a73076460a0daf6c0f8a7d1dcfb62823`.

## Yang belum boleh diklaim selesai

Hal berikut belum dibuktikan dari sandbox dan tetap wajib diuji di mesin
pemilik sebelum akses hosted berbayar dijual:

1. Migrasi skema komersial pada MySQL nyata dan uji dua akun/workspace
   berbeda dari browser.
2. Smoke test GUI/browser/Electron: onboarding, ganti workspace, member,
   proyek, checkout/admin, lisensi, toggle Diskusi, workflow Office/Creator.
3. Pembuatan dan verifikasi lisensi dengan PHP + sodium nyata.
4. OAuth/Analytics/upload YouTube dengan akun Google pemilik.
5. Bot API Telegram, webhook HTTPS, dan approval dari chat pemilik.
6. Payment gateway nyata; implementasi saat ini adalah checkout manual dan
   adapter webhook HMAC generik, bukan integrasi gateway bernama yang live.
7. Render/export Concat nyata dan balasan model dari provider/Ollama pemilik.

Sampai checklist tersebut lulus, jalur rilis yang aman adalah **local-first
berlisensi**: KRA berjalan di mesin pelanggan/pemilik, proyek dan Vault berada
di mesin yang menjalankan PHP/KRA, pengguna membawa provider sendiri
(BYOK/Ollama), dan akses Creator dibuka oleh admin SIAS, subscription, atau
lisensi offline.

## Acuan operator

- Paket, API, aktivasi, lisensi, deployment, dan checklist hosted:
  [`COMMERCIAL-AND-WORKSPACES.md`](COMMERCIAL-AND-WORKSPACES.md)
- Instalasi: [`../install.md`](../install.md)
- Harness runtime: [`../tools/runtime-harness/README.md`](../tools/runtime-harness/README.md)
- Penerbit lisensi: [`../tools/license-issue.php`](../tools/license-issue.php)

Tidak ada secret, token, API key, private key, atau kredensial pelanggan yang
ditulis ke laporan ini atau diminta melalui chat.
