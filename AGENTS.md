# AGENTS.md — Kantor Rama AI (KRA) Webapp

> Aturan proyek untuk agen AI & developer di repository `kantor-rama-ai`.
> Diperbarui menyesuaikan arsitektur aktif: **Vite + React + TypeScript + Tailwind + Three.js + Node ESM (`server/kraServer.mjs`)**.

---

## 1. Ringkasan Proyek

- **Aplikasi**: Kantor Rama AI (KRA) — Virtual Office 2.5D isometrik ala RimWorld dengan 3 lantai, Central Lift aktif, Room Fog-of-War, Dynamic Wall Cutaway, Seated Furniture Combo, Group Chat KRA, Content Creator Pipeline, dan Divisi Finance Standalone (Exness Read-Only).
- **Pemilik**: Yang Mulia (Alfa).
- **Motto**: *"kita adalah pemimpi di hidupnya masing-masing"* — Yang Mulia.
- **Sumber Kebenaran Agen & Skill**:
  - `agents/kra-agents.json`, `agents/*.json`, `agents/personas/*.md` (8 agen inti KRA)
  - `finance/{sandi,mael,jarjit}.json` (3 agen Finance standalone)
  - `skills/` (54 skill, `skills/manifest.json`) & `skills-extra-meimei/` (`video-qa`, `media-analysis`, `video-shot-breakdown`)
  - `exness/` (`exness/bin/exness-readonly.mjs`, `exness/CONNECTOR.md`)
  - `MEMORY.md` & `docs/finance-phase.md`

---

## 2. Pembagian Tim & Hierarki

- **8 Agen Inti Kantor KRA (Group Chat `"Kantor KRA"`, Lantai 1 & 2)**:
  - **RAMA** (`rama`, emas) — Boss/Leader → lapor ke Yang Mulia.
  - **MARTA / ASBOS** (`marta`, merah) — Asisten Boss (perempuan), kejar tugas & motivasi staf.
  - **NARA** (`nara`, biru) — Senior Programmer & Security Auditor.
  - **PUTRI** (`putri`, pink) — Script Writer (wajib Approval Gate Yang Mulia).
  - **RAGA** (`raga`, hijau) — Video Editor, Motion & Voicebox (Remotion khusus Yang Mulia).
  - **MEIMEI** (`meimei`, teal) — QA Gate (`PASS` / `REVISE` sebelum masuk ARUNA).
  - **ARUNA** (`aruna`, oranye) — Packaging, SEO & Siap Terbit (tunggu kredensial YouTube).
  - **FIZI** (`fizi`, lime) — Community & Support.
- **3 Agen Divisi Finance Standalone (Lantai 3 — TIDAK masuk Group Chat KRA)**:
  - **SANDI** (`sandi`) — Analisa market, watchlist, thesis, kalkulator sizing (no order, no financial advice).
  - **MAEL** (`mael`) — Treasury & Risk Guard + Exness Read-Only (`DEMO` & `REAL`).
  - **JARJIT** (`jarjit`) — Airdrop Hunter & Monetisasi (zero fake listing, wajib URL HTTPS resmi + catatan risiko).

---

## 3. Aturan Keras Proyek

1. **PUTRI Approval Gate tidak boleh dilewati**: Tugas di `PipelineBoardModal` tidak boleh berpindah ke `RAGA` sebelum disetujui Yang Mulia.
2. **MEIMEI QA Gate tidak boleh dilewati**: Hasil edit `RAGA` wajib `PASS` di `MEIMEI` sebelum masuk tahap `Siap Terbit` (`ARUNA`).
3. **Remotion khusus Yang Mulia**: Jangan klaim atau redistribusikan 13 skill `remotion-*` / `viral-script-architect` ke publik.
4. **Zero Fake Data**: Jangan pernah mengarang harga BTC/saldo Exness/statistik YouTube/daftar airdrop/tugas awal. Gunakan `BELUM DISET` / `BELUM DIAMBIL` atau array kosong `[]`.
5. **Exness Read-Only Mutlak**:
   - Semua request Exness wajib lewat `server/kraServer.mjs` dengan HTTP **`GET`** saja.
   - Dilarang membuat tombol, form, atau endpoint `BUY`/`SELL`/`CLOSE`/`POST` order ke Exness.
6. **Keamanan Rahasia**:
   - Jangan hardcode API key / Ed25519 private key di kode, browser `localStorage`, atau Git commit.
   - Server menyimpan rahasia hanya di `.kra-secrets.json` & `.kra-env.local` (`chmod 0600`, masuk `.gitignore`).
   - Jangan tulis ke root `.env.local` secara runtime dari API handler agar Vite dev server tidak restart saat user menyimpan kredensial.
7. **Persona Konsisten**: Agen KRA memanggil pemilik `"Yang Mulia"`, membalas dalam Bahasa Indonesia sesuai karakter di `agents/personas/*.md`.
8. **Git Branch**: Selalu bekerja di branch aktif sesi (`arena/74afbde3-kantor-rama-ai`) dan jangan berpindah branch.

---

## 4. Check Sebelum Commit / Push

```bash
npm run typecheck && npm run build
node exness/bin/exness-readonly.mjs --self-test
git status -s
```
Pastikan tidak ada file `.env`, `.kra-secrets.json`, `.kra-env.local`, atau `exness/.access-point*.json` yang ikut ter-stage!
