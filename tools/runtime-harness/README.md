# KRA Runtime Harness

Uji runtime backend PHP **sungguhan** (PHP 8.3 via WebAssembly,
[`@php-wasm/node`](https://www.npmjs.com/package/@php-wasm/node)) tanpa perlu
menginstal PHP/MySQL. Runtime WASM memakai filesystem host apa adanya, jadi
kode yang diuji adalah file repo ini persis.

## Cara menjalankan

```bash
cd tools/runtime-harness
npm install --ignore-scripts @php-wasm/node   # sekali saja (±40 MB, tidak di-commit)
VITEST=1 node run.mjs            # 31 pengujian: skill pack, Telegram, fan-out, analytics
VITEST=1 node run.mjs lint.php   # lint parser PHP asli untuk semua file api/*.php
node e2e-bridge.mjs              # bridge HTTP→MCP terhadap fake-concat-mcp (tanpa @php-wasm)
```

`VITEST=1` diperlukan agar loader memberi processId default (di luar mode
test, php-wasm mengharuskan orkestrasi worker sendiri).

## Apa yang diuji (test.php)

| Grup | Isi |
| --- | --- |
| Skill Pack | `digest()` menyuntikkan kutipan aturan, pemaksaan `/creator-...`, katalog 11 skill creator approved tanpa drift hash |
| Telegram | validasi token BotFather, webhook secret (hash_equals), pairing sekali-pakai + replay ditolak, chat asing/grup diabaikan, setWebhook wajib HTTPS, rotasi secret hanya tersimpan setelah diterima Telegram |
| Proposal | `propose()` → callback Telegram dari chat asing ditolak, dari pemilik terproses, duplikat aman |
| Analytics | `status()` mengekspos `analyticsGranted`; `analyticsSummary()` tanpa channel memberi error yang jelas |
| Fan-out | `dispatch(fanout)` tepat 1 recipient + `routing.skills` efektif; tanpa fanout grup tetap 4; specialist Creator ditolak di channel Office |

## Batasan jujur

- Runtime ini **tanpa rute jaringan** ke Telegram/Google: panggilan keluar
  berhenti di transport (persis seperti diuji — harus gagal-soft, tidak fatal).
  Uji dengan **token asli tetap di mesin pemilik** (langkah di
  `docs/TELEGRAM-INTEGRATION.md` & `docs/YOUTUBE-INTEGRATION.md`).
- Tanpa MySQL: `KraDb` jatuh ke fallback JSON (perilaku produksi desktop).
- `run.mjs` membuat `api/config.json` sementara (provider `ollama` tak
  terjangkau) dan **mengembalikannya seperti semula**; `.temp/tasks.json`
  juga di-backup/restore. Config integrasi diarahkan ke `/tmp/kra-test-config`.
