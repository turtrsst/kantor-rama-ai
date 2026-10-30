# Remediation status — KRA audit

**Branch:** `arena/23a84f9d-kantor-rama-ai`
**Tanggal:** 29 Oktober 2026

## Implemented in this pass

- Provider API response kini memakai `ProviderConfig::publicSummary()` dan tidak mengirim raw API key atau nama env key.
- Token pairing demo dihapus dari runtime; API tidak lagi seed akun setiap request; fallback raw-hash dan cookie auth dihapus. Login default mengarah ke SIAS `sias2025`. Session token browser dipindah ke `sessionStorage`.
- Endpoint tindakan sensitif (approve/reject/undo, terminal, perubahan agent/skill, meeting/vault write) membatasi role supervisor/admin.
- Stored XSS pada nama/role roster dan hired-agent tab diperbaiki menggunakan `textContent`/escape; login dipindah ke JS eksternal, CSP script inline dihapus/dibatasi; navigasi dan IPC Electron dibatasi, generic shell IPC dihapus.
- Terminal hanya dari `/run`, memerlukan dialog konfirmasi, hanya tersedia untuk loopback + supervisor/admin, tokenisasi argv tanpa shell, executable allowlist, penolakan shell operator/inline eval, timeout/output cap. ReAct tidak lagi dapat memanggil terminal tool.
- Runner memeriksa boundary canonical path, menolak symlink pada target dan mengharuskan backup yang aman. Undo ikut memeriksa root dan symlink. Browse project dan API audit dibatasi dengan boundary direktori.
- SSRF fetch mengklasifikasi semua alamat DNS/IP, menolak private/reserved/non-routable, pin alamat DNS di cURL, memvalidasi setiap redirect, membatasi port, dan membutuhkan cURL aman.
- CI dijalankan pada push/PR semua branch; pemeriksaan JS tidak lagi memakai `|| true`; ditambah PHP lint dan tes terminal bridge.
- Jalur aset diperbaiki agar berjalan pada pemasangan subfolder (hapus `<base href="/">`, gunakan path `../assets`); image request single-flight, dimuat paralel, dan dimasukkan ke CacheStorage persisten. URL aset berversi; CSS/asset mendapat cache headers. Refresh browser tidak seharusnya meminta ulang asset yang sudah tersimpan kecuali cache dibersihkan/versi berubah.
- Terminal tab menerima pesan bahasa biasa sebagai chat ke channel sebelumnya, bukan menjalankan teks sebagai command. ReAct menampilkan indikator progress/typing dan action-observation bertahap tanpa memaparkan raw private chain-of-thought. Approval gate tetap terpisah dan model error tidak lagi menghasilkan placeholder palsu.
- Satu `/create-app` memang menyelesaikan satu file yang disetujui, bukan menjalankan server atau menulis otomatis file berikutnya. Tombol `CONTINUE APP` tersedia dari terminal setelah execute dan pada task Completed; form meminta path relatif dan perubahan, lalu mengirim proposal baru ke approval gate.
- Task Board menyimpan task hasil approval di state UI dan otomatis memilih Completed bila tidak ada Pending; sebelumnya tab Pending tetap aktif sehingga selesai tampak seperti queue kosong. Runner HTTP error kini menampilkan pesan yang terbaca, bukan menggantung sebagai stream.
- Team chat memakai streaming NDJSON: setiap balasan sub-agent ditampilkan saat siap, konteks beberapa pesan terakhir dikirim ke model, provider chat bisa dipilih dari UI (mis. 9Router/Ollama), dan ReAct memakai provider pilihan; alamat provider non-loopback meminta action **ALLOW & SEND** sebelum menerima prompt/konteks. Chat menolak simulator dan tidak lagi menjawab dengan template jika provider live gagal; UI menunjukkan error dan tombol retry pada provider lain. Uji provider nyata tetap memerlukan konfigurasi `api/config.json`, key bila diperlukan, dan koneksi host.
- Workspace awal bersifat read-only: project tree dan file preview dibatasi pada folder project KRA yang dipilih/task-linked; path/symlink, file secret, binary, dan file di atas 256 KB tidak dibuka. Maya hanya membaca file saat project dipilih; edit dari chat tanpa workspace akan diminta ulang setelah pemilihan project. Proposal workspace menyimpan root terpilih dan Approval Gate mengambil baseline file itu untuk diff sebelum approval. Legacy proposal tanpa workspace tidak membuka file KRA untuk preview.
- Chat composer menerima hingga lima lampiran gambar, PDF, atau teks. PDF diekstrak lokal di browser dengan PDF.js, tanpa upload/penyimpanan PDF mentah; PDF scan mengirim paling banyak dua halaman sebagai gambar tanpa OCR. Provider eksternal menyertakan lampiran di prompt consent; image input membutuhkan model vision. Tab Terminal tetap memetakan pesan biasa ke percakapan terakhir, sedangkan command OS hanya lewat `/run` plus konfirmasi. Indikator thinking yang tadinya disembunyikan sekarang tampil dengan animasi yang menghormati reduced-motion.

## Masih menunggu tindakan/review

1. **49 skill ditandai `pending-review`**, dengan SHA-256 di lockfile diperbarui. Ini disengaja: konten yang berubah tidak boleh otomatis tetap dipercaya. Skill tersebut akan withheld sampai dibaca/review lalu disetujui secara eksplisit lewat `tools/skills-lock.php`. Karena itu `verify-skills.php`/skill gate dapat tetap gagal sampai review selesai.
2. Native PHP 8.2, API/SIAS/MySQL, dan Electron production test belum dijalankan. Sandbox tidak memiliki `php` sistem; verifikasi PHP di bawah memakai PHP-WASM 8.5.10 dan shim `php` untuk command child-process, jadi belum menggantikan pengujian runtime Windows/Apache. Workflow CI tetap harus diperiksa hasilnya, khususnya SIAS role, `proc_open` array di Windows, migration MySQL, login, approve/undo, dan SSRF.
3. MySQL auto-migration masih terjadi saat koneksi API; akun runtime perlu least privilege dan migration terpisah untuk production. Buat `KRA_DB_USER` non-root. Penggunaan root tanpa password dibatasi pada PHP built-in server loopback untuk dev; override eksplisit juga hanya berlaku untuk request loopback.
4. Rate limiting login dan expiry/revocation session belum ditambahkan. Tetapkan ini sebelum jaringan luas.
5. Uji path setelah instalasi Apache subfolder dan Electron XAMPP; pastikan SIAS database benar dan akun memiliki role supervisor/admin agar tombol approval/terminal dapat dipakai.

## Verifikasi ulang aset dan skills (29 Oktober 2026)

- Manifest atlas pixel utama parse sebagai JSON; 46 sprite frame semuanya berada di dalam batas atlas. Diffuse dan emission PNG masing-masing tersedia dan berukuran 512×512; atlas memiliki grid 32 px.
- 17 literal path aset dari app/batch loader diperiksa terhadap checkout: seluruhnya ada. Sprite sheet modular Batch 11 adalah 512×160, sesuai 16 kolom × 4 arah dengan frame 32×40.
- `image-rendering` fallback CSS di canvas diurutkan agar `pixelated` menjadi algoritme utama; renderer canvas juga memakai `imageSmoothingEnabled = false`. Chromium headless berhasil memuat atlas dan menampilkan canvas pada ukuran 1440×1000.
- Skills: 105 folder dan 105 entri lock; 0 mismatch hash/entri hilang/orphan, tetapi 49 masih `pending-review` dan sengaja tidak diaktifkan. `verify-skills.php` dicoba via PHP-WASM dan berhenti pada verifikasi lock (sesuai 49 status pending); 10 Node tests terkait dua skill lulus.
- Chromium headless smoke test (1440×1000, local static server, API mocked): app dan atlas siap; texture 512×512, 187 sprite metadata terdaftar (46 base atlas + batch assets), 41 image entries di cache, 46 respons aset semuanya HTTP 200, 0 error JS, 0 asset 404. Screenshot: `screenshots/kra-pixel-smoke-test.png`. Pengujian ini tidak memvalidasi API PHP/DB/provider nyata.
- Smoke test menemukan CSP menolak object URL `blob:` sehingga atlas tidak bisa didecode; `blob:` kini ditambahkan khusus pada `img-src`. Test berikutnya juga menemukan mapping roster mencoba key `creator/modifier/auditor/ops` yang tidak ada; kini diarahkan ke sprite `budi/maya/dimas/siti`.
- Browser e2e dengan API test doubles menjalankan `/create-app` → project location gate → proposal → approve/execute → tombol `CONTINUE APP` → proposal/approval kedua. Lulus: dua model call, dua task completed, Completed tab otomatis aktif, root app tetap sama, 0 error JS/404 aset. Ini tidak menulis file nyata karena API di-mock.
- PHP-WASM 8.5.10: `tools/test-terminal-bridge.php` lulus (allowlisted `php --version` lewat temporary test shim; shell operators dan encoded command ditolak); `tools/test-task-engine.php` lulus (task `WAITING_APPROVAL` → `EXECUTED`, file test dibuat lalu dibersihkan). Belum membuktikan runtime native Windows.
- JS parse seluruh file, asset registry verification, dan `git diff --check` lulus.

## Status keseluruhan

Risiko terburuk dari kredensial bawaan, kebocoran raw API key, implicit shell, XSS utama, dan file-write containment sudah ditangani di source. Namun jangan menganggap audit bersih sampai 49 skill direview, PHP/API test lulus, dan konfigurasi produksi (TLS, SIAS, DB, provider keys, filesystem permissions) diverifikasi.
