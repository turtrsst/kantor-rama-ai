# Prompt Webapp KRA — Kantor Rama AI

> Dibuat 2026-11-09 untuk Yang Mulia (Alfa). Prompt di Bagian 1 siap ditempel ke builder webapp apa pun
> (v0, Lovable, Bolt, Cursor, atau sejenisnya). Lampirkan juga file-file di Bagian 2 agar builder
> memakai data agen yang sudah disiapkan, bukan mengarang sendiri.

---

## Bagian 1 — Prompt siap tempel (English)

```
Build "KRA — Kantor Rama AI", a visual virtual office web app for a small team of AI agents
led by a boss agent. The user (called "Yang Mulia", the owner) manages the team from this app.
Language of the UI: Bahasa Indonesia. Dark theme: navy #0B1220 background, cyan #22D3EE
accents, warm wood details, white text. Modern stack (Next.js + TypeScript + Tailwind),
responsive, localStorage-first persistence with clearly marked integration points for a
later backend (n8n webhooks, LLM provider API keys via environment variables — never
hardcode secrets).

TEAM (8 agents, with distinct personas — each agent gets its own profile page and console):
1. RAMA — the boss / leader of the office. Crowned android commander. Issues directives,
   keeps a project registry and a charter with 5 standing directives. Calm, authoritative.
   Color: gold.
2. MARTA (ASBOS) — Assistant Boss, female, directly under RAMA and above all staff.
   Connector between agents: chases unfinished work, gives input, direction, examples,
   inspiration and motivation. Firm, fierce, chatty, but calm in serious mode. Also the
   network expert (databases, memory, team goals). Color: red.
3. NARA — senior programmer and program auditor, backend expert (server logic, APIs,
   databases, architecture, security, performance). Checks code, finds bugs, fixes them,
   can recommend system direction. Meticulous and smart, learns from mistakes. Color: blue.
4. RAGA — designer, frontend expert, photo and video editor. Humorous and cheerful, loves
   current light/silly humor ("humor receh"). Owns the video production pipeline. Color: green.
5. PUTRI — script writer. Writes video scripts that MUST be approved by Yang Mulia before
   they go to RAGA (approval gate — enforce this in the UI: a script with status
   "Menunggu Approval" cannot move to editing). Firm, a bit awkward, beautiful and elegant,
   hardworking, willing to work overtime. Color: pink.
6. ARUNA — intern super agent, lowest formal rank, reports to MARTA. Polite and diligent on
   the surface, very smart, fast learner, meticulous note-taker. Counters teasing with sharp,
   factual, witty comebacks (playful, never personal insults). Closes the content pipeline:
   trend research, packaging (title/thumbnail/SEO), publishing/scheduling, analytics and
   feedback to PUTRI and RAGA. Color: orange.
7. MEIMEI — Quality Assurance for video, female, staff under MARTA. Perfectionist
   with eagle eyes: checks every finished render against the Shorts spec (60s,
   720x1280, 30fps, captions, hook) frame by frame and delivers a PASS / REVISE
   verdict with evidence (timestamp + frame + fix). No video reaches ARUNA
   without her PASS (QA gate — enforce in the UI: a render with status "Menunggu
   QA" or "REVISE" cannot move to packaging). Blunt about defects, fair about
   praise. Color: teal.
8. FIZI — Marketing & Community, female, staff under MARTA. Bubbly, warm,
   always online: replies to audience comments on YouTube, TikTok and Threads,
   cross-posts published Shorts, and feeds audience questions back to PUTRI
   (script ideas) and ARUNA (packaging). Never invents engagement numbers;
   flags toxic/spam/scam comments to Yang Mulia. Color: lime.

HIERARCHY (enforce in the UI where relevant): Yang Mulia → RAMA → MARTA → NARA, RAGA, PUTRI
→ ARUNA (intern), MEIMEI (QA), FIZI (Community). Escalation path for blocked work: staff → MARTA → RAMA → Yang Mulia.

TWO MODES (toggle in the header):
- Office mode: a Codex-like terminal chat for code review/audit and building new apps,
  led by NARA/RAMA/MARTA. Provider slots: 9router and freellmapi (free tiers, configurable
  API base URL + key in Settings — free options only).
- Content Creator mode: a 7-stage pipeline Ide → Naskah (PUTRI) → Approval (Yang Mulia) →
  Edit (RAGA) → QA (MEIMEI: PASS/REVISE) → Paket Publish (ARUNA) → Terbit. Orchestrator: self-hosted n8n (webhook URLs
  configurable in Settings). Video rendering: Remotion — RESTRICTED to Yang Mulia's use only,
  show it as "Remotion (khusus Yang Mulia)". Publishing: YouTube upload via Concat
  (configure Client ID / Client Secret / channel in Settings; never expose secrets in the UI).

PAGES / FEATURES:
1. Visual Office (home): a RimWorld-style isometric floor plan — boss office top-left,
   toilet top-centre, studio top-right, meeting room left, workspace bottom-left, pantry
   bottom-right, and an ELEVATOR in the centre (every room change routes through the
   elevator). Chibi characters of the 8 agents walk between rooms; each agent shows a live
   status (working / meeting / resting / joking). Clicking a room or an agent opens that
   agent's console. Header shows the motto: "kita adalah pemimpi di hidupnya masing-masing"
   — Yang Mulia.
2. Group Chat (the command layer for both modes): one room "Kantor KRA" with Yang Mulia +
   all 8 agents. Agents reply in character in Bahasa Indonesia and greet "Yang Mulia".
   @-mentioning an agent makes that agent reply; agents can reply to each other. Message
   history persists. Include starter suggestions and a clear-chat button with confirmation.
3. Agent consoles (one per agent): a working console matching the agent's job — RAMA:
   command console + project registry + charter editor; NARA: audit console (verdict, health
   score, findings with severity and fixes, system-direction recommendation, learning journal);
   RAGA: studio brief console + 7-stage production pipeline + tool catalogue (Remotion,
   FFmpeg, MoviePy, Shotcut, OBS Studio, GIMP, darktable, ImageMagick, Audacity, Piper,
   faster-whisper); PUTRI: writing console (5 scored hooks, per-scene script, caption, CTA)
   + approval gate; MARTA: ASBOS console (team task board, whip/motivation messages, network
   audit); ARUNA: mission console (trend research, publish package, analytics, feedback).
   Each console has the agent's profile, persona sliders and a "Laporan ke RAMA" (report to
   RAMA) action. All boards start empty — never invent fake tasks, analytics or history.
4. Pipeline board (Content Creator mode): kanban of the 6 stages with the approval gate
   enforced.
5. Settings / Connections: LLM providers (9router, freellmapi), n8n webhook URLs, YouTube /
   Concat credentials (Client ID, Client Secret, channel), and a note that Remotion is for
   Yang Mulia only.

DATA: use the attached agent definition files (kra-agents.json + per-agent JSON) as the
source of truth for names, roles, personas, hierarchy and skills. Use the attached skills
manifest (manifest.json) for each agent's skill list. If a value is not in the files, leave
it empty / configurable — do not invent fake data, fake analytics, fake subscribers or fake
history. Seed the app with empty boards and zeroed stats.

FUTURE (do not build now, but leave a clearly marked placeholder slot): a Finance division
with SANDI (meticulous, quiet, mysterious finance analyst for stocks, crypto
and forex; read-only, never trades) and MAEL (trader — executes only within a
plan approved by RAMA and Yang Mulia, demo/paper trading only until a real
plan is approved), and a future "Trader mode" beside Office and Content
Creator modes.

Build it as a complete, runnable app. Start with the Visual Office + Group Chat + agent
roster, then the two modes, then Settings. After the first build, list what is stubbed
(needs a real backend key/webhook) vs what works locally.
```

---

## Bagian 2 — File yang dilampirkan bersama prompt

Upload file-file ini bersama prompt di atas, supaya builder memakai data yang sudah disiapkan:

| File | Isi |
|---|---|
| `kra/agents/kra-agents.json` | Definisi gabungan: kantor, hierarki, semua agen |
| `kra/agents/rama.json`, `marta.json`, `nara.json`, `raga.json`, `putri.json`, `aruna.json` | Definisi per agen (persona, peran, skill) |
| `kra/agents/persona-template.md` + `kra/agents/personas/*.md` | File persona lengkap per agen (format agency-agents: identitas & memori, misi, aturan kritis, deliverable, workflow, gaya komunikasi, metrik sukses) — `rama.md`, `marta.md`, `nara.md`, `raga.md`, `putri.md`, `aruna.md`, `meimei.md`, `fizi.md`; SANDI di `finance/sandi.json` dan MAEL di `finance/mael.json` (persona: `kra/agents/personas/sandi.md`, `kra/agents/personas/mael.md`) |
| `kra/skills/manifest.json` | 20 skill + pemetaan agen → skill |
| `kra/skills/README.md` | Cara pasang skill di webapp |
| `kra-blueprint-integrasi.pdf` | Blueprint integrasi (otak / memori / wajah, envelope pesan, pipeline 6 tahap, eskalasi) |

Lokasi file-file ini di Muse: `~/workspace/kra/agents/`, `~/workspace/kra/skills/`, dan PDF blueprint
di `~/workspace/your_files/kra-blueprint-integrasi/kra-blueprint-integrasi.pdf`.

**Catatan penting untuk builder:**
- SANDI dan MAEL (agen keuangan) TIDAK ada di file-file KRA di atas — mereka standalone dan baru masuk
  divisi Finance nanti. Jangan masukkan mereka ke daftar tim v1.
- Skill RAGA yang 11 tools (Remotion, FFmpeg, dsb.) adalah nama katalog, bukan file skill.
- `viral-script-architect` tidak berlisensi upstream — pemakaian internal saja, jangan dipublikasikan.

---

## Bagian 3 — Cara memakai prompt ini

1. Buka builder webapp pilihan Yang Mulia (v0 / Lovable / Bolt / Cursor / lainnya).
2. Tempel seluruh isi Bagian 1, lalu upload file-file Bagian 2.
3. Minta builder mulai dari fondasi (Visual Office + Group Chat + daftar agen), baru lanjut
   ke Mode Office, Mode Content Creator, lalu Settings. Kalau builder membatasi satu prompt,
   pecah per halaman dengan awalan yang sama ("Lanjutkan webapp KRA...").
4. Setelah jadi, cek tiga hal ini dulu: (a) approval gate PUTRI benar-benar mengunci naskah
   yang belum di-approve, (b) tidak ada data palsu (tugas/analitik/history harus mulai kosong),
   (c) kredensial (API key, Client Secret) hanya lewat Settings/env, tidak tertulis di kode.
5. Kalau Yang Mulia beri tahu nama builder-nya, Muse bisa menyesuaikan prompt ini (mis. format
   khusus Lovable/v0, atau pecahan prompt per langkah).

---

## Bagian 4 — Alur khusus OpenCode (builder Yang Mulia)

OpenCode bekerja di terminal, di dalam folder proyek lokal, dan membaca file langsung dari disk.
Jadi jangan "upload" file — taruh file di dalam proyek:

1. Buat folder proyek, mis. `kantor-rama-ai/`, lalu salin ke dalamnya:
   - `kra/agents/` (semua JSON agen)
   - `kra/skills/` (manifest + README)
   - `kra-blueprint-integrasi.pdf`
   - File ini (`prompt-webapp-kra.md`) dan `webapp-AGENTS.md` (disimpan sebagai `AGENTS.md`
     di root proyek — OpenCode membaca file itu otomatis sebagai aturan proyek).
2. Jalankan `opencode` di folder itu, lalu tempel Bagian 1 sebagai perintah pertama, dengan
   tambahan ini di awal perintah: "Baca dulu @kra/agents/kra-agents.json,
   @kra/skills/manifest.json dan @AGENTS.md, lalu bangun sesuai itu."
3. Bangun bertahap, satu perintah per langkah (OpenCode paling kuat kalau langkahnya kecil):
   - Langkah 1: scaffold + Visual Office + daftar agen
   - Langkah 2: Group Chat (command layer)
   - Langkah 3: Mode Office (terminal chat + slot provider 9router/freellmapi)
   - Langkah 4: Mode Content Creator (pipeline + approval gate PUTRI)
   - Langkah 5: Settings / Connections (n8n, YouTube/Concat)
   Minta OpenCode commit/checkpoint tiap langkah selesai sebelum lanjut.
4. Kalau OpenCode mengarang data (tugas, analitik, subscriber palsu), tegur dengan: "Hapus data
   karangan itu. Semua board mulai kosong, sesuai AGENTS.md."
5. Rahasia (API key, Client Secret) hanya lewat `.env` / Settings — jangan pernah ditempel ke
   prompt dan jangan di-commit ke git.

## Bagian 5 — Desain pakai Gemini Argon

Gemini 4 Argon (model reasoning Google, di aplikasi Gemini / AI Studio / Antigravity) dipakai
untuk arah desain, OpenCode untuk implementasi. Alurnya:

1. Di Argon, minta desain per layar (satu layar satu prompt, supaya konsisten):
   - "Desain mockup Visual Office KRA: denah isometrik ala RimWorld, koridor gelap, aksen cyan,
     lift di tengah, ruangan: boss office, toilet, studio, ruang rapat, workspace, pantry.
     Palet navy #0B1220 + cyan #22D3EE, teks putih, UI Bahasa Indonesia."
   - "Character sheet 6 chibi agen KRA: RAMA mahkota emas, MARTA merah galak, NARA biru
     berkacamata, RAGA hijau clapperboard, PUTRI pink, ARUNA oranye bertopi. Gaya chibi imut,
     konsisten di semua layar."
   - Mockup Group Chat, konsol tiap agen, dan pipeline board — masing-masing satu prompt.
2. Simpan hasil desain Argon ke folder `design/` di proyek (gambar/mockup/HTML referensi).
3. Di OpenCode, tunjuk file desainnya: "Implementasikan layar ini persis dari
   @design/visual-office.png, pertahankan palet dan layout-nya."
4. Catatan jujur: Argon kuat untuk eksplorasi arah desain, tapi bisa "drift" antar layar
   (warna/spasi berubah-ubah). Kunci konsistensi dengan satu file token desain
   (`design/tokens.md`: palet, font, radius, spacing) dan selalu rujuk file itu di tiap
   perintah OpenCode. Perhatikan juga kuota pemakaian Argon di paket Pro (ada laporan batas
   pemakaian per beberapa jam) — buat prompt desain sefokus mungkin.
