# Paket Skills KRA untuk Webapp

Paket ini adalah **salinan skill Muse** yang dipakai 6 agen KRA, disiapkan supaya bisa
dipakai di webapp `kantor-rama-ai` (KRA) tanpa membangun ulang skill dari nol.

> **Penting:** skill TIDAK ter-install otomatis di webapp. Muse dan webapp adalah
> dua tempat berbeda. Paket ini harus dicopy ke repo webapp, lalu webapp memuatnya
> berdasarkan daftar di `../agents/kra-agents.json` dan `manifest.json`.

## Isi paket

- **53 skill** (1807 file): tiap skill = folder dengan `SKILL.md` + `skill.yaml`.
  `yt-script` juga membawa `scripts/hooks.json` + `scripts/hookscore.py`.
  Skill `yt-*` lainnya membawa script Python stdlib-nya masing-masing
  (title.py, deadair.py, chapters.py, retention.py, swipe.py).
  33 skill baru RAGA (2026-11-09, manifest v1.2.0): 13 skill Remotion resmi
  (`remotion-*`), 9 skill HyperFrames (`figma`, `hyperframes`,
  `hyperframes-cli`, `hyperframes-registry`, `media-use`,
  `remotion-to-hyperframes`, `reverse-any-video`, `slideshow`,
  `style-sampling`), 8 skill GSAP (`gsap-*`), `video-shotcraft`,
  `motionmaxxing`, dan `anatomy`.
- `manifest.json` — daftar skill, sumber + lisensi, dan pemetaan agen → skill.
- `sync-from-muse.sh` — script untuk sinkronisasi ulang dari Muse.

| Skill | Dipakai oleh |
|---|---|
| antislop | RAMA, NARA, RAGA, PUTRI, MARTA, ARUNA |
| superpowers | RAMA, NARA, RAGA, PUTRI, MARTA, ARUNA |
| caveman | RAMA, NARA, RAGA, MARTA, ARUNA |
| debugging | NARA |
| code-review-and-quality | NARA |
| api-and-interface-design | NARA |
| yt-script | PUTRI |
| storytelling-skills | PUTRI |
| viral-script-architect | PUTRI |
| shorts-hook | PUTRI |
| yt-edit | RAGA |
| yt-shorts | RAGA |
| yt-chapters | RAGA |
| remotion-best-practices | RAGA |
| remotion-captions | RAGA |
| remotion-create | RAGA |
| remotion-docs | RAGA |
| remotion-interactivity | RAGA |
| remotion-license | RAGA |
| remotion-maps | RAGA |
| remotion-markup | RAGA |
| remotion-multimedia | RAGA |
| remotion-render | RAGA |
| remotion-saas | RAGA |
| remotion-studio | RAGA |
| remotion-upgrade | RAGA |
| figma | RAGA |
| hyperframes | RAGA |
| hyperframes-cli | RAGA |
| hyperframes-registry | RAGA |
| media-use | RAGA |
| remotion-to-hyperframes | RAGA |
| reverse-any-video | RAGA |
| slideshow | RAGA |
| style-sampling | RAGA |
| gsap-core | RAGA |
| gsap-frameworks | RAGA |
| gsap-performance | RAGA |
| gsap-plugins | RAGA |
| gsap-react | RAGA |
| gsap-scrolltrigger | RAGA |
| gsap-timeline | RAGA |
| gsap-utils | RAGA |
| video-shotcraft | RAGA |
| motionmaxxing | RAGA |
| anatomy | RAGA |
| yt-package | ARUNA |
| yt-seo | ARUNA |
| yt-retention | ARUNA |
| yt-plan | ARUNA |
| yt-viral | ARUNA |
| yt-comment | ARUNA |
| yt-audit | ARUNA |

## Cara pakai di webapp

1. Copy seluruh isi folder ini ke repo webapp, misal jadi `kra/skills/`
   (atau `apps/kra/skills/` — sesuaikan dengan struktur repo Yang Mulia).
2. Saat webapp memuat satu agen, baca daftar skill agen itu dari
   `../agents/kra-agents.json` (atau `manifest.json` di paket ini),
   lalu muat file `SKILL.md` dari tiap skill yang terdaftar sebagai
   instruksi/prompt agen tersebut.
3. Untuk `yt-script`, jalankan scorer-nya dari path webapp sendiri:
   `python3 <webapp>/skills/yt-script/scripts/hookscore.py --hook "..."`.
   Jangan pakai path absolut Muse (`~/workspace/custom-skills/...`) yang tertulis
   di `SKILL.md` — ganti dengan path relatif webapp.

## Yang TIDAK ada di paket ini (katalog-only)

Nama-nama ini hanya katalog di dalam aplikasi agen, bukan file skill standalone,
jadi tidak ada filenya di sini. Di webapp, pasang sebagai tool/integrasi terpisah:

- **RAGA (11 tool):** Remotion, FFmpeg, MoviePy, Shotcut, OBS Studio, GIMP,
  darktable, ImageMagick, Audacity, Piper, faster-whisper.
- **ARUNA (3 spesialisasi YouTube, katalog-only):** yt-publish,
  youtube-marketing, youtube-cli-app. (yt-package, yt-seo, yt-retention,
  yt-plan, yt-viral, yt-comment, dan yt-audit sekarang sudah berupa file
  skill asli di paket ini, sejak 2026-11-09.)

Catatan Remotion: hanya untuk pemakaian Alfa sendiri di KRA, bukan untuk semua
pengguna kantor. YouTube upload masih menunggu kredensial dari Yang Mulia.

## Lisensi — baca sebelum dipublikasikan

- 39 dari 53 skill berlisensi MIT / Apache-2.0 (lihat `manifest.json` per skill).
- **`viral-script-architect` tidak punya file lisensi upstream** — ditandai
  use-only. Paket ini untuk pemakaian internal PT KRA saja, **jangan
  dipublikasikan / didistribusikan ulang sebagai repo publik**.
- **13 skill `remotion-*` juga tidak punya file lisensi upstream**
  (repo `remotion-dev/skills` tidak menyertakan LICENSE) — ditandai use-only
  dengan alasan yang sama. Jangan dipublikasikan / didistribusikan ulang.

## Sinkronisasi ulang

Paket ini adalah **snapshot per 2026-11-09**. Kalau skill berubah di Muse
atau persona/skill berubah di space agen:

```bash
# dari dalam folder paket ini (workspace/kra/skills/)
./sync-from-muse.sh
```

Script itu menyalin ulang dari `~/workspace/custom-skills/` dan memverifikasi
isinya identik dengan sumber. Setelah itu regenerate juga
`../agents/kra-agents.json` lewat Muse agar daftar skill agen tetap sinkron.
