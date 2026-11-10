---
name: voicebox
description: Voicebox (jamiepine/voicebox, MIT) — local-first AI voice studio for RAGA's narration: zero-shot voice cloning, 8 TTS engines, 23 languages, expressive tags, Whisper STT, REST API + MCP server. Use it to give KRA videos a consistent cloned or preset narrator voice instead of the stock Piper voice.
---

# voicebox

You are RAGA's voice engine. Voicebox is a free, open-source, local-first AI
voice studio — an alternative to ElevenLabs (output) and WisprFlow (input) in
one app. It clones voices from a few seconds of audio, generates speech in 23
languages across 8 TTS engines, and runs entirely on the machine it is
installed on. Audio never leaves that machine.

Source: `jamiepine/voicebox` (MIT). Docs: `https://docs.voicebox.sh`.
App site: `https://voicebox.sh`.

## What it gives RAGA (and what it does not)

Gives:
- A **consistent narrator voice** for every KRA video — clone one voice
  (e.g. Yang Mulia's, or a chosen preset) and reuse it across renders,
  instead of the single stock Piper voice.
- **More natural delivery** — expressive tags, delivery instructions, and
  per-profile effects chains.
- **Long scripts** — auto-chunking with crossfade for anything over a few
  minutes.
- **Transcription** — Whisper-based STT for turning spoken audio into text.

Does NOT give:
- Video editing, upload, or publishing. It is the voice engine only.
- A cloud voice. If the Voicebox app is not running, there is no voice.

## Prerequisite — the app must be running

Voicebox is a **desktop app** (macOS DMG, Windows MSI) or **Docker**
(`docker compose up`). It also runs on Linux (CUDA/ROCm), DirectML, Intel
Arc, or plain CPU (slower). There is **no Docker on Muse's VM**, so the app
runs on Yang Mulia's machine or the KRA webapp server — never inside Muse.

Before any call, check the app is up:

```bash
curl -s http://127.0.0.1:17493/profiles
```

If that fails, the app is not running — start it first. Do not invent a
voice, a profile id, or an audio file.

Full API docs (when running): `http://127.0.0.1:17493/docs`.

## The 8 engines (pick per generation)

| Engine | Languages | Strengths |
| ------ | --------- | --------- |
| Qwen3-TTS (0.6B / 1.7B) | 10 | High-quality multilingual cloning, delivery instructions ("speak slowly", "whisper") |
| Qwen CustomVoice | 10 | 9 curated preset voices, natural-language delivery control, no reference audio needed |
| Qwen VoiceDesign | 10 | Builds a voice from a written description, no reference audio or preset needed |
| LuxTTS | English | Lightweight (~1GB VRAM), 48kHz output, 150x realtime on CPU |
| Chatterbox Multilingual | 23 | Broadest language coverage — incl. Malay, Arabic, Hindi, Swahili, Turkish and more |
| Chatterbox Turbo | English | Fast 350M model, paralinguistic emotion/sound tags |
| TADA (HumeAI, 1B / 3B) | 10 | 700s+ coherent audio |
| Kokoro | 8 | 50 curated preset voices, tiny 82M model, fast CPU inference |

**Indonesian caveat — read this first:** the README claims 23 languages and
lists **Malay** under Chatterbox Multilingual, but **Bahasa Indonesia is not
explicitly confirmed** for any engine. Before using Voicebox for a real KRA
narration, generate a short Indonesian test sample and listen to it. If the
Indonesian is wrong or unnatural, fall back to the proven narrator:
**Piper TTS voice `id_ID-news_tts-medium`** (the only Indonesian Piper voice
in `rhasspy/piper-voices`). Never ship a narration you have not listened to.

**Paralinguistic tags work ONLY on Chatterbox Turbo.** `[laugh]`, `[sigh]`,
`[gasp]`, `[chuckle]`, `[angry]`, `[whispering]`, `[narration]`, `[sarcastic]`
and friends are interpreted by Turbo only — every other engine reads them
literally as text. Do not put tags in a script meant for another engine.

## Voice profiles (cloning)

- Create a profile in the app from an audio file or by recording directly.
  Cloning is zero-shot from a reference sample; multi-sample profiles clone
  better. Profiles can be imported/exported and carry descriptions, language
  tags, and per-profile default effects chains.
- **Consent rule — hard:** clone only a voice you own or have explicit
  permission to clone. Yang Mulia's own voice for his own videos is fine.
  Never clone another person's voice without their permission, and never
  present a cloned voice as that person speaking live — it is narration,
  and the video's own credits/notes say so where it matters.

## Use it — REST API (port 17493)

```bash
# List voice profiles
curl http://127.0.0.1:17493/profiles

# Generate speech (profile_id from /profiles; language e.g. "en" — test "id" first)
curl -X POST http://127.0.0.1:17493/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "profile_id": "abc123", "language": "en"}'

# Agent voice output — speak in a cloned voice (profile = name, case-insensitive, or id)
curl -X POST http://127.0.0.1:17493/speak \
  -H "Content-Type: application/json" \
  -H "X-Voicebox-Client-Id: raga" \
  -d '{"text": "Deploy complete.", "profile": "Morgan"}'

# Transcribe an audio file (Whisper)
curl -X POST http://127.0.0.1:17493/transcribe \
  -F "audio=@recording.wav" \
  -F "model=whisper-turbo"
```

## Use it — MCP server

URL: `http://127.0.0.1:17493/mcp`, header `X-Voicebox-Client-Id: raga`.
Tools: `voicebox_speak`, `voicebox_transcribe`, `voicebox_list_captures`,
`voicebox_list_profiles`. Per-client voice bindings live in
Voicebox → Settings → MCP. A `profile` argument beats the per-client binding.

## RAGA pipeline — narration step

Voicebox replaces **only the narration step** of a render. Everything
downstream is unchanged:

1. Script approved → split narration per scene (same scene beats as the
   render script uses).
2. Generate one WAV per scene with Voicebox (`nar1.wav` … `nar6.wav`),
   same file conventions as the Piper flow, so `render.py` / Remotion
   projects need no changes. Or generate one `narration.wav` and split by
   the scene start times.
3. Check every WAV: duration fits its scene slot (the v1 defect was a
   4.91s narration in a 3s slot), no clipping, no silence gaps.
   Keep the mix practice from the v2 render: narration clearly above the
   music (v2 measured narration −18.5 dB against music-only gaps
   −35.5/−37.2 dB).
4. Post-processing (pitch shift, reverb, delay, chorus, compression,
   filters — 8 effects via pedalboard) is optional per profile; keep it
   subtle for narration. Reuse the same effects chain for every video so
   the narrator sounds identical across episodes.
5. If Voicebox is down, or the Indonesian test fails, fall back to Piper
   `id_ID-news_tts-medium` and note the fallback in the render README.

## What to record in the render README

Voice engine + profile name, language tested, fallback used (if any),
and the fact that the voice is a clone/preset — so MEIMEI's QA knows what
she is listening to.
