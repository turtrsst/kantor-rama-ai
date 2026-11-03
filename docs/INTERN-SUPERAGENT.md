# Anak Magang KRA: Dira (Super-Agent Intern)

Satu **model agen** baru di project KRA, diadaptasi dari prototipe riset
[`deepseek-ai/dsh-superagent-prototype`](https://github.com/deepseek-ai/dsh-superagent-prototype)
`main` @ `6337fc823ce20251c8de8085948165c81aaa701e`.

> ⚠️ Prototipe upstream adalah **research code, bukan produk resmi DeepSeek**
> dan bukan perangkat lunak produksi. Yang dibawa ke KRA hanyalah **filosofi
> kerja + disiplin prompt**-nya. Runtime DeepSeek Harness (DSH), watcher
> GitHub/Feishu, tmux, dan `gh` CLI **tidak** dijalankan di sini.

---

## 1. Apa yang dimaksud "1 model"

| Istilah | Di KRA |
| --- | --- |
| Model | [`models/dsh-superagent-intern/model.json`](../models/dsh-superagent-intern/model.json) — *agent model pack*: manifest + filosofi + 15 prompt referensi + adaptasi KRA. **Bukan** LLM dan **bukan** provider baru. |
| Agen | **Dira**, anak magang di Virtual Office (Desk 06, Innovation Studio, Floor 2). |
| Otak | Provider AI KRA yang sedang aktif (`ollama`, `rna-router`, dll.) — sama seperti agen lain. Model pack hanya mengatur **perilaku & batas wewenang**. |

Jadi bila nanti Anda mengganti provider di dropdown KRA, Dira ikut memakai
provider itu; perilakunya tetap mengikuti model pack ini.

## 2. Berkas yang ditambahkan

| Berkas | Isi |
| --- | --- |
| `models/dsh-superagent-intern/UPSTREAM.md` | Pin commit, lisensi MIT, daftar yang dibundel/tidak dibundel. |
| `models/dsh-superagent-intern/PHILOSOPHY.md` | Salinan `docs/000-philosophy.md`: *take as little human attention as possible, give as much value as possible*. |
| `models/dsh-superagent-intern/prompts/` | 15 prompt upstream sebagai referensi desain (admission, dispatch, orchestrator, worker, work, replies, handoff, team/*, …). |
| `models/dsh-superagent-intern/MODEL.md` | Terjemahan konsep upstream → KRA, persona, guardrails, cara pakai. |
| `models/dsh-superagent-intern/model.json` | Manifest: id, versi, sumber, kapabilitas, guardrails, daftar prompt. |
| `agents/dira.agent.json` | Spesifikasi agen KRA (format sama dengan `agents/*.agent.json`). |
| `agents/Dira.md` | Dossier kantor: persona, aturan kerja, larangan, cara interaksi. |
| `api/lib/KraAgentRegistry.php` | Entri `intern` (id `intern`, nama `Dira`, `supervised: true`, `reportsTo: rama`). |
| `api/lib/KraAgentChat.php` | Persona `dira` + routing `@dira` di kanal Team. |
| `web/app.js`, `web/index.html`, `web/ui_refresh.css` | Agen ke-7 di peta kantor, tab chat `Dira`, placeholder, avatar inisial. |
| `tools/verify-intern-agent.js` | Verifikasi struktur, guardrail, dan wiring. |

## 3. Prinsip kerja

1. **Bertindak hanya bila diminta** — tab `Dira` atau `@dira`. Tidak ada job
   otonom, tidak ada watcher eksternal.
2. **Bicara hanya bila ada hasil atau keputusan** — konfirmasi sekali, diam saat
   bekerja, lapor singkat.
3. **Satu pertanyaan konkret per giliran**, bukan laporan panjang.
4. **Berhenti pada dampak** — draft yang *reviewable*, bukan volume pekerjaan.
5. **Lapor jujur** — draft ditandai belum selesai, gagal ditulis gagal, batas
   wewenang tidak pernah dilewati diam-diam.

## 4. Guardrails (penting)

| ❌ Dilarang | ✅ Yang benar |
| --- | --- |
| `git push`, `commit`, buka PR, auto-merge | Serahkan draft ke Rama lewat approval gate |
| Upload YouTube / jalankan N100N / ubah server | Handoff ke spesialis (Budi/Maya/Dimas/Siti) |
| Akses GitHub/Feishu, simpan kredensial | Jawab hanya di channel KRA |
| Mengaku "sudah selesai / sudah diuji" | Tandai **draft**, sebut satu langkah berikutnya |
| Menjawab atas nama supervisor | Sebut pemilik keputusan secara eksplisit |

Ini sengaja lebih ketat dari prototipe aslinya: di upstream agen bisa membuka
PR dan mengirim pesan atas nama akun tim. Di KRA, **magang tidak punya
wewenang tulis**.

## 5. Cara pakai

- Buka **Virtual Office** → tab chat **Dira** (ikon topi wisuda), atau ketik
  `@dira …` di kanal **Team**.
- Klik kartu **Dira** di roster untuk memfokuskan kamera ke **Floor 2**.
- Contoh permintaan:
  - *"Dira, ringkas risiko dari perubahan ini dalam 3 poin, tandai sebagai draft."*
  - *"Dira, susun checklist handoff ke Dimas, satu pertanyaan kalau ada yang kurang."*
- Cek registry: `api/index.php?action=agents` → entri `intern`.

## 6. Publish

Masuk PR yang menargetkan branch deploy
**`arena/cbf4b10e-kantor-rama-ai`**. Setelah merge, PHP built-in server langsung
membaca `api/` + `web/` baru; tidak ada service tambahan yang perlu
dinyalakan untuk Dira. Bila halaman KRA di-cache, refresh dengan `Ctrl+F5`
(cache key `app.js` / `ui_refresh.css` sudah dinaikkan).

## 7. Verifikasi

```bash
npm run verify:intern-agent     # struktur model + wiring agen + guardrails
npm run verify:colony           # peta kantor tetap valid dengan 7 agen
npm run verify:chat-modes       # routing chat tidak berubah
php -l api/lib/KraAgentRegistry.php api/lib/KraAgentChat.php
```

Saat memperbarui model pack dari upstream: pin commit baru di `UPSTREAM.md`
dan `model.json`, salin ulang `prompts/` + `PHILOSOPHY.md`, lalu jalankan
`npm run verify:intern-agent`. Jangan menyalin `src/` atau konfigurasi DSH.
