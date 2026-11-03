# dsh-superagent-intern — provenance model KRA

Satu **model agen** (bukan LLM) untuk anak magang KRA, diadaptasi dari prototipe
riset [deepseek-ai/dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype).

| Fakta | Nilai |
| --- | --- |
| Repo upstream | `deepseek-ai/dsh-superagent-prototype` (public) |
| Branch | `main` |
| Commit dipin | `6337fc823ce20251c8de8085948165c81aaa701e` (`feat: add the dsh-superagent research prototype`) |
| Versi upstream | `0.1.0` |
| Lisensi | MIT (salinan di `LICENSE`) |
| Tanggal bundle | 2026-11-03 |

## Yang dibundel

- `PHILOSOPHY.md` — salinan `docs/000-philosophy.md`: prinsip *take as little
  human attention as possible, give as much value as possible*.
- `prompts/` — 15 berkas prompt upstream (`admission`, `dispatch`,
  `orchestrator`, `worker`, `work`, `replies`, `shared`, `handoff*`,
  `subscriptions`, `cli`, `team/*`) sebagai **referensi desain** untuk
  menyusun sistem prompt agen KRA.
- `MODEL.md`, `model.json` — adaptasi KRA (baru, bukan karya upstream).

## Yang sengaja TIDAK dibundel

- `src/` (TypeScript), `pnpm-lock.yaml`, `cordis.patch.yml`, `scripts/`,
  `docs/001-008`, `SETUP.md`, `locale/`. Runtime upstream membutuhkan **DeepSeek
  Harness (DSH)**, Node 22.19+, pnpm, tmux, `gh` CLI, GitHub/Feishu, dan profil
  DSH khusus — tidak bisa dan tidak perlu dijalankan di dalam KRA (PHP).
- Kode upstream adalah **research prototype, bukan produk resmi DeepSeek** dan
  bukan perangkat lunak produksi. Kutipan dari README-nya: *"Treat it as research
  code, not production-ready software."*

## Cara KRA memakainya

KRA memakai **filosofi + disiplin prompt**-nya sebagai spesifikasi perilaku satu
agen magang bernama **Dira** (`agents/dira.agent.json`,
`api/lib/KraAgentChat.php` persona `dira`). Tidak ada proses eksternal, tidak ada
akses GitHub/Feishu otomatis, tidak ada `git push`/auto-merge. Semua pekerjaan
Dira berupa **draft/jawaban chat** yang tetap melalui approval gate KRA dan
pengawasan Rama. Detail di [`MODEL.md`](MODEL.md) dan
[`docs/INTERN-SUPERAGENT.md`](../../docs/INTERN-SUPERAGENT.md).

Saat memperbarui: pin commit baru di sini, salin ulang `prompts/` +
`PHILOSOPHY.md`, lalu jalankan `npm run verify:intern-agent`.
