# Panduan Voicebox untuk RAGA — instalasi + tes Bahasa Indonesia

Disiapkan 2026-11-10 untuk Yang Mulia. Tujuannya satu: RAGA punya **satu suara narator yang konsisten** di semua video, bukan lagi suara stok Piper yang berganti-ganti. Voicebox itu aplikasi desktop gratis (jamiepine/voicebox, MIT) yang jalan di komputer Yang Mulia — bukan di Muse, karena di VM Muse tidak ada Docker dan aplikasinya harus jalan lokal.

## Langkah 1 — Instal aplikasinya (Windows)

1. Buka **https://voicebox.sh**, unduh versi **Windows (MSI)**, instal seperti aplikasi biasa.
2. Jalankan Voicebox. Biarkan aplikasinya tetap berjalan saat RAGA nanti generate narasi — kalau aplikasinya mati, tidak ada suara yang bisa dipakai.
3. Cek aplikasinya hidup: buka di browser **http://127.0.0.1:17493/profiles**. Kalau halaman itu terbuka (walau masih kosong), Voicebox sudah jalan. Kalau gagal dibuka, aplikasinya belum berjalan.
4. Alternatif kalau nanti mau di server webapp: jalankan via Docker (`docker compose up`). Untuk sekarang, instalasi Windows di atas sudah cukup.

## Langkah 2 — Buat voice profile (pilih salah satu)

**Opsi A — clone suara sendiri (yang disarankan).** Di aplikasi Voicebox, buat profile baru lalu rekam langsung atau unggah sampel suara Yang Mulia (beberapa detik sudah cukup; makin banyak sampel, makin mirip). Ini yang bikin narasi KRA terdengar khas.

**Opsi B — pakai preset, tanpa rekam suara.** Kalau tidak mau pakai suara sendiri, pilih preset bawaan: Qwen CustomVoice (9 suara preset) atau Kokoro (50 suara preset). Tidak perlu audio referensi.

Catatan penting: clone hanya suara milik sendiri atau yang sudah diizinkan pemiliknya. Jangan clone suara orang lain.

## Langkah 3 — Tes Bahasa Indonesia dulu (wajib sebelum dipakai di video)

Ini langkah yang paling penting, dan jujur saja alasannya: Voicebox mengklaim 23 bahasa dan menyebut Malay, tapi **Bahasa Indonesia belum terkonfirmasi untuk engine mana pun**. Jadi jangan langsung pakai untuk video asli sebelum dites dan didengarkan.

1. Di Voicebox, pilih profile dari Langkah 2.
2. Pilih engine **Chatterbox Multilingual** dulu (cakupan bahasa terluas, termasuk Malay — yang paling dekat dengan Indonesia). Kalau hasilnya kurang bagus, coba **Qwen3-TTS**.
3. Bahasa: pilih/set **`id`**.
4. Generate kalimat tes ini (nada narasi Shorts KRA):

   > "Halo, selamat datang di kantor RAMA AI. Hari ini enam karyawan AI saya minta lembur terus, dan yang magang paling galak."

5. Dengarkan hasilnya dan nilai tiga hal: pengucapannya benar, nadanya natural (tidak robotik/kaku), dan tidak ada kata yang dibaca seperti bahasa lain.
6. Kalau bagus, catat: **nama profile + engine yang dipakai**. Kalau tidak bagus di kedua engine, berhenti di situ — jangan dipaksakan.

## Langkah 4 — Kabari Muse hasilnya

Kirim ke chat ini tiga hal saja:

1. Nama profile Voicebox-nya.
2. Engine yang paling bagus hasil tesnya (atau "keduanya jelek").
3. Kalau sempat, kirim file audio sampelnya.

Setelah itu RAGA yang ambil alih: narasi tiap scene di-generate lewat Voicebox (port 17493), satu file WAV per scene, lalu masuk ke render seperti biasa. Kalau tes Indonesianya gagal, RAGA tetap pakai fallback yang sudah terbukti: **Piper TTS `id_ID-news_tts-medium`**.

## Yang perlu diingat

- Voicebox hanya menggantikan **langkah narasi** — render, QA MEIMEI, approval Yang Mulia, dan publish ARUNA tidak berubah.
- Audio tidak pernah keluar dari komputer Yang Mulia (local-first).
- Jangan pakai tag seperti `[laugh]` atau `[sigh]` di naskah narasi — tag itu hanya dimengerti engine Chatterbox Turbo; engine lain membacanya sebagai teks biasa.
- Detail teknis lengkap (REST API, MCP server, 8 engine) ada di skill RAGA: `~/workspace/custom-skills/voicebox/SKILL.md`.
