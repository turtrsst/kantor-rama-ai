# AGENTS.md — Kantor Rama AI (KRA) webapp

> Simpan file ini sebagai `AGENTS.md` di root proyek `kantor-rama-ai/`.
> OpenCode membacanya otomatis sebagai aturan proyek. Dibuat 2026-11-09.

## Proyek

KRA — Kantor Rama AI: virtual office web app untuk tim 6 agen AI yang dipimpin RAMA.
Pemilik: Yang Mulia (Alfa). Bahasa UI: Bahasa Indonesia.
Tema: gelap, navy `#0B1220`, aksen cyan `#22D3EE`, detail kayu hangat, teks putih.
Stack: Next.js + TypeScript + Tailwind, responsif.

## Agen (sumber kebenaran: `kra/agents/kra-agents.json`)

- **RAMA** (emas) — bos/leader. Command console, project registry, charter.
- **MARTA / ASBOS** (merah) — asisten bos, perempuan, di bawah RAMA, di atas staf. Kejar
  tugas yang belum selesai, beri arahan + motivasi. Ahli jaringan (database, memory, goals).
- **NARA** (biru) — senior programmer/auditor, backend expert. Cek kode, cari bug, perbaiki.
- **RAGA** (hijau) — desainer, frontend, editor foto/video. Humoris, suka humor receh.
- **PUTRI** (pink) — penulis naskah. Naskah WAJIB di-approve Yang Mulia sebelum ke RAGA.
- **ARUNA** (oranye) — magang super agent, di bawah MARTA. Riset tren, packaging, publish,
  analitik, feedback. Balasan cerdas berbasis data kalau diejek.

Hierarki: Yang Mulia → RAMA → MARTA → NARA, RAGA, PUTRI → ARUNA.
Eskalasi kerjaan mentok: staf → MARTA → RAMA → Yang Mulia.

## Aturan keras

1. **Approval gate PUTRI**: naskah berstatus "Menunggu Approval" TIDAK BISA pindah ke editing
   (RAGA). Hanya Yang Mulia yang bisa approve / minta revisi. Jangan pernah melonggarkan ini.
2. **Jangan mengarang data.** Semua board, analitik, history, dan statistik mulai KOSONG / nol.
   Jangan buat tugas, subscriber, view, atau riwayat palsu.
3. **Remotion hanya untuk Yang Mulia.** Tampilkan sebagai "Remotion (khusus Yang Mulia)".
4. **Rahasia tidak pernah di-hardcode.** API key, Client ID/Secret hanya lewat `.env` atau
   halaman Settings. Jangan tulis kredensial di kode, prompt, atau commit git.
5. **Gratis dulu.** Provider: 9router dan freellmapi (free tier) untuk Mode Office; n8n
   self-hosted untuk Mode Content Creator; YouTube via Concat.
6. **Persona konsisten.** Agen membalas sebagai karakter di atas, Bahasa Indonesia, memanggil
   pemilik "Yang Mulia". @-mention agen = agen itu yang membalas.
7. **SANDI bukan tim v1.** Agen keuangan SANDI (standalone, read-only, tidak pernah trading)
   dan Mode Trader adalah slot masa depan — buat placeholder saja, jangan masukkan ke tim.

## Struktur

- Visual Office (home): denah isometrik ala RimWorld — boss office kiri atas, toilet tengah
  atas, studio kanan atas, ruang rapat kiri, workspace kiri bawah, pantry kanan bawah,
  **lift di tengah** (semua pindah ruangan lewat lift). Chibi agen berjalan antar ruangan.
  Motto di header: "kita adalah pemimpi di hidupnya masing-masing" — Yang Mulia.
- Group Chat ("Kantor KRA"): command layer untuk kedua mode.
- Konsol per agen + Pipeline board 6 tahap (Ide → Naskah → Approval → Edit → Paket → Terbit).
- Settings / Connections: provider LLM, webhook n8n, YouTube/Concat.

## File acuan

- `kra/agents/kra-agents.json` + JSON per agen — definisi agen (jangan diubah strukturnya).
- `kra/skills/manifest.json` — daftar skill per agen (20 skill).
- `kra-blueprint-integrasi.pdf` — blueprint integrasi (otak/memori/wajah, envelope pesan).
- `design/` — hasil desain Gemini Argon (mockup per layar) + `design/tokens.md` (palet, font,
  spacing — rujuk file ini di setiap perubahan UI agar konsisten).
