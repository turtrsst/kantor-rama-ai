# Audit Komplit Project KRA

**Tanggal audit:** 29 Oktober 2026 (UTC)
**Branch/commit:** `arena/23a84f9d-kantor-rama-ai` / `288b2f6`
**Jenis:** audit statis source, threat review, inventaris, dan pemeriksaan yang dapat dijalankan di lingkungan ini.
**Verdict:** **NO-GO untuk deployment yang dapat diakses jaringan / menyimpan kredensial produksi** sampai temuan kritis dan tinggi ditangani.

> Ini adalah snapshot temuan awal sebelum remediasi di branch sesi. Implementasi remediasi terbaru dirangkum pada `docs/remediation-status.md`; temuan yang memerlukan PHP/MySQL tetap belum dapat diuji runtime karena PHP tidak terpasang pada sandbox.

## Ringkasan eksekutif

KRA adalah aplikasi kantor virtual multi-agent: frontend JavaScript/HTML/CSS, API PHP, backend MySQL dengan fallback JSON, desktop wrapper Electron, serta library skill dan aset 2D. Inventaris checkout: sekitar 2.500 file Git-tracked, 72 file PHP, 67 JS, 1.757 PNG, 105 skill terpasang di `resources/skills`, dan total checkout sekitar 44 MB (tidak termasuk ukuran Git object store).

Ditemukan **2 temuan Critical, 4 High, dan 7 Medium**:

1. API mengembalikan nilai `apiKey` konfigurasi provider kepada pemanggil endpoint `providers`.
2. Token pairing officer statis ditanam di source, ditulis ulang ke database setiap request, dan dapat dipakai sebagai kredensial Bearer. Ini membuat autentikasi dapat ditebak; token Rama ber-role supervisor.
3. Fitur terminal menjalankan shell arbitrer; blacklist beberapa string bukan sandbox/allowlist.
4. XSS tersimpan memungkinkan lewat nama/role agent yang masuk ke `innerHTML`; dalam Electron, jalur ini berpotensi menjadi eskalasi ke eksekusi perintah karena preload mengekspos IPC terminal.
5. Validasi batas direktori saat menulis file tidak aman terhadap symlink dan menggunakan prefix path tanpa pemisah.
6. SSRF guard web-fetch dapat dilewati melalui DNS/IP alternatif dan redirect.

Selain itu, verifikasi independen atas lockfile skill menemukan **49 dari 105 checksum yang tidak cocok** dengan file `SKILL.md` saat ini. Karena sistem menahan skill yang checksum-nya berbeda, skill yang terdampak tidak dianggap approved saat aktivasi dan gate skill seharusnya gagal.

## Temuan terprioritas

### KRA-SEC-01 — Critical: rahasia provider bocor melalui API

**Bukti:** `api/ProviderConfig.php:27-35` memasukkan nilai konfigurasi `apiKey` mentah ke hasil `ProviderConfig::load()`. `api/index.php:486-488` mengembalikan hasil itu utuh sebagai response action `providers`. Action tersebut berada setelah pemeriksaan login umum, tetapi kredensial pairing statis pada KRA-SEC-02 membuat pemeriksaan tersebut dapat dilewati.

**Dampak:** siapa pun yang memperoleh akses API dapat mengambil API key dari `api/config.json`, lalu menyalahgunakannya di luar KRA (biaya, kuota, akses data/provider). Environment-variable names juga dikembalikan; nama env sendiri tidak rahasia, tetapi tidak perlu diekspos.

**Perbaikan:** jangan pernah memasukkan nilai secret ke object publik; buat DTO status provider yang hanya mengandung `configured: true/false`, provider/model, dan health. Simpan key hanya dari environment/secret store; rotasi seluruh key yang pernah tersimpan di config atau berpotensi terpapar. Tambahkan tes yang memastikan response `providers` tidak memiliki `apiKey`, token, maupun secret.

### KRA-SEC-02 — Critical: kredensial default yang diketahui memberi akses penuh

**Bukti:** `api/lib/KraAuth.php:6-37` mendefinisikan pairing key literal seperti `kra_officer_rama`; `seedDefaultOfficers()` (`:131-149`) menyimpan hash key tersebut sebagai `session_hash`. `api/index.php:58-64` memanggil seed pada setiap request. `extractBearer()` menerima Bearer token (`KraAuth.php:46-55`), lalu `authenticate()` membandingkan hash token (`:68-95`).

**Dampak:** key yang ada di repository dapat dipakai langsung untuk akses API—bukan sekadar contoh credential. Seeding berulang juga dapat mengatur ulang hash akun officer yang bentrok pada username/unique key. Role `supervisor` pada Rama memberi akses setara supervisor jika otorisasi berbasis role ditambahkan kemudian; saat ini banyak endpoint tidak melakukan pemeriksaan role sama sekali.

**Perbaikan:** hapus akun/pairing key default dari production path; jangan seed akun pada setiap request; migrasikan ke provisioning eksplisit dengan kredensial acak/rotasi. Cabut sesi lama, rotasi token/key provider, tambahkan rate limit login, audit trail, dan matriks otorisasi server-side untuk setiap aksi mutasi. Jangan mengembalikan pairing key dari endpoint officer directory.

### KRA-SEC-03 — High: perintah shell arbitrer pada API dan Electron

**Bukti:** `api/lib/KraTerminalBridge.php:16-27,40-45` hanya memblokir beberapa substring sebelum menjalankan perintah lewat `proc_open`; payload lain dijalankan sebagai command shell. IPC `kra:exec-command` di `desktop/main.js:135-166` memiliki pola serupa dan memanggil PowerShell atau `/bin/sh`.

**Dampak:** pengguna yang lolos autentikasi bisa menjalankan operasi dengan hak proses webserver/desktop, membaca file lokal, mengubah/menghapus data, mengakses credential, atau memasang persistence. Daftar blocklist dapat dilewati dengan variasi sintaks/alias dan tidak membatasi target filesystem. Electron preload mengekspos fungsi ini ke renderer; XSS atau navigasi renderer yang tidak dibatasi memperluas dampaknya. Output Electron juga ditampung tanpa batas byte.

**Perbaikan:** matikan terminal remote secara default; bila diperlukan, gunakan daftar perintah/argumen yang diizinkan, validasi argumen per command, direktori kerja dan sandbox OS/container, batas output/CPU/memori, serta izin supervisor terpisah. Batasi IPC pada frame utama tepercaya, validasi origin/frame pada setiap handler, dan jangan sediakan shell generik dari preload. Blocklist bukan kontrol keamanan yang memadai.

### KRA-SEC-04 — High: stored XSS pada data agent; risiko eskalasi Electron

**Bukti:** data agent di `web/app.js:3974-3982` disisipkan mentah ke `innerHTML` (`a.name`, `a.badge`, `a.status`, `a.role`). Tab agent memakai interpolasi `name` pada `innerHTML` di `:3711-3718`. Data agent dapat disimpan lewat action `save-agent` (`api/index.php:100-107`) dan dikembalikan oleh endpoint daftar agent. Endpoint tersebut hanya meminta sesi valid, tanpa role khusus.

**Dampak:** nama/role crafted dapat menjalankan JavaScript pada browser pengguna lain yang membuka roster. Token bearer disimpan di `localStorage` (`web/login.html` dan `web/app.js`), sehingga dapat dicuri. Pada desktop, dampaknya berpotensi meningkat ke eksekusi perintah karena `window.kraDesktop.execCommand` diekspos melalui preload.

**Perbaikan:** bangun UI dengan DOM API dan `textContent`; escape seluruh nilai dinamis bila markup tidak bisa dihindari; validasi panjang/karakter input server-side; tambahkan CSP ketat tanpa `unsafe-inline`; batasi navigasi dan IPC Electron ke origin/frame lokal tepercaya. Pertimbangkan sesi `HttpOnly`, `Secure`, `SameSite` dibanding bearer di localStorage.

### KRA-SEC-05 — High: containment file-write dapat ditembus symlink / prefix path

**Bukti:** `api/lib/KraExecutionRunner.php:25-29` memeriksa `str_starts_with(realDir, realRoot)` tanpa batas separator, sehingga path saudara dengan prefix sama dapat lolos. Pemeriksaan hanya dilakukan pada direktori target (`:25-29`), lalu `file_put_contents(targetPath, ...)` mengikuti symlink file tujuan (`:62`); file symlink dapat menunjuk ke luar project root.

**Dampak:** setelah task disetujui, runner dapat menulis ke lokasi di luar root yang dimaksud. Ini merusak jaminan “project-contained”; manipulasi target/proposal dapat mengubah file sensitif yang dapat ditulis oleh akun webserver. Backup juga dapat menjadi tidak andal.

**Perbaikan:** resolusi canonical path dan pemeriksaan boundary dengan `realRoot . DIRECTORY_SEPARATOR`; tolak symlink untuk seluruh komponen dan target, atau gunakan operasi filesystem yang aman terhadap symlink/TOCTOU; validasi ulang sesaat sebelum write; gunakan root kerja dengan permission terbatas. Buat tes eksplisit untuk sibling-prefix, symlink directory, symlink file, `..`, dan race.

### KRA-SEC-06 — High: SSRF guard tidak mencakup rentang privat, DNS, dan redirect

**Bukti:** `api/lib/KraWebSearchBridge.php:54-63` hanya memblokir hostname `localhost`, prefix `127.`, `192.168.`, dan `10.`. Tidak ada penolakan menyeluruh terhadap IPv6, rentang private/link-local lain (termasuk `172.16/12`), nama DNS yang resolve ke IP internal, atau IP alternatif/encoded. Request mengikuti redirect hingga tiga kali (`:164-175`) tanpa memeriksa ulang target redirect.

**Dampak:** fitur fetch yang dipanggil agent dapat digunakan untuk mengakses layanan internal/metadata melalui host yang lolos pemeriksaan, DNS rebinding, atau redirect. Dampak tergantung jaringan host yang menjalankan KRA.

**Perbaikan:** resolve host sebelum koneksi dan tolak seluruh alamat non-global (IPv4 dan IPv6); pin alamat hasil DNS ke koneksi; validasi ulang setiap redirect; larang userinfo/port/skema yang tidak perlu; batasi egress lewat firewall/proxy, dan tes kasus private IP + redirect.

### KRA-OPS-01 — Medium: 49 checksum skill berbeda dari lockfile

**Bukti pengukuran:** pembandingan SHA-256 byte-level setiap `resources/skills/*/SKILL.md` terhadap `resources/skills/SKILLS_LOCK.json` menemukan 49 mismatch dari 105. ID terdampak: `animate-text`, `better-design`, `brutalist-industrial`, `capabilities`, `cinematic-motion`, `corporate-trust`, `dark-tech`, `design-taste`, `editorial-minimal`, `frontend-design`, `japanese-minimal`, `last30Days`, `last7Days`, `lastMonth`, `lastQuarter`, `lastWeek`, `lastYear`, `md-audit`, `md-fetch-summarize`, `md-hive-sync`, `neo-brutalism`, `openviking-memory`, `openviking-skills`, `ov-experience-memory`, `playful-color`, `quiet-luxury`, `retro-print`, `superdesign`, `taste-accessibility`, `taste-brand-identity`, `taste-code-craft`, `taste-code-review`, `taste-color`, `taste-design-review`, `taste-design-system`, `taste-gsap`, `taste-landing-page`, `taste-motion`, `taste-typography`, `taste-ux-copy`, `taste-web-performance`, `temporal`, `thisMonth`, `thisQuarter`, `thisWeek`, `thisYear`, `today`, `whats-new`, `yesterday`.

`KraSkillLock::isApproved()` memeriksa SHA-256 live (`api/lib/KraSkillLock.php:52-83`); isi berbeda akan dianggap tidak approved meskipun metadata lock menyatakan approved. `verify()` juga dirancang untuk gagal pada checksum drift.

**Dampak:** skill yang berubah tidak akan diaktifkan oleh runtime yang patuh lock; evaluasi CI/gate harus gagal. Kondisi ini membuat katalog dan asumsi skill governance tidak sinkron.

**Perbaikan:** review diff setiap skill, lalu bangun ulang lock dengan `php tools/skills-lock.php build`; lakukan approval ulang secara eksplisit untuk konten yang memang disetujui. Jangan jalankan `approve --all` sebelum perubahan ditinjau. Jalankan `php tools/skills-lock.php verify` dan `php tools/skills-gate.php` setelah sinkronisasi.

### KRA-MED-01 — Medium: otorisasi hanya “login atau tidak”, role tidak ditegakkan

`requireUser()` pada `api/index.php` mengamankan semua action selain status/login/register/auth-status, tetapi tidak melihat role sebelum aksi seperti `approve`, `undo`, `skill-toggle`, `save-agent`, `terminal-run`, dan `vault-sync`. `KraAuth::getUserRole()` tidak dipakai sebagai policy check. Semua user terautentikasi dapat melakukan operasi dengan dampak lintas-user/sistem, sementara UI menampilkan identitas/role bukan kontrol server-side.

**Perbaikan:** definisikan capability per action dan objek; minimal pisahkan read-only, operator, dan supervisor; terapkan di backend dan uji akses ditolak, bukan hanya menyembunyikan kontrol UI.

### KRA-MED-02 — Medium: audit API menerima path di luar root bila prefix cocok

`api/index.php:555-566` membatasi target dengan `str_starts_with(real, projectRoot)` tanpa separator. Path saudara seperti `/.../kra-copy` dapat dianggap berada di `/.../kra`. Endpoint audit lalu memindai direktori tersebut. Temuan ini memberi pembacaan metadata/struktur melalui laporan audit, bukan konten file langsung.

**Perbaikan:** canonicalize dan bandingkan prefix root yang diakhiri separator; tolak symlink dan gunakan helper containment yang sama dengan seluruh fitur filesystem.

### KRA-MED-03 — Medium: direktori dapat di-browse tanpa pembatas root

`KraProjectPath::browse()` menerima path dari query dan membuka direktori yang diberikan (`api/lib/KraProjectPath.php:137-180`), tanpa membatasi ke `projectsRoot`. Endpoint memulangkan nama subdirektori. Bersama kredensial KRA-SEC-02, ini memungkinkan enumerasi direktori yang dapat dibaca proses PHP.

**Perbaikan:** validasi canonical path terhadap root browsing yang diizinkan; jangan mengembalikan nama folder sistem; batasi role dan laju request.

### KRA-MED-04 — Medium: CI lemah, dapat melewatkan kegagalan, dan tak menguji branch sesi

`.github/workflows/ci.yml` hanya berjalan pada push ke `main/master` atau PR yang menargetkan branch tersebut; branch sesi `arena/...` tidak menjadi trigger push. Dua verifikasi JS dijalankan dengan `|| true`, sehingga kegagalan selalu disamarkan. CI juga belum menjalankan seluruh suite verifikasi dan tidak memanggil `skills-gate.php`.

**Perbaikan:** jalankan pada seluruh branch/PR, hapus `|| true`, gunakan PHP lint + `skills-gate` + unit/integration tests, serta job Electron/security. Pertahankan exit code yang benar.

### KRA-MED-05 — Medium: konfigurasi database default terlalu berprivilege

`api/lib/KraDb.php:connect()` memakai `root` dan password kosong sebagai fallback, mencoba membuat database dan melakukan migrasi saat request web. Ini rapuh dan memberi hak database terlalu besar bila konfigurasi deployment terlupa.

**Perbaikan:** wajibkan kredensial DB eksplisit; akun runtime hanya memiliki hak tabel yang dibutuhkan; jalankan migration terpisah saat deploy dan jangan menjalankan DDL pada request pertama.

### KRA-MED-06 — Medium: batas trust dan data sensitif deployment belum jelas

`status` publik mengungkap absolute `projectRoot` dan `memoryRoot` (`api/index.php:63-79`). API provider/terminal/vault dapat mengirim prompt, file, atau catatan ke provider/host eksternal; dokumentasi belum menjadi kontrol teknis. Login tidak memiliki rate limit yang tampak pada source yang ditinjau. Token disimpan di `localStorage`, dan endpoint menerima auth cookie sebagai alternatif tanpa perlindungan CSRF terpisah.

**Perbaikan:** minimalkan status publik, dokumentasikan dan tampilkan persetujuan egress, tambahkan rate limiting/audit log, serta tetapkan model sesi dan CSRF yang konsisten.

## Kualitas, arsitektur, dan pemeliharaan

- PHP API monolitik dengan routing berbasis `action`, banyak `require_once`, dan file-backed fallback; schema DB dimigrasikan on-demand. Pemisahan domain ada di class `Kra*`, tetapi boundary authorization, validasi request, dan error handling belum konsisten.
- Ada dua jalur file task (MySQL dan `.temp/*.json`) yang dapat menimbulkan perbedaan perilaku/status saat DB aktif sebagian atau gagal.
- Desktop wrapper memiliki profil Electron yang baik pada `contextIsolation: true` dan `nodeIntegration: false`, tetapi manfaatnya dilemahkan oleh IPC shell generik dan tidak adanya pembatasan navigasi/origin.
- Frontend mengizinkan `unsafe-inline` pada CSP halaman utama, dan halaman login tidak memiliki CSP setara. Ini memperburuk dampak injection.
- `KraAudit` sendiri adalah pemeriksa heuristik, bukan security scanner penuh: ia tidak menganalisis semua bahasa/asset pihak ketiga (`resources` dikecualikan dari analisis konten), tidak mengecek kontrol auth/SSRF/path containment, dan pola secret dapat menghasilkan false positive/negative. Jangan gunakan verdictnya sebagai bukti aman.
- `package.json` hanya mendefinisikan Electron sebagai devDependency; tidak terlihat pipeline packaging/release formal pada workflow yang ditinjau. README menjelaskan path lokal Windows/vault eksternal, sehingga konfigurasi dan pengalaman non-Windows belum diverifikasi.

## Pemeriksaan yang dijalankan

| Pemeriksaan | Hasil |
|---|---|
| JavaScript parse (`node --check` untuk seluruh `.js/.mjs/.cjs`) | Lulus; tidak ditemukan syntax error |
| `node tools/verify-kra-lighting-engine.js` | Lulus |
| `node tools/verify-kra-asset-registry.js` | Lulus |
| Node tests `skills/caveman-explore` dan `skills/caveman-learn` | 10 lulus, 0 gagal |
| JSON parse untuk file `.json` dalam checkout | Semua valid |
| Custom byte-level SHA-256 skill vs lock | 49 mismatch / 105 |
| `python unittest discover` pada folder caveman-compress | Menemukan 0 tests; bukan bukti suite Python lulus |
| PHP lint, PHP unit/verification suites, API/runtime tests | **Tidak dijalankan**: `php: command not found` |
| Browser/Electron, MySQL, SIAS auth, provider, SSRF live tests | Tidak dijalankan; memerlukan runtime/deployment lokal dan konfigurasi eksternal |

## Urutan remediasi yang disarankan

1. **Containment segera:** jangan expose server ke LAN/Internet; cabut/rotasi provider keys; hapus dan cabut pairing key bawaan; nonaktifkan terminal API dan Electron IPC generic shell.
2. **Keamanan credential/API:** redaksi API key pada action providers, stop default-user seeding, rate-limit login, role policy backend, audit event.
3. **Perbaiki jalur eskalasi:** hilangkan stored XSS; kunci IPC Electron; perkuat containment filesystem terhadap symlink dan canonical path.
4. **Perbaiki SSRF dan batas filesystem:** DNS/IP classification + redirect validation; root-browse dan audit target containment.
5. **Pulihkan governance/tests:** review 49 skill drift, rebuild/approve lock secara selektif, kemudian jalankan suite PHP penuh dan CI fail-closed.
6. **Hardening deployment:** DB least privilege, TLS/host binding, CSP non-inline, log/retention, egress controls, backup dan prosedur pemulihan.

## Kesimpulan

KRA memiliki beberapa fondasi positif—Electron mengaktifkan context isolation, SQL umumnya menggunakan prepared statements, penulisan task punya approval flow, dan aset/engine frontend memiliki smoke verification. Namun temuan secret disclosure dan autentikasi default diketahui cukup untuk menyatakan **belum aman dipasang sebagai layanan yang dapat diakses pihak lain**. Jalankan ulang audit setelah perbaikan, terutama dengan PHP 8.2+, MySQL, Electron, dan konfigurasi deployment nyata.
