# MEMORY.md — Project Memory Lengkap Kantor Rama AI (KRA)

> *"kita adalah pemimpi di hidupnya masing-masing"* — Yang Mulia (Alfa)
> *"Kerja cepat boleh, tapi jujur dan aman itu wajib."*

Dokumen ini adalah **memori resmi proyek** `kantor-rama-ai` (branch aktif: `arena/74afbde3-kantor-rama-ai`) yang merangkum arsitektur penuh dari Phase 1 hingga Phase 3 (integrasi 11 bot asli KRA + Finance & Exness Read-Only + kalibrasi visual 2.5D).

---

## 1. Identitas & Stack Teknis

- **Nama Aplikasi**: Kantor Rama AI (KRA) — Virtual 2.5D Isometric Office + Command Console + Standalone Finance Division.
- **Pemilik**: Yang Mulia (Alfa).
- **Bahasa UI**: Bahasa Indonesia (tema gelap `#0B1220` / `#141923`, aksen cyan/sky, detail hangat).
- **Frontend**: `Vite 6.4.6` + `React 19` + `TypeScript` + `Tailwind CSS v4` + `Three.js` (Orthographic Camera, OrbitControls, 4-pass WebGL renderer + Pass-5 HUD overlay).
- **Backend Middleware (`server/kraServer.mjs`)**: Pure Node ESM API handler (`createKraApiHandler`) terpasang langsung di `vite.config.ts` (`configureServer` & `configurePreviewServer`) pada `0.0.0.0:5173`.
- **Konektor Exness Read-Only**: Porting penuh Ed25519 signing dari `exness/bin/exness-readonly.mjs` (`EXN-DATA` / `EXN-SIGN`, **GET only**, tanpa order execution).

---

## 2. Arsitektur 11 Bot Asli (Sumber Kebenaran: `agents/` & `finance/`)

### A. 8 Agen Inti Kantor KRA (Masuk Group Chat `"Kantor KRA"`, Lantai 1 & 2)
Hierarki resmi: **Yang Mulia (Alfa) → RAMA → MARTA → Staf (`NARA`, `PUTRI`, `RAGA`, `MEIMEI`, `ARUNA`, `FIZI`)**.

| ID | Nama | Peran & Gate | Lantai | Ruangan Utama | Sprite Cell (`agents_cleaned.png`) |
| --- | --- | --- | --- | --- | --- |
| `rama` | **RAMA** (`01`) | Boss / Commander, Project Registry, 5 Standing Directives | L1 | `Floor1_BossRoom` | `col 0/1` |
| `marta` | **MARTA si ASBOS** (`05`) | Asisten Boss (perempuan), Task Enforcer & Network | L1 | `Floor1_Boardroom` | `col 2/3` |
| `nara` | **NARA** (`02`) | Senior Programmer & Security Auditor | L1 | `Floor1_Desk1` | `col 6/7`, desk `(7,2)` |
| `putri` | **PUTRI** (`04`) | Script Writer (**Approval Gate Yang Mulia**) | L1 | `Floor1_Desk2` | `col 7/8 row 3/4` |
| `raga` | **RAGA** (`03`) | Desainer, Video Editor & Voicebox (**Remotion khusus Yang Mulia**) | L2 | `Floor2_DesignDesk` | `col 4/5`, desk `(6,2)` |
| `meimei` | **MEIMEI** (`07`) | **QA Gate** & Verifikator (`PASS` / `REVISE` sebelum ARUNA) | L2 | `Floor2_MultiMonitor` | `col 9 row 0`, `col 4..6 row 3..4` |
| `aruna` | **ARUNA** (`06`) | Magang Super Agent — Riset Tren, Packaging & Publish (`Siap Terbit`) | L1 | `Floor1_TripleDesk` | `col 2/3` |
| `fizi` | **FIZI** (`08`) | Community & Support (YouTube / TikTok / Threads) | L1 | `Floor1_Lounge` | `col 8/9`, `col 0/3 row 4` |

### B. 3 Agen Divisi Finance Standalone (Lantai 3 — **TIDAK masuk Group Chat KRA**)
| ID | Nama | Peran & Aturan | Lantai | Ruangan Utama |
| --- | --- | --- | --- | --- |
| `sandi` | **SANDI** | Crypto & Financial Analyst — Brief Market, Sizing, Watchlist & Thesis. **Tidak pernah eksekusi order / no advice.** | L3 | `Floor3_Videotron` |
| `mael` | **MAEL** | Treasury & Risk Guard — Pembaca Exness Read-Only (`DEMO` & `REAL`), risk cap 1–2%, hard SL wajib, min R:R 1:2. | L3 | `Floor3_TradingFloor` |
| `jarjit` | **JARJIT** | Airdrop Hunter & Monetisasi — **Zero fake listing!** Hanya catat sumber HTTPS resmi + risiko Sybil/lockup/gas. | L3 | `Floor3_TreasuryVault` |

---

## 3. Aturan Keras & Keamanan (Non-Negotiable Rules)

1. **PUTRI Approval Gate**: Naskah pada tahap `"Approval Gate"` (`PipelineBoardModal.tsx`) **TIDAK BISA** maju ke `RAGA` sebelum disetujui eksplisit oleh Yang Mulia (`Approve` vs `Revisi`).
2. **MEIMEI QA Gate**: Hasil render `RAGA` pada tahap `"QA Gate"` **TIDAK BISA** maju ke `ARUNA` (`Siap Terbit`) sebelum mendapat verdict `PASS` dari `MEIMEI`.
3. **Remotion Khusus Yang Mulia**: 13 skill `remotion-*` dan `viral-script-architect` adalah **use-only** (tidak untuk redistribusi publik), selalu dilabeli `"Remotion (khusus Yang Mulia)"`.
4. **Zero Fake Data**:
   - Feed market & Exness tampil jujur sebagai **`BELUM DISET`** atau **`BELUM DIAMBIL`** sampai data riil benar-benar diambil.
   - `PipelineBoardModal`, `Watchlist`, `Thesis Journal`, dan `Airdrop Tracker` selalu dimulai **kosong (`[]`)**.
   - YouTube upload berhenti jujur di status **`Siap Terbit`** menunggu kredensial resmi.
5. **Exness Read-Only Ketat (Server-Side Only)**:
   - Seluruh API Exness menggunakan metode **`GET` only**, HTTPS-only, `redirect: 'error'`, timeout 15s.
   - **Tidak ada** endpoint maupun tombol UI untuk `BUY`, `SELL`, `OPEN`, `CLOSE`, atau `POST` order trading.
   - Secret (`apiKey`, `privateKey`, `accountId`, provider keys) hanya disimpan di server pada `.kra-secrets.json` (`0o600`) & `.kra-env.local` (`0o600`) yang masuk `.gitignore` — **tidak pernah** dikirim ke browser (browser hanya menerima tail-4 masked) dan **tidak memicu restart Vite** saat disimpan via UI.
   - Cache URL discovery per profil (`demo` & `real`) disimpan 24 jam di `exness/.access-point.{demo,real}.json` (tanpa token/rahasia).

---

## 4. Arsitektur Visual 2.5D Isometric (`OfficeEngine.ts`)

1. **Multi-Floor 3 Lantai + Central Lift**:
   - Lantai 1 (`floor_1_base.png`): KRA HQ (Boss Office, Boardroom, Open Desks, Espresso Pantry, Studio, Lounge).
   - Lantai 2 (`floor_2_expansion.png`): R&D DNA Lab, Molecule QA Lab MEIMEI, Studio RAGA, Shorts Lounge, Restroom.
   - Lantai 3 (`floor_3_finance.png`): BTC/USDT Live Videotron (`btcVideotron.ts`), Macro Conference, Exness Pit MAEL, Treasury Vault JARJIT, Voicebox Audio Room.
   - Perpindahan lantai agen selalu berjalan melewati pintu/node `FLOOR_NAV_NODES` menuju `Central Lift` (`lift_lobby_l`/`r`), animasi 4-frame pintu lift, naik/turun antar lantai, lalu menuju ruangan tujuan.
2. **4-Pass Renderer + Pass 5 UI Overlay**:
   - **Pass 1**: Base floor isometric + Floor 3 BTC/USDT Videotron & Exness ticker.
   - **Pass 2**: Y-sorted Furnitur (`32` item katalog), Props animasi, Pets, Agen, dan **Seated Combo Swap (`resolveAgentFurnitureCombo`)**: ketika agen berhenti bekerja/ngopi di dekat furnitur cocok (`<= 1.65` world units), agen otomatis bertukar ke sprite kombinasi duduk dari `COMBO_ANIM_LIBRARY` tepat di anchor furnitur, **dan furnitur statis di bawahnya disembunyikan (`occupiedFurnitureUids`)** agar tidak terjadi double-render (di Edit Mode semua furnitur tetap terlihat untuk drag/edit).
   - **Pass 3**: Dynamic Wall Cutaway (`20` dinding modular `wallsCatalog.ts`) yang otomatis menjadi cutaway half-wall saat agen berada di belakang dinding (`dy > 0.02 && dy < 1.50`).
   - **Pass 4**: RimWorld Stippled Fog-of-War (`ROOM_ZONES`, 21 zona) + 4-frame Sliding Glass Doors (`SLIDE_W = 0.68`) yang membuka ruangan saat pintu terbuka atau ada penghuni.
   - **Pass 5 (`AgentFloatingBubbles.tsx`, `z-[15]`)**: Nameplate & Task Bubble dirender di atas seluruh dinding/kabut, mengikuti posisi `renderPos` (anchor combo saat duduk), otomatis tersembunyi bila agen berada di ruangan ber-Fog-of-War, dan di-clamp agar tidak terpotong tepi atas/HUD.
3. **Kalibrasi Koordinat Penting (Floor 1 & 2)**:
   - `trophy` Floor 1: `u: 0.242, v: 0.342` (sudut kayu kiri dalam `BossRoom`, bebas dari kursi bos & dinding pembatas bawah).
   - `fridge` Floor 1 & 2: `u: 0.746, v: 0.718, flipX: true` (menghadap kiri-bawah sejajar `pantry_counter`, bebas dari garis partisi neon cyan).
   - `STORAGE_FURNITURE_KEY = 'kra_modular_furniture_v6'`, `STORAGE_WALL_KEY = 'kra_modular_walls_v4'`.

---

## 5. Peta File & Endpoint API

### File Utama Aplikasi
- `server/kraServer.mjs` — Middleware API KRA, Skills, Group Chat, Exness Read-Only (`DEMO` & `REAL`), Market Brief, SANDI Analyze, Settings.
- `vite.config.ts` — Mount `createKraApiHandler(process.cwd())` di dev & preview server.
- `src/App.tsx` — Root state, Workspace Mode Switcher (`office` | `content-creator` | `finance`), Binance BTC/USDT WS listener, modal orchestration.
- `src/types/office.ts` — Kontrak tipe TS lengkap (Agen, Pipeline, Exness, Market, Zone).
- `src/data/agentsCatalog.ts` — 11 bot asli KRA + Finance beserta jadwal, persona, traits, skills, & sprite frame.
- `src/data/interactionCombos.ts` — `COMBO_ANIM_LIBRARY`, `AGENT_COMBO_MAP`, dan `resolveAgentFurnitureCombo`.
- `src/data/floorNavGraph.ts` — `FLOOR_NAV_NODES`, `ROOM_DEFINITIONS` (21 ruangan), `ROOM_ZONES` (21 poligon Fog-of-War).
- `src/data/furnitureCatalog.ts` — 32 item katalog + layout default Floor 1–3 (`DEFAULT_OFFICE_LAYOUT`).
- `src/data/wallsCatalog.ts` — 20 segmen dinding modular Floor 1–3 (`DEFAULT_WALL_LAYOUT`).
- `src/game/OfficeEngine.ts`, `spriteLoader.ts`, `btcVideotron.ts`, `exnessTicker.ts`.
- `src/components/`:
  - `TopHud.tsx`, `BottomRoster.tsx`, `AgentFloatingBubbles.tsx`
  - `AgentConsoleModal.tsx` (inspeksi bot + pembaca `SKILL.md`)
  - `GroupChatDrawer.tsx` (`kra_group_chat_v1` — khusus 8 agen KRA)
  - `PipelineBoardModal.tsx` (`kra_pipeline_v1` — 7 tahap + Gate PUTRI & MEIMEI)
  - `FinanceConsoleModal.tsx` (Exness DEMO/REAL read-only + SANDI/MAEL/JARJIT + `kra_finance_{watchlist,thesis,airdrops}_v1`)
  - `SettingsModal.tsx` (Exness DEMO/REAL + 9router + freellmapi + n8n + Voicebox + YouTube)
  - `EditorDrawer.tsx`, `MuseCommandDrawer.tsx`, `ShotcraftModal.tsx`
- `docs/finance-phase.md` — Dokumentasi fase Finance & keamanan Exness read-only.

### Endpoint Server (`/api/*`)
- `GET /api/kra/roster`
- `GET /api/kra/skill?name=<skill>`
- `POST /api/kra/chat`
- `GET /api/exness/status`
- `POST /api/exness/save` | `POST /api/exness/delete` | `POST /api/exness/test`
- `GET /api/exness/account?profile=demo|real`
- `GET /api/market/sandi-brief`
- `POST /api/sandi/analyze`
- `GET /api/settings/status` | `POST /api/settings/save`

---

## 6. Perintah Verifikasi & Pengembangan

```bash
# Typecheck + Build produksi
npm run typecheck && npm run build

# Jalankan server pengembangan (host 0.0.0.0 port 5173)
npm run dev -- --host 0.0.0.0 --port 5173

# Self-test kriptografi Ed25519 & validasi URL Exness read-only
node exness/bin/exness-readonly.mjs --self-test
```
