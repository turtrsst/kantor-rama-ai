# kra-concat-bridge

Jembatan HTTP → MCP(stdio) agar workflow **n100n** (dan KRA lewat n100n)
bisa menggerakkan **Concat** — editor video open-source pengganti CapCut
(source-nya dibundel di folder `concat/` repo ini) — untuk editing otomatis:
buat proyek, impor media, susun klip, beri judul/caption, lalu export.

```
KRA ──► n100n workflow ──► POST /call ──► bridge ini ──► stdio MCP ──► concat --mcp headless
```

## Jalankan

Prasyarat: Node.js ≥ 18 dan binary Concat (rilis resmi, atau build dari
source `concat/`). Tanpa `npm install` apa pun.

```bat
set CONCAT_BIN=C:\Program Files\Concat\concat.exe
set BRIDGE_TOKEN=<token-acak-panjang>
node tools\kra-concat-bridge\server.js
```

| Env | Default | Keterangan |
|---|---|---|
| `BRIDGE_PORT` | `5681` | Port HTTP bridge |
| `BRIDGE_HOST` | `127.0.0.1` | Bind address (biarkan loopback) |
| `BRIDGE_TOKEN` | *(kosong)* | Bila diisi, request wajib header `x-api-key` |
| `CONCAT_BIN` | `concat` | Path binary Concat |
| `CONCAT_MCP_MODE` | `headless` | `headless` (tanpa jendela), `window` (lewat UI yang terbuka + Automation aktif), atau `auto` |
| `CONCAT_CALL_TIMEOUT_MS` | `600000` | Timeout per panggilan tool |
| `CONCAT_MCP_ROOTS` | — | Folder di luar home yang boleh ditulis Concat headless (`;` di Windows) |

Concat headless hanya menulis di bawah folder home pengguna. Bila proyek /
export mau ditaruh di folder proyek KRA (mis. `n100n/files`), tambahkan folder
itu ke `CONCAT_MCP_ROOTS` saat menjalankan bridge.

## API

```bash
curl http://127.0.0.1:5681/health
curl http://127.0.0.1:5681/tools
curl -X POST http://127.0.0.1:5681/call -H 'Content-Type: application/json' \
  -d '{"tool":"concat_version","arguments":{}}'
```

Balasan `/call`: `{ ok, isError, data, content }` — `data` adalah
`structuredContent` MCP Concat (bentuk persis seperti yang dilihat AI agent
lewat MCP langsung). Tool yang tersedia dan skema argumennya bisa dilihat dari
`GET /tools` (dihasilkan Concat dari tipe API-nya sendiri).

## Dari n100n

Pakai node **http** ke `{{ $env.KRA_CONCAT_BRIDGE_URL || 'http://127.0.0.1:5681' }}/call`
dengan body `{ tool, arguments }`. Contoh lengkap siap jalan:
`n100n/workflows/contoh-concat-edit.json` (ter-seed otomatis saat database
n100n masih kosong). Panduan: `docs/CONCAT-INTEGRATION.md`.

## Uji tanpa Concat asli

`fake-concat-mcp.js` adalah tiruan kecil server MCP Concat untuk menguji
bridge + workflow end-to-end:

```bash
printf '#!/bin/sh\nexec node %s/fake-concat-mcp.js "$@"\n' "$PWD/tools/kra-concat-bridge" > /tmp/fake-concat
chmod +x /tmp/fake-concat
CONCAT_BIN=/tmp/fake-concat node tools/kra-concat-bridge/server.js
```
