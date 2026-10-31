# Audit terminal, latency, editing, dan Python KRA — 2026-10-31

## Ringkasan

KRA memiliki beberapa alur yang terlihat seperti “terminal”, tetapi tidak semuanya menjalankan cara kerja yang sama. Penyebab keterlambatan paling besar yang ditemukan adalah pemeriksaan status provider saat bootstrap, batas tunggu provider yang terlalu panjang, request fallback berantai, provider Anthropic/Gemini yang sebelumnya diarahkan ke endpoint OpenAI-compatible, dan fan-out Team/Studio Crew yang memang berjalan satu per satu.

Perbaikan dalam audit ini menghilangkan probe seluruh provider dari endpoint runtime, memberi batas connect/request/fallback, memakai skema API native untuk Anthropic dan Gemini, dan mengirim progress serta durasi chat secara live. Output token per token belum di-stream; progres aktivitas tersedia, tetapi jawaban model tetap datang setelah satu request provider selesai.

## Peta alur terminal

| Permukaan | Implementasi | Faktor waktu utama | Kondisi / perbaikan |
|---|---|---|---|
| Office **Terminal** tab | Teks biasa menjadi chat Rama melalui `chat-agent`; `/run ...` menjalankan command lokal terpisah | Provider completion; untuk pesan yang diarahkan ke seluruh Team ada beberapa agent berurutan. `/run` menunggu proses selesai sebelum JSON dikirim ke UI | Progress dan waktu balasan ditampilkan. Command OS masih membutuhkan `/run` dan konfirmasi manusia. |
| Office **Team** dan channel agent | `KraAgentChat::dispatch`; pesan Team umum dapat diterima Rama, Budi, Maya, Dimas, Siti, serta hired agents | Setiap balasan menunggu completion agent sebelumnya supaya agent berikutnya dapat membaca konteksnya. Waktu total kira-kira jumlah waktu tiap balasan | Kini UI mengirim status “agent N dari M” dan durasi aktual. Pilih channel agent langsung bila ingin satu completion yang lebih cepat. |
| **Creator Studio Terminal** | Channel individual atau `creator_studio_team`; Crew mencakup Nara, Aruna, Dito, Lintang | Empat request live diserialkan untuk mempertahankan konteks balasan sebelumnya; jadi Crew biasanya lebih lambat dari satu specialist | Status agent aktif/progress dan total detik tampil. Tab specialist individual lebih cepat untuk pertanyaan yang hanya butuh satu peran. |
| **ReAct** | `KraReActEngine::runLoop`, bisa dipicu oleh mode ReAct/pertanyaan aktual atau klasifikasi tugas multi-langkah | Sampai 3–6 giliran model; setiap tool call dan handoff menambah kerja. Dulu request provider dapat menunggu sampai 90 detik per giliran | Batas total default 90 detik; tiap giliran dibatasi provider timeout. Status langkah/tool dikirim live. UI/API hanya menampilkan ringkasan aksi dan observasi, bukan teks chain-of-thought internal. |
| **AI edit/proposal** | `KraAgentChat::detectProposal`, `KraTaskEngine`, `KraExecutionRunner` | Model membaca konteks file, menyusun konten pengganti, lalu proposal menunggu review dan approval | Pilih workspace untuk edit, sebut target path (termasuk `.py`), lalu setujui proposal di Task Board. Perubahan tidak diterapkan diam-diam; runner menulis file yang sudah disetujui dan menyediakan backup/undo untuk modify. |
| **`/run` command console** | `KraTerminalBridge` menjalankan satu executable allowlist tanpa shell | UI menerima output setelah command selesai; batas default saat ini 15 detik, output maksimum 64 KB | Python tersedia sebagai executable allowlist jika terpasang di PATH akun PHP. Jalankan hanya setelah membaca dan mengonfirmasi command. |

## Penyebab lambat yang ditangani

1. `runtime` sebelumnya memeriksa semua provider satu per satu. Provider yang tidak aktif dapat menahan bootstrap sampai timeout masing-masing. Endpoint runtime sekarang hanya mengembalikan metadata `not_checked`; probe provider dipisah dan diberi batas 5 detik.
2. `KraRouterGateway` memakai PHP stream request dengan timeout 90 detik dan fallback bisa mencoba beberapa provider tanpa budget total. Sekarang transport memakai cURL jika tersedia (PHP streams sebagai fallback), connect timeout 6 detik, request default 30 detik (`KRA_AI_REQUEST_TIMEOUT_SECONDS`), dan total fallback default 55 detik (`KRA_AI_FALLBACK_BUDGET_SECONDS`). Batas environment dapat disesuaikan, maksimum request 90 detik dan maksimum fallback 180 detik.
3. Chat Anthropic dan Gemini sebelumnya masuk ke `/chat/completions` OpenAI, sehingga umumnya gagal/menunggu fallback meskipun key provider tersedia. Sekarang chat mengirim bentuk request native Anthropic/Gemini, termasuk konversi gambar data URL. Health/model catalog untuk kedua provider menggunakan autentikasi dan endpoint yang sesuai.
4. Team/Crew multi-agent sengaja serial. Ini bukan koneksi macet: tiap specialist menunggu giliran. Ubah ke parallel mode akan mengurangi waktu total tetapi menghilangkan konteks “membaca balasan specialist sebelumnya”; perilaku itu belum diubah.
5. Provider completion masih non-streaming token. UI sebelumnya hanya menampilkan spinner generik; sekarang NDJSON membawa progress agent/provider/ReAct dan durasi. Token pertama baru muncul setelah model menyelesaikan completion. Streaming token nyata perlu adapter per provider dan belum diklaim tersedia.

## Thinking dan editing seperti coding assistant

KRA dapat menampilkan status pekerjaan yang bisa diverifikasi: provider yang dicoba, specialist yang aktif, tahap/aksi ReAct yang sedang berjalan, tool yang selesai/gagal secara ringkas, dan proposal yang menunggu approval. Ini sengaja bukan dump chain-of-thought privat dari model. Trace ReAct yang dikirim browser meredaksi field `thought` dan input tool; hasil final, proposal, serta ringkasan observasi tetap tersedia.

KRA sudah mendukung AI menyiapkan edit file, tetapi mode yang aman adalah **proposal → review → approval → write**. Ini bukan editor otonom yang langsung mengubah beberapa file di belakang layar. Untuk edit gunakan workspace terpilih dan path file spesifik; tiap proposal perlu approval. Untuk menjalankan test setelah edit, reviewer dapat memakai `/run` manual dengan konfirmasi.

## Dukungan Python

Python **dapat digunakan**, tetapi interpreter tidak dibundel ke KRA. Python harus terinstal di host dan terlihat oleh PATH akun yang menjalankan PHP/Apache (di Windows/XAMPP, service Apache mungkin memiliki PATH berbeda dari terminal CMD). Cek dengan:

```text
/run python --version
/run python3 --version
/run python -m pytest
```

Gunakan file script yang sudah ditinjau, misalnya `/run python tools/check.py`. KRA menolak shell chaining/pipes/redirects, meminta konfirmasi, dan membatasi waktu/output. KRA tidak menjalankan Python otomatis dari prompt agent karena tool command arbitrer tidak dibuka ke model; minta agent membuat proposal `.py`, review, approve, lalu jalankan secara eksplisit.

## Verifikasi dan batas klaim

Perubahan ini dicek dengan verifikasi source/JS yang tersedia dan parser PHP 8.4. Koneksi provider nyata, latensi Ollama/9Router, billing/quota provider cloud, dan runtime Python pada host deployment tetap harus diuji di mesin KRA pengguna. Kecepatan model bergantung kuat pada model yang dipilih, panjang konteks, perangkat keras Ollama, koneksi, serta kondisi provider. Tidak ada angka “jawaban pasti X detik” yang bisa dijamin dari repo saja.
