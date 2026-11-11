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
> (sliced floorplate, grid 4x4, **vector wall + depth buffer**, dan Videotron L3) ada di **Bagian 6**.

1. **Multi-Floor 3 Lantai + Central Lift**:
   - Lantai 1 (`Floor_1_sliced.png`): KRA HQ (Boss Office, Boardroom, Open Desks, Espresso Pantry, Studio, Lounge).
   - Lantai 2 (`Floor_2_sliced.png`, U-cutout void): R&D DNA Lab, Molecule QA Lab MEIMEI, Studio RAGA, Shorts Lounge, Restroom.
   - Lantai 3 (`Floor_3_sliced.png`, hasil slicing attachment finance): BTC/USDT Live Videotron (`btcVideotron.ts`), Macro Conference, Exness Pit MAEL, Treasury Vault JARJIT, Voicebox Audio Room.
   - Perpindahan lantai agen selalu berjalan melewati pintu/node `FLOOR_NAV_NODES` menuju `Central Lift` (`lift_lobby_l`/`r`), animasi 4-frame pintu lift, naik/turun antar lantai, lalu menuju ruangan tujuan.
2. **4-Pass Renderer + Pass 5 UI Overlay**:
   - **Pass 1**: Base floor isometric + Floor 3 BTC/USDT Videotron & Exness ticker.
   - **Pass 2**: Y-sorted Furnitur (`32` item katalog), Props animasi, Pets, Agen, dan **Smooth Movement + Seated Combo Swap (`resolveAgentFurnitureCombo`)**:
     - Pergerakan agen dan pet memakai `delta` time, carry-over jarak sudut waypoint, interpolasi eksponensial tahan refresh-rate (`1 - Math.exp(-rate * delta)`), histeresis arah balik horizontal, serta walk-up mulus ke kursi/sofa sebelum bertukar ke sprite kombinasi dari `COMBO_ANIM_LIBRARY` (dengan `cropComboSequence` skala piksel seragam anti-menyusut antar frame) sambil menyembunyikan furnitur statis di bawahnya (`occupiedFurnitureUids`). Kamera follow (`followAgentId`) juga bergerak halus dan otomatis dilepas saat pengguna menggeser kamera.
   - **Pass 3**: **Vector Wall + Depth Buffer** (`96` placement presisi dari `DEFAULT_WALL_LAYOUT` dirender sebagai geometry vektor `vectorWalls.ts`, bukan sprite `walls_spritesheet.png`). Dinding opaque menulis depth per-vertex berdasarkan `isoDepthZ(y)`, sehingga sprite agen / furnitur di belakang dinding otomatis ter-clip GPU dan tidak menembus dinding. Cutaway dinamis untuk perimeter belakang kini menskala geometry ke half-wall (`scale.y = 0.54`), bukan swap tekstur; partisi interior tetap full-height.
   - **Pass 4**: Room occupancy / door sensors (`ROOM_ZONES`, 16 zona; **Fog-of-War UI dan overlay sliding glass door sudah dinonaktifkan**). Portal memakai `wall_18`/`wall_19` tanpa kusen dobel; dukungan opsional `slidingDoor` masih ada di engine tetapi tidak dipakai `ROOM_ZONES` aktif.
   - **Pass 5 (`AgentFloatingBubbles.tsx`, `z-[15]`)**: Nameplate & Task Bubble dirender sub-pixel (`translate3d(..., 1 decimal)`) dengan transisi linear halus di atas seluruh dinding/kabut, mengikuti posisi `renderPos` (anchor combo saat duduk), tidak ada lagi occlusion Fog-of-War, dan di-clamp agar tidak terpotong tepi atas/HUD.
3. **Kalibrasi Koordinat & Bebas-Tumpang-Tindih (Floor 1, 2 & 3)**:
   - Seluruh furnitur di `DEFAULT_OFFICE_LAYOUT` Lantai 1–3 dan titik berdiri `ROOM_DEFINITIONS` ditata terpisah tanpa bentrok/overlay; seluruh aset furnitur/agen/pet dilengkapi contact shadow elips lembut (`createSoftContactShadowTexture`), chroma-key ketat (`tol=16` border-only + `agents_cleaned.png` dipulihkan 100% tanpa bagian jas/celana/arcade tembus pandang), dan combo duduk hanya aktif bila cocok dengan furnitur riil di ruangan yang sama (tanpa combo fiktif saat `match === null`).
   - `audio_eq_pad` (`layerBonus: -40`): dipasang di Floor 2 `Studio RAGA` (`u: 0.662, v: 0.368` di depan `studio_desk` `0.715, 0.335`) dan Floor 3 `AudioRoom` (`u: 0.662, v: 0.728`) sehingga selalu ter-render rata lantai di bawah kaki agen tanpa bertumpuk dengan `server_rack`.
   - `molecule_table` Floor 3 Treasury Vault: `u: 0.695, v: 0.362` dengan `server_rack` terpisah di sudut kiri/kanan (`0.635/0.340` dan `0.752/0.352`).
   - `btcVideotron.ts` Floor 3: kini **standing holo-terminal** di Market Desk `(1,0)` (`u: 0.440, v: 0.380`, podium + contact shadow + layar isometrik + panel samping, data real-only / `BELUM DIAMBIL`, `renderOrder=372`); bukan lagi banner tempelan di dinding NW. Fog-of-War sudah tidak aktif.
   - **Central Elevator Doors (`initElevatorDoors`)**: Pintu silver sudah terbake di `Floor_*_sliced.png`; overlay frame animasi mengikuti alignment terbaru di **Bagian 6** (L1/L3 dua slot SW+SE, L2 hanya slot SW dengan `d.mesh.visible = idx > 0`).
   - **Portal & Nav Thresholds (`floorNavGraph.ts`)**: 10 node `door_*` melewati tengah portal `wall_18`/`wall_19` secara tegak lurus; partisi kaca `wall_09`/`wall_10` digeser bersih dari ambang `BottomDesk`, dan `Bongkar Wall` tidak menyisakan kusen pintu melayang.
   - `STORAGE_FURNITURE_KEY = 'kra_modular_furniture_v10'`, `STORAGE_WALL_KEY = 'kra_modular_walls_v11'` (naik versi agar layout vektor + `segmentId` baru tidak tertimpa localStorage lama).

---

## 5. Peta File & Endpoint API

### File Utama Aplikasi
- `server/kraServer.mjs` — Middleware API KRA, Skills, Group Chat, Exness Read-Only (`DEMO` & `REAL`), Market Brief, SANDI Analyze, Settings.
- `vite.config.ts` — Mount `createKraApiHandler(process.cwd())` di dev & preview server.
- `src/App.tsx` — Root state, Workspace Mode Switcher (`office` | `content-creator` | `finance`), Binance BTC/USDT WS listener, modal orchestration.
- `src/types/office.ts` — Kontrak tipe TS lengkap (Agen, Pipeline, Exness, Market, Zone).
- `src/data/agentsCatalog.ts` — 11 bot asli KRA + Finance beserta jadwal, persona, traits, skills, & sprite frame.
- `src/data/interactionCombos.ts` — `COMBO_ANIM_LIBRARY`, `AGENT_COMBO_MAP`, dan `resolveAgentFurnitureCombo`.
- `src/data/floorNavGraph.ts` — `FLOOR_NAV_NODES`, `ROOM_DEFINITIONS` (24 ruangan), `ROOM_ZONES` (16 zona sensor), grid 4x4 terkalibrasi, `isoDepthZ()` / `ISO_DEPTH_K` untuk registrasi koordinat floor↔wall↔sprite.
- `src/data/furnitureCatalog.ts` — katalog furnitur + 71 placement default Floor 1–3 (`DEFAULT_OFFICE_LAYOUT`).
- `src/data/wallsCatalog.ts` — 20 sprite dasar hasil **alpha auto-bbox scan** + 96 placement presisi Floor 1–3 (`DEFAULT_WALL_LAYOUT`), `PRECISE_TILE_SEGMENTS`, `WALL_WIDTH`; dipakai sebagai **data jalur / lebar** untuk geometry vektor, bukan lagi tekstur dinding runtime.
- `src/game/OfficeEngine.ts`, `vectorWalls.ts`, `spriteLoader.ts`, `btcVideotron.ts`, `exnessTicker.ts`.
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

## 6. Arsitektur Terkini (Commit: HEAD branch aktif)
- **Asset Lantai Hasil Slicing**: `Floor_1_sliced.png`, `Floor_2_sliced.png`, `Floor_3_sliced.png`. Ketiganya dipotong dari attachment `floor_1_base / floor_2_expansion / floor_3_finance` dengan membuang piksel dinding dan mempertahankan garis cyan asli; area yang tertutup dinding diisi dari pure floorplate yang **sudah teregistrasi** pada UV yang sama (`uvToWorld`, 16x9). F2 memakai ulang material ubin ringan pada sayap kanan bawah; F3 kini mengikuti layout finance asli (ubin abu di Market Desk, kayu di Audio Booth, checker di lounge kanan, bukan lagi meminjam wood/checker F1). Karena slicing tetap memakai kanvas UV 16x9 yang sama, `ROOM_ZONES`, `DEFAULT_OFFICE_LAYOUT`, `DEFAULT_WALL_LAYOUT`, portal, elevator, dan nav node tidak perlu digeser; audit registrasi tetap menjadi syarat terima.
- **Elevator Alignment**:
  - Lantai 1 & 3: Slot 2 pintu SW (u: 0.475, v: 0.582) & SE (u: 0.550, v: 0.582), lebar 0.86.
  - Lantai 2: Slot SW tunggal (u: 0.459, v: 0.556, lebar 0.78), transfer lift via `lift_inside_l`.
- **Modular Wall Layering**:
  - `DEFAULT_WALL_LAYOUT` memakai kalibrasi sprite `PX_PER_WORLD = 118.0`, sehingga **Top Alignment Cap `WALL_TOP_CAP_PX = 136` px ≈ `WALL_VISIBLE_HEIGHT = 1.15` world unit** berlaku identik untuk kaca, kayu, gelap, portal, dan pilar. Tidak ada lagi normalisasi tinggi per-sprite `1.18` yang membengkokkan kemiringan atap isometrik.
  - **Border Wall Harmonization**: `makeBox()` memotong bbox di `anchorY - 136` dan `spriteLoader.ts` menggambar bbox terpotong apa adanya; `topAlignOffset` menerjemahkan (bukan menskala) puncak art tiap sprite ke satu garis cap. `projectToPerimeter(floor,u,v,side)` mengunci semua base dinding luar ke sisi NW `v = m·u + c_NW` / NE `v = -m·u + c_NE` dari `OUTER_PERIMETER_SEGMENTS` (L1/L3 diamond murni, L2 poligon U-cutout). White Nook dan kedua sayap memakai urutan kaca paksa yang dicerminkan: F1/F3 `wall_02, wall_09, wall_02, wall_02, wall_02, wall_02`, F2 `wall_02, wall_05, wall_02, wall_10`; lebar modul identik kiri/kanan dan blok gelap masif tidak lagi menggantikan kaca perimeter. Kalibrasi cap ini kini menjadi **metadata lebar/tinggi** untuk geometry vektor, bukan tekstur mesh runtime.
  - `OfficeEngine.ts` memberi `perimeterIndex` deterministik (urut belakang→depan per sisi) ke `calcRenderOrder(footY, offset)`, menyimpannya di localStorage, dan menaikkan `STORAGE_WALL_KEY` ke `v11` agar layout lama tidak menimpa kalibrasi baru. `perimeterIndex` juga menandai perimeter untuk kaca + dynamic cutaway.
  - **Rebuild Presisi (pembaruan branch aktif)**: `WALL_BBOXES` tidak lagi diketik tangan. Script offline memindai alpha `public/assets/walls_spritesheet.png` (`1417x1029`) dengan connected-component 8-neighbour, menggabungkan pulau yang terpisah (kusen pintu `wall_12`), memetakan 21 pulau ke 20 ID katalog, lalu memotong / menambah baris transparan di atas setiap sprite supaya baseline art tepat `136 px` di bawah cap. `WALL_SHEET_W/H`, `WALL_WIDTH`, dan `PRECISE_TILE_SEGMENTS` diekspor untuk audit dan untuk pembentukan geometry vektor. `spriteLoader.ts` tetap memuat sheet hanya untuk thumbnail / katalog Editor; mesh dinding runtime sudah tidak memakai tekstur sprite.
  - **Tiling tanpa t aproksimasi + interior terukir**: `fitTileSequence()` memakai DP atas lebar world riil tiap modul; `placeTiles()` menaruh modul pada jarak kumulatif `ΣworldW`, bukan lerp `t` manual. `computeSpecGeometry()` memindai footprint elevator / void L2 dan membagi tiap divider menjadi `spans` yang benar-benar boleh berisi dinding, dengan `PRECISE_CARVED_INTERVALS` + `PRECISE_MIN_TILE_SPAN = 0.80` supaya sisa potongan < 0.80 world tidak diisi panel melayang. Palet interior hanya modul arsitektural netral (`wall_02/07/08/05/14/03/04`), bukan `wall_12/13/17` (pintu) atau kaca tunggal `wall_09/10` kecuali sebagai filler berpenalti tinggi. Semua placement `precise: true`; `snapWallLayout()` melewati quarter-cell grid. Kedua sayap memakai urutan modul identik; selisih panjang U-cutout L2 didistribusikan sebagai seam overlap/gap `≤ 0.09` world unit. Portal `wall_18`/`wall_19` tetap di koordinat nav-node eksak.
  - **Vector Wall / Depth Integration (fokus hari ini)**: `src/game/vectorWalls.ts` membangun `BufferGeometry` parallelogram dari `segmentId` + `WALL_WIDTH` + `WALL_VISIBLE_HEIGHT` pada koordinat `uvToWorld` yang sama dengan lantai. Opaque wall `depthWrite: true`, glass perimeter `depthWrite: false`, semua sprite `depthTest: true` / `depthWrite: false`, dan `isoDepthZ(y)` memberi Z isometrik per-vertex (`ISO_DEPTH_K = 0.15`). Hasilnya sprite tidak lagi menembus dinding; uji matikan `depthTest` pada 161 sprite menunjukkan ~142 ribu piksel sprite yang memang tertutup dinding saat depth aktif. Uji terarah dari WebGL live: satu `bookshelf_plant` sengaja ditempatkan di belakang `wall_03` / `f1-d1`, lalu `depthTest` dinyalakan/dimatikan hanya pada sprite itu — `renders/occlusion-on.png` vs `renders/occlusion-off.png` (zoom: `occlusion-on-zoom.png` / `occlusion-off-zoom.png`) berbeda 15.277 piksel, dan bagian rak/daun yang menembus dinding hanya muncul saat depth dimatikan. `walls_spritesheet.png` tersisa hanya untuk thumbnail katalog Editor, bukan mesh dinding runtime.
  - Dinding depan dan partisi kaca dirender terpisah dari alas lantai. Partisi interior vektor sengaja **solid / full-height** agar garis dinding tetap rapi; dynamic cutaway/peek hanya berlaku bagi perimeter belakang yang memiliki `perimeterIndex`, dengan cara menskala geometry (`scale.y = 0.54`) bukan swap tekstur half-wall.
  - Fitur "Bongkar Wall" dan Snap to Grid terpasang pada `EditorDrawer`.
  - **Recheck menyeluruh (branch aktif)**: grid Edit Mode tetap terkalibrasi 4x4 murni (`GRID_ORIGIN_U=0.496`, `GRID_ORIGIN_V=0.119`, `GRID_DU=0.1175`, `GRID_DV=0.108`, `GRID_CELLS=4`, `ISO_WORLD_SLOPE≈0.517`) untuk mode edit; layout default presisi tidak lagi di-snap ke quarter-cell. 17 modul dinding reguler memakai satu skala px→world `118` dan cap `1.15` world unit sebagai lebar/tinggi vektor; hanya `wall_11`, `wall_15`, `wall_16` (pilar & elevator hub) yang mempertahankan tinggi native pada data katalog.
- **Registrasi Koordinat Floor ↔ Wall (rombak ulang)**: attachment full-with-walls dipotong menjadi floor-only, lalu jalur dinding asli dipetakan ulang dari `PRECISE_TILE_SEGMENTS` / `DEFAULT_WALL_LAYOUT` memakai `uvToWorld()` yang sama dengan `mapPlane` 16x9. `isoDepthZ(y)` menerjemahkan world-Y ke Z kamera orthographic, jadi koordinat lantai, dinding vektor, furnitur, agen, dan terminal BTC berada dalam satu ruang depth yang konsisten. Tidak ada lagi sprite yang menggantung di depan dinding hanya karena `renderOrder`.

- **NavGraph & Reachability**:
  - 10 titik pintu arsitektural (`door_*`), 16 `ROOM_ZONES`, dan 24 ruangan terpetakan tanpa menembus dinding atau jatuh ke void Lantai 2.
  - Audit ulang setelah perapian interior: `96` walls / `71` furniture / `24` rooms / `11` agents; **96/96 placement `precise`**, portal tetap `7/5/7` (F1/F2/F3) tepat pada nav-node. Diamond containment `0`, F2 U-cutout void `0`, BFS `lift_lobby_l` menjangkau semua `navNodeId` L1/L2/L3, jarak maksimum base ke garis lantai terdaftar `0.1 px` (`0` di atas 12 px), offset perimeter `0`, indeks render deterministik `0` violation, lebar modul NW/NE tercermin `0` violation, 6/6 segmen outer gapless (`max gap 0.060`, `max overlap 0.086` world), 33 span interior yang diizinkan gapless (`max gap 0.108`, `max overlap 0.105`, `0` violation), overlap interior `0`, error skala seragam `0.0056`, dan error band cap 136 px `0.0001`.
- **Finance Engine (Lantai 3)**:
  - BTC/USDT Market Desk `(1,0)` memakai endpoint `/api/market/btc-live`; versi lama `u=0.295, v=0.239` adalah banner dinding NW dan sudah digantikan.
  - `btcVideotron.ts` sekarang **gadget lantai berdiri**: anchor UV `(0.440, 0.380)`, layar utama sheared ~45° iso, podium/kiosk, `createSoftContactShadowTexture()`, dua panel holo samping, emitter, `transparent` + `depthTest: true` + `isoDepthZ(..., 6)` + `renderOrder = 372`. Menyembunyikan root mesh otomatis menyembunyikan seluruh child rig.
  - HUD duplikat `VIDEOTRON L3` dihapus; tersisa **satu** indikator ringkas `BTC/USDT: {btcStatusText}` tanpa angka karangan (`BELUM DIAMBIL` sampai data riil masuk).
  - Exness status endpoint `/api/exness/status` terverifikasi via HTTP dan `node exness/bin/exness-readonly.mjs --self-test` (`5/5`).
- **Matriks Partisi Interior (pembaruan branch aktif)**:
  - `DEFAULT_WALL_LAYOUT` menghasilkan rentang panel framed `wall_02/07/08/05/14/03/04` + portal `wall_18`/`wall_19` di kedua arah diagonal SW↔NE dan NW↔SE, menutup celah Boardroom↔koridor, Boss/Wood↔koridor, Server/Lounge↔koridor, serta Lab/RnD L2↔koridor sampai pilar elevator pusat. Interval elevator / void dipotong eksplisit, jadi tidak ada kusen atau kaca yang menggantung di tengah ruangan.
  - Semua panel interior reguler kini berupa **vektor solid** setinggi `WALL_VISIBLE_HEIGHT = 1.15` dan full-height, sehingga puncaknya sejajar kusen pintu tanpa jarak kosong / potongan cutaway yang melayang; kaca tembus pandang hanya dipakai pada perimeter yang memiliki `perimeterIndex`.
  - 10 node `door_*` kini punya tepat satu frame `wall_18`/`wall_19` di koordinat nav-node eksak (F1/F3: 7, F2: 5); entry portal lerp yang dobel sudah dihapus, sehingga tidak ada "tiang gantung" di mulut pintu.
  - `FLOOR_BORDER_SEGMENTS` kini mendaftarkan garis divider interior + stub portal `door_*`; `projectUVToBorder()` tidak lagi menarik panel menjauh dari garis lantai, dan audit F2 memakai poligon U-cutout cekung eksplisit (bukan union `ROOM_ZONES`).

- **Bukti Render Runtime (rombak vektor)**: Screenshot WebGL asli diambil dari preview `0.0.0.0:4173` memakai Chromium headless (`@sparticuz/chromium` + `puppeteer-core`, SwiftShader) pada `1440x900`, bukan komposit ImageMagick. Hasil aktif: `renders/vector-f1.png`, `renders/vector-f2.png`, `renders/vector-f3.png` (floor slicing + dinding vektor + depth occlusion) serta pasangan uji oklusi `renders/occlusion-on.png` / `renders/occlusion-off.png` dan zoom-nya. Arsip render sprite sebelumnya tetap ada di `renders/wall-render-f{1,2,3}.png`. Semua memperlihatkan perimeter kaca simetris, divider interior vektor solid, portal `7/5/7`, terminal BTC F3 berdiri, dan HUD `BELUM DIAMBIL` tanpa angka karangan.

**Fokus berikutnya (belum dikerjakan pada pembaruan ini)**:
1. Dynamic wall opacity / peek mask penuh saat agent berada tepat di balik portal `wall_18`/`wall_19` (baru scale cutaway vektor).
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
