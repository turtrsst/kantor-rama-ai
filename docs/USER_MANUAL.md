# Manual Pengguna KRA

## 1. Tujuan

Kantor-Rama-AI (KRA) adalah harness multi-agent berbasis LLM untuk membantu pekerjaan software engineering di workspace proyek. Pengguna dapat berdialog dengan agen, meminta proposal perubahan kode, meninjau lalu menyetujui atau menolak eksekusi, menjalankan audit dan terminal, mencari memori Obsidian, serta merender komposisi video Remotion.

KRA bukan editor IDE penuh seperti Cursor: agen mengusulkan perubahan melalui task/proposal dan approval gate. Jangan menganggap semua template/integrasi tersedia sebagai tombol di UI. Tool GitHub dan web saat ini dipanggil melalui ReAct agent jika API runtime aktif.

## 2. Agen Utama

| Agen | Kegunaan |
| --- | --- |
| Rama | Koordinasi, review, pengawasan approval |
| Budi | Membuat scaffold, modul, test, dan dokumentasi |
| Maya | Memperbaiki bug dan mengubah kode secara terarah |
| Dimas | Audit keamanan dan hygiene |
| Siti | Operasi runtime, terminal, dan GitHub Actions |
| Agen spesialis | Agen hired dari template, misalnya Research Analyst, DevOps, dan Video and Motion Producer |

Katalog template belum menjamin runtime eksternal sudah terpasang atau kredensial tersedia. Cek provider/runtime sebelum tugas penting.

## 3. Prasyarat Server

- Windows Server dengan Apache/XAMPP atau web server yang dapat melayani folder proyek.
- PHP 8.4.x CLI/server (`C:\php84\php.exe` pada launcher Windows); aktifkan `pdo_mysql`, `curl`, `json`, dan `mbstring` di `php.ini`.
- MySQL/MariaDB berjalan. API menyiapkan database `kra_db`; SIAS login juga perlu database SIAS yang benar.
- Node.js 18+ dan npm. Remotion berada di `remotion/` dan perlu dependency lokal terpasang.
- Provider LLM aktif melalui `api/config.json` dan environment key yang sesuai, atau Ollama/9Router tersedia.
- Vault Obsidian harus ada dan dapat ditulis oleh akun server. Pilih foldernya lewat **Settings → Obsidian Vault Folder**; pilihan tersimpan di konfigurasi lokal server dan digunakan oleh Save Memory, recall, meeting notes, dan laporan. `KRA_MEMORY_ROOT` tetap menjadi fallback. Pemilihan folder tidak memindahkan catatan lama.
- Project path harus dapat dilayani Apache. Jika sumber berada di UNC seperti `\\100.76.172.67\c$\xampp\htdocs\kantor-rama-ai`, Apache di mesin lain mungkin tidak dapat membaca UNC. Gunakan Apache pada server pemilik folder atau mapping lokal yang disetujui admin.

Jangan memasukkan token GitHub atau API key ke dokumen, chat, atau `api/config.json` yang masuk Git. Simpan sebagai environment variable server.

## 4. Konfigurasi Integrasi

### LLM

Periksa `api/config.json`. Pilih `defaultProvider` yang benar dan pastikan provider yang dipakai reachable. API key harus tersedia pada environment variable sesuai `apiKeyEnv` di konfigurasi. Di UI, `/providers` menampilkan status provider dan `/model` menampilkan model yang terdeteksi dari 9Router.

### SIAS Login

Login menggunakan akun pada database SIAS, tabel `users`. Identitas dapat berupa username, email, atau NIP. Status yang dapat masuk adalah `aktif`, `active`, `approved`, atau `disetujui`; status penolakan atau nilai `rejected_at` selalu memblokir login. SIAS harus menyimpan password sebagai hash yang didukung `password_verify` (bcrypt/Argon2); KRA tidak menerima password teks biasa dan tidak menggunakan `temp_password` sebagai fallback.

Koneksi SIAS memakai `KRA_SIAS_DB` (default `sias2025`). Secara default host/user/password memakai konfigurasi `KRA_DB_HOST`, `KRA_DB_USER`, dan `KRA_DB_PASS`. Jika akun MySQL SIAS terpisah, atur `KRA_SIAS_DB_HOST`, `KRA_SIAS_DB_USER`, dan `KRA_SIAS_DB_PASS` di environment server. Database KRA (`kra_db`) tetap diperlukan untuk menerbitkan token sesi dan menyimpan ruang kerja. Jangan menaruh kredensial database di HTML atau JavaScript.

Registrasi KRA dinonaktifkan. Gunakan registrasi SIAS resmi. Tidak ada lagi akun atau token pairing bawaan. Token sesi disimpan di `sessionStorage`: bertahan saat reload pada tab yang sama, lalu hilang ketika tab/sesi browser ditutup.

### GitHub Actions

Set environment variable server:

- `KRA_GITHUB_REPO=owner/repository` untuk target repo.
- `GITHUB_TOKEN` atau `GH_TOKEN` dengan scope minimum yang dibutuhkan: baca Actions untuk status, dan tulis Actions untuk dispatch.

Workflow harus sudah ada di repo GitHub, mendukung `workflow_dispatch`, dan branch/ref harus valid. Repo default kode saat ini `turtrsst/kantor-rama-ai` bila env repo tidak diatur.

### Remotion

Di server CMD:

```cmd
cd C:\xampp\htdocs\kantor-rama-ai\remotion
npm install --no-audit --no-fund
npx remotion --version
```

Jika npm melaporkan install scripts `esbuild` diblokir dan bundling gagal, ikuti kebijakan keamanan npm server untuk meninjau lalu mengizinkan script paket yang diperlukan. Jangan menjalankan `npm audit fix --force` tanpa review karena dapat mengganti versi dependency.

## 5. Login dan Membuka Aplikasi

1. Pastikan Apache dan MySQL berjalan, provider LLM aktif, dan project tersedia lewat document root.
2. Buka URL KRA yang dikonfigurasi admin, kemudian halaman `web/login.html`.
3. Masukkan username, email, atau NIP SIAS dan password akun SIAS aktif.
4. Setelah login berhasil, KRA menyimpan session token di browser dan membuka virtual office.
5. Bila login gagal, periksa database SIAS, nilai `KRA_SIAS_DB`, status akun, koneksi `kra_db`, dan log PHP. Bila halaman/API `404`, periksa konfigurasi Apache alias/document root sebelum memeriksa password.
6. API publik `status` dapat dipakai untuk memeriksa `projectExists` dan `memoryExists`. Endpoint lain memerlukan Bearer session valid.

Jangan membagikan screenshot yang menampilkan token, password, secret, atau data pribadi.

## 6. Orientasi UI

- Pilih channel `Team` atau tab agen untuk percakapan.
- Tab `Terminal` menerima slash command; teks biasa dikirim langsung ke Rama dan tetap tampil sebagai percakapan di Terminal, tidak dialihkan ke channel lain atau dieksekusi sebagai shell.
- Gunakan `/help` untuk daftar command yang aktif pada versi terpasang.
- Tombol **Workspace** membuka file tree dan preview teks read-only untuk project yang sudah ditautkan ke task atau dipilih lewat OPEN FOLDER. Pilih file lalu **ASK MAYA TO CHANGE** untuk menyiapkan proposal; file tidak diedit langsung. Permintaan edit dari chat juga mensyaratkan project workspace terpilih—tanpa itu Maya meminta project dipilih dan tidak membuka file.
- `Task Board` menampilkan proposal menunggu approval, task selesai, dan task gagal. Approval Gate membandingkan isi lama dan usulan dengan diff sebelum eksekusi.
- Chat/ReAct memperlihatkan action, observation, handoff, penggunaan budget, dan indikator thinking beranimasi. Tombol lampiran di composer menerima gambar PNG/JPEG/WebP, PDF, serta file teks; PDF dibaca lokal di browser lalu teks sumber disertakan ke prompt; PDF scan tanpa text layer mengirim maksimal dua halaman pertama sebagai gambar (tanpa OCR). Gambar membutuhkan model/provider vision yang kompatibel. Maksimal 5 lampiran, 12 MB per file; tidak ada file lampiran yang disimpan di server. Di bar Chat, pilih provider live `9Router` atau `Ollama`; provider eksternal meminta persetujuan sebelum pesan, lampiran, dan konteks chat dikirim. Provider live tidak akan diam-diam diganti simulator.
- Di tab Terminal, ketik pesan biasa untuk berbicara ke percakapan terakhir; command OS tetap memerlukan `/run` eksplisit dan konfirmasi. Lampiran juga ikut pada pesan biasa dari tab Terminal.
- Channel Team berfungsi seperti group chat: pesan umum dibagikan ke semua officer, balasan model masuk satu per satu secara streaming, dan konteks percakapan terakhir serta balasan officer sebelumnya pada giliran itu disertakan. Balasan memakai LLM/persona tiap agen; jika semua provider gagal, KRA menampilkan kegagalan dan action untuk mencoba provider lain, bukan jawaban simulator/template.

Fitur gerak/ruang kantor adalah visualisasi status agen; status animasi tidak menjadi sumber kebenaran task. Periksa respons API dan Task Board untuk keadaan aktual. Asset atlas/sprite dimuat dengan single-flight cache dan CacheStorage agar request duplikat dihindari dan dapat dipakai lagi setelah reload; bila asset diubah, bump versi di `web/kra_asset_cache.js` dan query versi CSS.

## 7. Percobaan Pertama: Proposal Kode dengan Approval

1. Pilih terminal, lalu jalankan `/help` untuk memastikan command tersedia.
2. Jalankan `/create modul contoh untuk menghitung total belanja`.
3. Budi meminta model menghasilkan isi proposal. Periksa nama target, ringkasan, dan seluruh konten di Approval Gate.
4. Tekan **Reject** untuk latihan aman. Pastikan UI menyatakan tidak ada file berubah.
5. Ulangi dengan `/create modul contoh untuk menghitung total belanja` bila ingin menguji approval. Periksa lagi konten, target, dan summary sebelum menekan **Approve**.
6. Buka `/tasks` dan cek status serta hasil eksekusi. Gunakan Undo jika task dan task engine mendukung pemulihan untuk perubahan tersebut.

Untuk perubahan file yang sudah ada, gunakan `/modify <perubahan dan target file>`. Sertakan path relatif yang jelas. Review diff/proposal sebelum approval.

## 8. Percobaan ReAct dan Kolaborasi Agen

Chat Team, tab privat, dan Terminal memakai provider live yang dipilih; jika provider tidak tersedia, KRA menampilkan error dan tidak mengganti jawabannya dengan template simulator. Pesan biasa di Terminal tetap dijawab Rama di Terminal (teks biasa tidak dijalankan sebagai shell). Pertanyaan real-time seperti cuaca/berita memicu ReAct + web search; sebutkan kota untuk hasil yang relevan. ReAct juga bisa diaktifkan untuk tab privat. Team tetap menjadi group chat; pilih tab agen untuk percakapan pribadi. Contoh konfigurasi baru memakai Ollama lokal sebagai provider default; 9Router tetap dapat dipilih dari bar Chat bila tersedia dan sudah dikonfigurasi.

Contoh prompt:

- Maya: `Baca api/lib/KraTaskEngine.php, jelaskan risiko perubahan status task. Jangan ubah file.`
- Dimas: `Audit api/lib/KraWebSearchBridge.php untuk risiko SSRF. Laporkan temuan saja.`
- Budi: `Buat rencana test unit untuk KraGitHubBridge. Jangan jalankan dispatch.`
- Siti: `Periksa status runtime dan workflow CI. Jangan dispatch workflow.`

ReAct memberi agen tool sesuai role. Tool yang tidak diizinkan harus gagal dengan role boundary. Untuk tindakan yang mengubah file, agen harus membuat proposal dan menunggu approval.

Content Creator menyediakan empat specialist bawaan: Nara (research), Aruna (script/metadata), Dito (production planning), dan Lintang (quality review). Tekan **CHAT** di kartu mereka untuk membuka Studio Terminal khusus tanpa keluar ke Virtual Office. Tab **Studio Crew** mengirim satu pesan ke empat specialist; mereka menerima konteks balasan sebelumnya dan menanggapi bergantian. Tab agent mengirim pesan langsung ke satu specialist. Channel dan riwayat Studio terpisah dari Office, dan provider dapat dipilih di panel yang sama; tidak perlu berpindah mode atau hire manual. Aktivitas 3D mereka adalah simulasi ambient, sedangkan pekerjaan AI baru berjalan saat Anda mengirim prompt/menjalankan workflow.

## 9. Terminal, Audit, dan Memory

Command aplikasi dapat dilihat lewat `/help`. `/create-app <deskripsi>` atau permintaan natural seperti `Buatkan aplikasi web keuangan` memulai alur yang sama: pilih folder di luar proyek KRA, lalu KRA meminta model live membuat proposal file entry awal (`index.php`). Satu kali approval hanya menulis satu file dan tidak otomatis menjalankan server atau membuat perubahan susulan. Setelah file app berhasil dibuat, klik tombol **CONTINUE APP** di terminal atau pada task Completed di Task Board. Form akan meminta path relatif file baru dan deskripsi perubahan; setiap proposal tetap menunggu approval tersendiri sebelum ditulis. Task Board otomatis memilih Pending jika masih ada, jika tidak Completed/Blocked yang tersedia. Untuk menjalankan proses developer secara eksplisit gunakan `/run <command>`, misalnya `/run php -v` atau `/run git status`. KRA meminta konfirmasi manusia, hanya menerima executable allowlist (`php`, `node`, `npm`, `npx`, `git`, `python`, `python3`, `composer`), menolak shell operators/eval/encoded command, membatasi output dan timeout, serta hanya membuka endpoint ini dari loopback untuk role supervisor/admin. Perintah proyek tetap dapat menjalankan script lokal, jadi baca perintah dan konfirmasi dengan sadar. Jangan gunakan terminal untuk menjalankan input dari sumber tidak tepercaya.

- `/audit` menjalankan perilaku UI audit yang saat ini ditampilkan oleh aplikasi; untuk audit workspace nyata gunakan `/rama review` atau jalankan `php tools/audit-cli.php` dari CMD server.
- Atur vault melalui **Settings → Obsidian Vault Folder**. Pilih folder pada server dengan browser folder KRA atau native picker desktop. Folder harus sudah ada dan dapat ditulis oleh user Apache/PHP; perubahan berlaku untuk operasi memory berikutnya dan tidak memindahkan catatan lama.
- `/save` atau `/sync` menyinkronkan catatan sesi ke vault yang dipilih.
- `/recall <kata kunci>` mencari laporan sebelumnya di vault yang dipilih.
- `/providers` memeriksa provider LLM.
- `/tasks` membuka approval queue.

## 10. Percobaan Web Research

Web research dipanggil sebagai ReAct tool, bukan command UI mandiri:

1. Aktifkan ReAct mode dan pilih agent yang diizinkan (Rama/Maya atau Nara, specialist Research Creator bawaan).
2. Kirim prompt, misalnya: `Cari dokumentasi resmi PHP tentang password_verify, buka sumber resmi, rangkum perilaku dan sertakan URL.`
3. Periksa trace: `web_search` harus menghasilkan sumber/URL; `web_fetch` harus membuka URL; jawaban akhir harus menyertakan sumber.
4. Jika hasil kosong/ditolak, periksa akses internet outbound dari PHP, TLS/cURL, dan respons DuckDuckGo. Jangan anggap template Research Analyst sendiri membuktikan pencarian bekerja.

Web bridge membatasi ukuran fetch dan memblokir beberapa alamat privat. Validasi SSRF belum mencakup semua variasi IP/DNS/rebinding; jangan gunakan tool ini untuk mengakses alamat jaringan internal sebelum pengamanan diperkuat.

## 11. Percobaan GitHub Actions

1. Pastikan `KRA_GITHUB_REPO` dan token server sudah diset. Jangan tempel token ke prompt.
2. Pastikan workflow target tersedia dan trigger `workflow_dispatch` aktif.
3. Pilih ReAct agent berizin, lalu minta: `Gunakan gh_runs untuk melihat 3 run CI terakhir di ci.yml. Jangan dispatch.`
4. Cocokkan hasil dengan halaman Actions di GitHub.
5. Dispatch hanya setelah review eksplisit: `Jalankan workflow ci.yml pada branch main dengan input ...`. Dispatch mengubah state repo dan dapat memakai runner/kuota.
6. Bila mendapat 401/403/404, cek token permission, repo target, nama workflow, ref, serta apakah GitHub Actions tersedia untuk repo.

Hindari menguji dispatch pada workflow deploy atau workflow yang mengubah production. Gunakan workflow CI yang aman.

## 12. Percobaan Remotion

Pada server melalui CMD:

```cmd
cd C:\xampp\htdocs\kantor-rama-ai\remotion
npx remotion render src/index.ts PromoClip C:\xampp\htdocs\kantor-rama-ai\assets\renders\video\kra-demo.mp4 --frames=0-29
```

Hasil tersimpan di `assets/renders/video/kra-demo.mp4`. Smoke test yang pernah dijalankan menghasilkan MP4 128,953 byte untuk 30 frame. Untuk mengulang smoke test lengkap, jalankan:

```cmd
node C:\xampp\htdocs\kantor-rama-ai\tools\smoke-test-runtime.js
```

Tool ReAct `remotion_render` memakai bridge PHP dan harus diuji melalui API di server. Pastikan PHP CLI, Node/npm, Remotion browser, project path, dan timeout berjalan pada akun service Apache yang sama. Keberhasilan render manual di CMD tidak otomatis membuktikan render dari PHP/Apache berhasil.

## 13. Pemeriksaan Pasca-Install

Dari CMD di root project:

```cmd
C:\php84\php.exe tools\audit-cli.php
C:\php84\php.exe tools\verify-phase9.php
C:\php84\php.exe tools\verify-phase8b.php
node tools\verify-runtime-capabilities.js
node tools\smoke-test-runtime.js
```

Beberapa test menyentuh database dan workspace. Baca script sebelum menjalankan di production, terutama test yang membuat atau menghapus fixture.

## 14. Troubleshooting

| Gejala | Periksa |
| --- | --- |
| Login kembali ke login page | `auth-status`, token Bearer, SIAS DB, status akun, dan koneksi `kra_db` |
| API `404` | Apache document root/alias; path UNC tidak selalu didukung service Apache |
| Chat tidak menjawab | `api/config.json`, provider health, API key env, log PHP, dan koneksi outbound |
| ReAct `401` | Session token tidak ada atau tidak valid; login ulang |
| Remotion tidak menemukan `renderEntry.js` | Instalasi paket tidak utuh; periksa `npm ls @remotion/studio remotion @remotion/cli`, lalu perbaiki dari direktori lokal server |
| Remotion gagal bundling esbuild | Periksa npm `allowScripts`; izinkan hanya dependency yang sudah direview, lalu jalankan ulang render |
| Render PHP gagal padahal CMD berhasil | Akun Apache PATH/CWD berbeda; pastikan `npx.cmd` dan dependency dapat diakses service, cek timeout dan PHP `proc_open` |
| GitHub 401/403 | Token tidak ada/izin kurang; jangan tulis token ke log |
| Search kosong | Cek outbound internet, TLS, DuckDuckGo markup/rate limit; search scraping dapat berubah sewaktu-waktu |
| Memory offline | Periksa `KRA_MEMORY_ROOT`, izin baca/tulis vault, dan lokasi Dashboard |

## 15. Batasan dan Status Validasi

- **Terbukti dari sesi uji:** `node tools/verify-runtime-capabilities.js` lulus pemeriksaan struktur/wiring; render Remotion manual di CMD server berhasil membuat MP4 30 frame.
- **Belum terbukti end-to-end pada manual ini:** login SIAS pada server aktif setelah konfigurasi Apache; ReAct PHP tool-call langsung ke GitHub; dispatch workflow live; web search/fetch dari PHP runtime; `remotion_render` lewat Apache/ReAct.
- GitHub dan Web Research punya dependensi jaringan, konfigurasi, token/permission, dan perubahan API/HTML upstream.
- Semantic memory KRA memiliki recall lokal berbasis lexical/hash; jangan menyebutnya vector database embedding tanpa implementasi terpisah.
- Persetujuan pengguna tetap wajib sebelum perubahan file dan dispatch yang mengubah repo.
