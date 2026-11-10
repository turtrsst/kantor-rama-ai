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

> **Catatan sinkronisasi**: bagian ini merangkum fase visual sebelumnya. Implementasi aktif
> (pure floorplate, grid 4x4, wall height normalization, dan Videotron L3) ada di **Bagian 6**.

1. **Multi-Floor 3 Lantai + Central Lift**:
   - Lantai 1 (`Floor_1_pure.jpg`): KRA HQ (Boss Office, Boardroom, Open Desks, Espresso Pantry, Studio, Lounge).
   - Lantai 2 (`Floor_2_pure.jpg`, U-cutout void): R&D DNA Lab, Molecule QA Lab MEIMEI, Studio RAGA, Shorts Lounge, Restroom.
   - Lantai 3 (`Floor_1_pure.jpg`, dipakai ulang): BTC/USDT Live Videotron (`btcVideotron.ts`), Macro Conference, Exness Pit MAEL, Treasury Vault JARJIT, Voicebox Audio Room.
   - Perpindahan lantai agen selalu berjalan melewati pintu/node `FLOOR_NAV_NODES` menuju `Central Lift` (`lift_lobby_l`/`r`), animasi 4-frame pintu lift, naik/turun antar lantai, lalu menuju ruangan tujuan.
2. **4-Pass Renderer + Pass 5 UI Overlay**:
   - **Pass 1**: Base floor isometric + Floor 3 BTC/USDT Videotron & Exness ticker.
   - **Pass 2**: Y-sorted Furnitur (`32` item katalog), Props animasi, Pets, Agen, dan **Smooth Movement + Seated Combo Swap (`resolveAgentFurnitureCombo`)**:
     - Pergerakan agen dan pet memakai `delta` time, carry-over jarak sudut waypoint, interpolasi eksponensial tahan refresh-rate (`1 - Math.exp(-rate * delta)`), histeresis arah balik horizontal, serta walk-up mulus ke kursi/sofa sebelum bertukar ke sprite kombinasi dari `COMBO_ANIM_LIBRARY` (dengan `cropComboSequence` skala piksel seragam anti-menyusut antar frame) sambil menyembunyikan furnitur statis di bawahnya (`occupiedFurnitureUids`). Kamera follow (`followAgentId`) juga bergerak halus dan otomatis dilepas saat pengguna menggeser kamera.
   - **Pass 3**: Dynamic Wall Cutaway (`64` placement dari `20` sprite dasar `wallsCatalog.ts`) yang otomatis menjadi cutaway half-wall saat agen berada di belakang dinding (`dy > 0.02 && dy < 1.50`).
   - **Pass 4**: Room occupancy / door sensors (`ROOM_ZONES`, 16 zona; **Fog-of-War UI dan overlay sliding glass door sudah dinonaktifkan**). Portal memakai `wall_18`/`wall_19` tanpa kusen dobel; dukungan opsional `slidingDoor` masih ada di engine tetapi tidak dipakai `ROOM_ZONES` aktif.
   - **Pass 5 (`AgentFloatingBubbles.tsx`, `z-[15]`)**: Nameplate & Task Bubble dirender sub-pixel (`translate3d(..., 1 decimal)`) dengan transisi linear halus di atas seluruh dinding/kabut, mengikuti posisi `renderPos` (anchor combo saat duduk), tidak ada lagi occlusion Fog-of-War, dan di-clamp agar tidak terpotong tepi atas/HUD.
3. **Kalibrasi Koordinat & Bebas-Tumpang-Tindih (Floor 1, 2 & 3)**:
   - Seluruh furnitur di `DEFAULT_OFFICE_LAYOUT` Lantai 1–3 dan titik berdiri `ROOM_DEFINITIONS` ditata terpisah tanpa bentrok/overlay; seluruh aset furnitur/agen/pet dilengkapi contact shadow elips lembut (`createSoftContactShadowTexture`), chroma-key ketat (`tol=16` border-only + `agents_cleaned.png` dipulihkan 100% tanpa bagian jas/celana/arcade tembus pandang), dan combo duduk hanya aktif bila cocok dengan furnitur riil di ruangan yang sama (tanpa combo fiktif saat `match === null`).
   - `audio_eq_pad` (`layerBonus: -40`): dipasang di Floor 2 `Studio RAGA` (`u: 0.662, v: 0.368` di depan `studio_desk` `0.715, 0.335`) dan Floor 3 `AudioRoom` (`u: 0.662, v: 0.728`) sehingga selalu ter-render rata lantai di bawah kaki agen tanpa bertumpuk dengan `server_rack`.
   - `molecule_table` Floor 3 Treasury Vault: `u: 0.695, v: 0.362` dengan `server_rack` terpisah di sudut kiri/kanan (`0.635/0.340` dan `0.752/0.352`).
   - `btcVideotron.ts` Floor 3: terpasang di dinding NW `TopLeft` (`u: 0.295, v: 0.239`, data real-only / `BELUM DIAMBIL`, `renderOrder=370` agar tidak tertutup dinding; Fog-of-War sudah tidak aktif).
   - **Central Elevator Doors (`initElevatorDoors`)**: Pintu silver sudah terbake di `Floor_1_pure.jpg` / `Floor_2_pure.jpg`; overlay frame animasi mengikuti alignment terbaru di **Bagian 6** (L1/L3 dua slot SW+SE, L2 hanya slot SW dengan `d.mesh.visible = idx > 0`).
   - **Portal & Nav Thresholds (`floorNavGraph.ts`)**: 10 node `door_*` melewati tengah portal `wall_18`/`wall_19` secara tegak lurus; partisi kaca `wall_09`/`wall_10` digeser bersih dari ambang `BottomDesk`, dan `Bongkar Wall` tidak menyisakan kusen pintu melayang.
   - `STORAGE_FURNITURE_KEY = 'kra_modular_furniture_v10'`, `STORAGE_WALL_KEY = 'kra_modular_walls_v7'`.

---

## 5. Peta File & Endpoint API

### File Utama Aplikasi
- `server/kraServer.mjs` — Middleware API KRA, Skills, Group Chat, Exness Read-Only (`DEMO` & `REAL`), Market Brief, SANDI Analyze, Settings.
- `vite.config.ts` — Mount `createKraApiHandler(process.cwd())` di dev & preview server.
- `src/App.tsx` — Root state, Workspace Mode Switcher (`office` | `content-creator` | `finance`), Binance BTC/USDT WS listener, modal orchestration.
- `src/types/office.ts` — Kontrak tipe TS lengkap (Agen, Pipeline, Exness, Market, Zone).
- `src/data/agentsCatalog.ts` — 11 bot asli KRA + Finance beserta jadwal, persona, traits, skills, & sprite frame.
- `src/data/interactionCombos.ts` — `COMBO_ANIM_LIBRARY`, `AGENT_COMBO_MAP`, dan `resolveAgentFurnitureCombo`.
- `src/data/floorNavGraph.ts` — `FLOOR_NAV_NODES`, `ROOM_DEFINITIONS` (24 ruangan), `ROOM_ZONES` (16 zona sensor), grid 4x4 terkalibrasi.
- `src/data/furnitureCatalog.ts` — katalog furnitur + 71 placement default Floor 1–3 (`DEFAULT_OFFICE_LAYOUT`).
- `src/data/wallsCatalog.ts` — 20 sprite dasar + 64 placement dinding Floor 1–3 (`DEFAULT_WALL_LAYOUT`), tinggi dinormalisasi.
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
- `GET /api/market/btc-live` (Binance REST → Coinbase → CoinGecko; `BELUM DIAMBIL` bila semua gagal)
- `GET /api/settings/status` | `POST /api/settings/save`

---

## 6. Arsitektur Terkini (Commit: 59914b2)
- **Asset Lantai Murni**: `Floor_1_pure.jpg` (Lantai 1 & 3) dan `Floor_2_pure.jpg` (Lantai 2 U-cutout void).
- **Elevator Alignment**:
  - Lantai 1 & 3: Slot 2 pintu SW (u: 0.475, v: 0.582) & SE (u: 0.550, v: 0.582), lebar 0.86.
  - Lantai 2: Slot SW tunggal (u: 0.459, v: 0.556, lebar 0.78), transfer lift via `lift_inside_l`.
- **Modular Wall Layering**:
  - `DEFAULT_WALL_LAYOUT` menggunakan kalibrasi `PX_PER_WORLD = 115.0`.
  - Dinding depan dan partisi kaca dirender terpisah dari alas lantai untuk mendukung dynamic cutaway/peek saat agent lewat di belakangnya (saat ini masih swap tekstur half-wall; opacity penuh tetap roadmap).
  - Fitur "Bongkar Wall" dan Snap to Grid terpasang pada `EditorDrawer`.
  - **Recheck menyeluruh (branch aktif)**: grid Edit Mode dikalibrasi ulang ke grid 4x4 murni (`GRID_ORIGIN_U=0.496`, `GRID_ORIGIN_V=0.119`, `GRID_DU=0.1175`, `GRID_DV=0.108`, `GRID_CELLS=4`, `ISO_WORLD_SLOPE≈0.517`). Seluruh 64 base dinding di-snap ke quarter-cell lalu diproyeksikan ke garis cyan / white-nook yang terukur, sehingga tidak ada tembok tengah yang melayang. 17 sprite dinding reguler dinormalisasi ke `WALL_VISIBLE_HEIGHT = 1.18` world unit; hanya `wall_11`, `wall_15`, `wall_16` (pilar & elevator hub) yang mempertahankan tinggi native.
- **NavGraph & Reachability**:
  - 10 titik pintu arsitektural (`door_*`), 16 `ROOM_ZONES`, dan 24 ruangan terpetakan tanpa menembus dinding atau jatuh ke void Lantai 2.
  - Audit ulang: `64` walls / `71` furniture / `24` rooms / `11` agents; diamond containment `0` violation, BFS `lift_lobby_l` menjangkau semua `navNodeId` di L1/L2/L3, dan jarak maksimum base dinding ke garis lantai hanya `4.1 px` pada render setengah resolusi.
- **Finance Engine (Lantai 3)**:
  - BTC/USDT Videotron terpasang di Market Desk `(1,0)` pada koordinat UV `u=0.295, v=0.239` dengan endpoint `/api/market/btc-live`.
  - Mesh Videotron kini `transparent`, `depthTest: false`, `renderOrder = 370` (di atas seluruh dinding NW ≤ 365, di bawah trophy / meja SANDI / agent), sehingga chart candlestick real-only maupun kartu jujur `BELUM DIAMBIL` tampil kembali dan tidak tertutup dinding.
  - HUD menampilkan harga BTC/USDT, perubahan `%`, sumber feed, jumlah candle, dan status `VIDEOTRON L3` tanpa angka karangan (`BELUM DIAMBIL` sampai data riil masuk).
  - Exness status endpoint `/api/exness/status` terverifikasi via HTTP dan `node exness/bin/exness-readonly.mjs --self-test` (`5/5`).

**Fokus berikutnya (belum dikerjakan pada pembaruan ini)**:
1. Dynamic wall opacity / peek mask penuh saat agent berada tepat di balik `wall_18`/`wall_19` (baru cutaway swap tekstur).
2. Pengujian relay Muse Command (`01 Strategist Prime` → `02 Hook Architect` → `03 Scriptwriter` dst.) untuk memicu pergerakan agent antar-ruangan dan elevator secara live.

---

## 7. Perintah Verifikasi & Pengembangan

```bash
# Typecheck + Build produksi
npm run typecheck && npm run build

# Jalankan server pengembangan (host 0.0.0.0 port 5173)
npm run dev -- --host 0.0.0.0 --port 5173

# Self-test kriptografi Ed25519 & validasi URL Exness read-only
node exness/bin/exness-readonly.mjs --self-test

# Cek endpoint live (dev server 5173)
curl -s http://127.0.0.1:5173/api/market/btc-live
curl -s http://127.0.0.1:5173/api/exness/status
```
