# Audit KRA: Chat, Terminal, dan Creator Studio

**Tanggal:** 2026-10-30
**Cakupan:** pertanyaan audit KRA tentang Team chat, Terminal, pertanyaan cuaca/current information, permintaan membuat aplikasi, chat tab lain, dan alur Creator Studio/sub-agent.

## Ringkasan

Perilaku alur yang diminta telah diperiksa melalui source review dan test otomatis terfokus. Pesan natural di Terminal sekarang diarahkan ke chat live Rama dan tetap berada di Terminal; tidak diperlakukan sebagai shell command dan tidak memindahkan pengguna ke tab lain. Permintaan aplikasi dalam bahasa natural berbagi gerbang pemilihan folder dan persetujuan dengan `/create-app`. Creator Studio menyiapkan empat specialist bawaan yang dapat dibuka lewat tombol CHAT; tidak perlu hire manual atau memakai Terminal untuk berbicara dengan mereka.

**Belum terbukti lewat server/provider live:** tidak tersedia konfigurasi provider lokal (`api/config.json`) atau credential provider di lingkungan audit. Karena itu audit ini tidak menyatakan bahwa Ollama/9Router berhasil menjawab chat, pencarian cuaca berhasil, atau generator aplikasi menghasilkan file pada runtime nyata.

## Hasil audit alur

| Pertanyaan | Hasil pemeriksaan | Batasan |
| --- | --- | --- |
| Team group chat benar-benar memakai model? | Implementasi mengirim pesan ke provider dan persona officer; simulator dinonaktifkan untuk jawaban chat. Jika provider gagal, alur menghasilkan error, bukan jawaban canned/template. | Uji provider nyata memerlukan konfigurasi dan kredensial di server. |
| Terminal dapat menjawab bahasa natural/current info? | Teks biasa tetap di Terminal dan dikirim sebagai chat Rama; pertanyaan cuaca/berita dikenali untuk alur ReAct dan tool web search. `/run` tetap jalur command OS eksplisit yang memerlukan konfirmasi. | Belum menjalankan pertanyaan cuaca live; akses web tergantung koneksi, TLS/cURL dan layanan pencarian pada server. |
| Terminal mendukung permintaan app natural-language dan `/create-app`? | Keduanya masuk ke gerbang pemilihan folder proyek serta proposal berbantuan model dan approval. Penulisan tidak terjadi sebelum approval. | Belum menguji model live atau membuat file app sungguhan pada server terpasang. |
| Tab chat lain serupa? | Channel Team dan tab privat berbagi provider chat; masing-masing memakai identitas/persona dan izin tool yang sesuai. | Kemampuan ReAct/tool berbeda sesuai agent; bukan semua tab memiliki izin yang sama. |
| Creator Studio perlu terminal untuk sub-agent? | Tidak. Kartu specialist membuka chat privat masing-masing secara langsung. | Tidak ada klaim bahwa animasi ambient berarti pekerjaan AI sedang berjalan. |
| Apakah ada sub-agent bawaan? | Ya: Nara — Content Research Analyst; Aruna — Scriptwriter & Metadata Editor; Dito — Creative Production Planner; Lintang — Quality & Publishing Reviewer. Roster/backend personas diverifikasi. | Pekerjaan AI berjalan ketika pengguna mengirim prompt atau memulai workflow; model/provider tetap diperlukan. |

Contoh konfigurasi baru kini memilih Ollama lokal sebagai default dan tidak menyetel simulator sebagai fallback chat. 9Router tetap dapat dipilih/dikonfigurasi. Ini perubahan pada `api/config.example.json`; konfigurasi lokal yang sudah ada tidak otomatis diubah.

## Audit workspace dan credential patterns

KRA audit memindai **2.547 file** menurut cakupan scanner saat ini (direktori seperti `.git`, `node_modules`, `vendor`, `dist`, dan `build` dikecualikan; `resources` diinventarisasi tetapi tidak diperiksa untuk style/secret). Setelah memperbaiki deteksi credential yang sebelumnya salah menganggap pembacaan variabel `apiKey`/`token` dan placeholder sebagai secret:

- **0** possible-secret findings.
- **382** temuan baris lebih dari 160 karakter.
- **2** marker debt (`TODO` dan `XXX`).
- **384** temuan total, semuanya Low; verdict scanner adalah **NEEDS REVISION** karena scanner menganggap temuan Low apa pun sebagai revisi.
- Tidak ditemukan temuan Medium pada scan akhir.

Temuan secret awal yang menghasilkan verdict REJECTED / HALTED telah diklasifikasikan sebagai false positive berbasis pola, bukan credential aktif: pembacaan/assignment variabel, `getenv`, identifier placeholder di dokumentasi, dan data dummy di test. Detector diperketat dan diuji dengan fixture sintetis: placeholder dan token yang dibuat runtime tidak dihitung, sedangkan pola credential fixture terdeteksi. Ini bukan jaminan bahwa secret tak dikenal tidak ada; sebelum deploy tetap periksa konfigurasi lokal/secret store dan jangan commit credential.

## Verifikasi yang dijalankan

Lulus:

- `npm run verify:chat-modes`
- `npm run verify:colony`
- `npm run verify:vault-settings`
- `npx --yes @php-wasm/cli tools/test-chat-live-provider.php`
- `npx --yes @php-wasm/cli tools/test-creator-workflow.php`
- `npx --yes @php-wasm/cli tools/test-audit-secrets.php`
- `npx --yes @php-wasm/cli tools/test-terminal-bridge.php` — seluruh tes penolakan shell/inline-code lulus. Subtes menjalankan `php --version` dilewati karena executable PHP tidak terpasang di runtime PHP-WASM; ini bukan bukti process launch berhasil pada host deployment.
- PHP-WASM lint untuk `api/index.php`, `api/ProviderConfig.php`, `KraAgentChat.php`, `KraReActEngine.php`, `KraVaultSettings.php`, `KraVaultSync.php`, dan `KraAudit.php`.
- Pemeriksaan backend memastikan empat persona Creator memiliki informasi agent dan role yang sesuai.
- `node --check web/app.js`, `node --check tools/verify-chat-modes.js`, dan `git diff --check`.

PHP-WASM mengeluarkan deprecation notice di `api/lib/KraRouterGateway.php:159` terkait `$http_response_header`; test terkait tetap lulus. Syntax check Node akhir dan `git diff --check` telah lulus.

## Tindak lanjut sebelum verifikasi runtime

1. Salin/atur konfigurasi provider pada server; untuk 9Router gunakan environment variable server-side. Jangan menaruh key di frontend atau commit `api/config.json`.
2. Putar/rotasi key yang pernah ditempel ke percakapan sebelum dipakai di deployment.
3. Uji chat biasa, pertanyaan cuaca dengan kota spesifik, `/create-app`, dan chat masing-masing specialist pada server dengan provider aktif; verifikasi trace/tool dan approval secara langsung.
4. Jalankan test terminal-bridge serta pemeriksaan syntax/diff akhir. Tinjau 382 temuan long-line sebagai debt readability terpisah; temuan tersebut tidak disamakan dengan kerentanan credential.
