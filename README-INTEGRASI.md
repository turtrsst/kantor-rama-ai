# Paket Integrasi Bots Muse → Webapp KRA

Tanggal paket: **2026-11-10**
Sumber: Muse (untuk Yang Mulia / Alfa) — definisi agen & skill yang sama seperti yang dipakai di Muse.

> **Jujur dulu, Yang Mulia:** ini BUKAN koneksi live Muse → webapp.
> Muse tidak bisa mendorong bot secara otomatis ke localhost.
> Yang dikirim di sini adalah **file definisi yang sama** — jadi webapp
> memakai bot yang sama (nama, peran, persona, hierarki, skill) seperti di Muse,
> tapi dijalankan oleh webapp sendiri dengan provider AI-nya sendiri
> (rencana: 9router / freellmapi). Kalau ada perubahan di Muse nanti,
> minta paket baru / sync ulang ke Muse.

## Isi paket

- `agents/kra-agents.json` — 8 agen KRA: RAMA, NARA, RAGA, PUTRI, MARTA, ARUNA, MEIMEI, FIZI.
  Hierarki: Yang Mulia → RAMA → MARTA → staf.
- `agents/*.json` — definisi per agen (rama, marta, nara, raga, putri, aruna, meimei, fizi).
- `agents/personas/*.md` — 11 file persona (8 KRA + sandi, jarjit, mael) + `persona-template.md`.
- `finance/sandi.json`, `jarjit.json`, `mael.json` — 3 agen finance STANDALONE
  (bukan di `kra-agents.json`). SANDI analisa, MAEL eksekusi hanya dalam plan yang
  disetujui RAMA + Yang Mulia, JARJIT monetisasi. House rule tetap: SANDI tidak
  pernah trading / eksekusi order.
- `skills/` — paket skill KRA, manifest v1.3.0: **54 skill, 1809 file**.
  Termasuk 33 skill RAGA (13 Remotion, 9 HyperFrames, 8 GSAP, dll) + Voicebox.
  `manifest.json` + `README.md` + `sync-from-muse.sh` ada di dalamnya.
- `skills-extra-meimei/` — **tambahan baru di paket ini:** `video-qa`, `media-analysis`,
  `video-shot-breakdown` untuk MEIMEI. Tiga skill ini ada di Muse tapi sebelumnya
  belum masuk paket `skills/` — copy ketiganya ke `kra/skills/` di webapp.
- `prompts/prompt-webapp-kra.md` — prompt OpenCode untuk membangun webapp KRA.
- `prompts/prompt-opencode-bots-exness.md` — prompt OpenCode "jangkar KRA":
  7 langkah berurutan (SANDI → modul Exness → Settings → Uji Konektivitas → dst).
- `prompts/webapp-AGENTS.md` — template AGENTS.md untuk proyek webapp.
- `prompts/voicebox-panduan-instalasi.md` — panduan Voicebox untuk narasi RAGA
  (jalan di mesin/server Yang Mulia, bukan di Muse VM; bahasa Indonesia belum terverifikasi,
  fallback Piper id_ID).
- `exness/` — konektor Exness read-only: `CONNECTOR.md`, `connector.yaml`,
  `bin/exness-readonly.mjs`, `README-SMOKE-TEST.md`.
  Read-only (discovery + account details), tanpa endpoint trading.
  Keputusan Yang Mulia 2026-11-09: kedua key FULL access (demo + real) —
  key real read-only lama harus diganti/dicabut kalau tidak bisa diedit scope-nya.

## Yang TIDAK ada filenya (katalog-only, pasang terpisah di webapp)

- RAGA (11 tool): Remotion, FFmpeg, MoviePy, Shotcut, OBS Studio, GIMP, darktable,
  ImageMagick, Audacity, Piper, faster-whisper.
- ARUNA: `yt-publish`, `youtube-marketing`, `youtube-cli-app`.
- Skill finance SANDI/JARJIT/MAEL: hanya definisi JSON-nya yang ada di paket ini,
  file skill finance-nya sengaja tidak masuk paket KRA (SANDI standalone).

## Lisensi — baca sebelum dipublikasikan

- `viral-script-architect` tidak punya lisensi upstream — internal use only, jangan dipublikasikan.
- 13 skill `remotion-*` juga tidak punya lisensi upstream — internal use only.
- Paket ini untuk pemakaian internal PT KRA saja.

## Cara pasang di proyek `kantor-rama-ai/`

1. Extract ZIP ini, lalu copy ke dalam repo webapp:
   - `agents/` → `kra/agents/`
   - `skills/` + isi `skills-extra-meimei/` → `kra/skills/`
   - `finance/` → `kra/finance/` (atau sesuai struktur repo)
   - `exness/` → modul server Exness (server-side only, jangan commit secret)
2. Jalankan OpenCode di folder proyek, tempel prompt dari
   `prompts/prompt-webapp-kra.md`, lalu `prompts/prompt-opencode-bots-exness.md`.
3. Gate wajib: halaman Finance → **Test Connection** harus PASS untuk
   profil DEMO dan REAL, sebelum lanjut ke langkah berikutnya.
4. Jangan pakai path absolut Muse (`~/workspace/custom-skills/...`) yang tertulis
   di dalam `SKILL.md` — ganti dengan path relatif webapp.

## Kalau bot berubah di Muse

Minta paket baru ke Muse, atau jalankan `skills/sync-from-muse.sh` dari Muse
lalu regenerate `agents/kra-agents.json` lewat Muse bila daftar skill agen berubah.
