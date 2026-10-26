# Phase 2: LLM Chat Integration Design

## Intent

Jadikan chat agen KRA memakai 9Router sebagai provider utama yang terukur dan aman. Saat provider gagal, KRA tetap memberi jawaban melalui simulator. Tidak ada perubahan desain visual, asset, CSS, Canvas, atau `web/`.

## Current State

- Provider default: `9router`, model `my-combo`, endpoint `http://127.0.0.1:20128/v1`.
- 9Router health: online.
- Ollama `11434`: offline dan belum diinstall.
- `chat-agent` memakai `KraAgentChat::dispatch()`.
- `KraAgentChat` saat ini memanggil `KraRouterGateway::complete()` langsung lalu fallback role-based simulator dalam `catch`.
- Gateway sudah punya `completeWithFallback()`, tetapi chat belum memakainya.
- Chat response sudah memuat `provider` dan `model`; belum memuat apakah fallback dipakai atau daftar provider attempts.

## Goal

1. Pesan satu-agen memakai `KraRouterGateway::completeWithFallback()`.
2. Respons chat memuat metadata aman: `provider`, `model`, `fallbackUsed`, `fallbackProvider`, `attempts`.
3. Tidak ada API key, header Authorization, atau nilai environment provider dalam respons, history chat, maupun log verifier.
4. Pesan kosong tetap ditolak.
5. Bila 9Router gagal, rantai `9router -> ollama -> simulator` berakhir dengan simulator tanpa error API ke pengguna.
6. Team broadcast tetap tidak melakukan lima panggilan LLM berurutan. Perilaku sekarang dipertahankan: role-based simulator replies untuk broadcast.
7. Tambah verifier CLI untuk provider live dan fallback simulator.

## Non-Goals

- Tidak install Ollama, menarik model, atau mengganti default provider.
- Tidak mengubah prompt visual, web frontend, Canvas, CSS, sprites, layout, atau asset pixel.
- Tidak membuat autonomous file writes.
- Tidak menyimpan prompt pengguna ke log provider baru.
- Tidak memodifikasi schema DB kecuali verifier membuktikan benar-benar perlu. Tidak diperkirakan perlu.

## Interface Contract

### POST `/api/index.php?action=chat-agent`

Input minimum:

```json
{"channel":"rama","message":"Ringkas status runtime."}
```

Output per reply:

```json
{
  "sender": "Rama",
  "agentId": "rama",
  "message": "...",
  "provider": "9router",
  "model": "my-combo",
  "fallbackUsed": false,
  "fallbackProvider": null,
  "attempts": [["9router", "online"]]
}
```

Fallback output must use `provider: "simulator"`, `fallbackUsed: true`, and must not disclose raw failure details to browser response.

## Safety Rules

- Use existing provider configuration and environment key only; never read, return, persist, or print its value.
- `attempts` returns provider names plus normalized `online` / `offline` status only. It never returns upstream error text.
- Provider request timeout stays in gateway boundary. No retries beyond existing fallback chain.
- Existing proposal approval gate remains unchanged.

## Verification

1. Unit-level verifier calls `KraRouterGateway::completeWithFallback()` with simulator and checks content `SIMULATOR_OK`.
2. HTTP verifier sends an addressed message to `chat-agent`; checks valid `ok`, reply, provider/model metadata, and no key-like text in JSON.
3. Fallback test uses an explicitly unavailable configured provider request and confirms normalized simulator fallback metadata.
4. Empty message returns HTTP 400.
5. Runtime health still reports 9Router online, Ollama offline, simulator online.
6. Run `tools/audit-cli.php`; record existing findings separately.

## Implementation Call

Use existing `KraRouterGateway::completeWithFallback()` instead of a new provider abstraction. Normalize metadata in `KraAgentChat` only. This is smallest diff and retains existing provider chain.
