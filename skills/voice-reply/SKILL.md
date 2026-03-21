---
name: voice-reply
description: Handle incoming voice messages — transcribe with Whisper, detect language, reply in the same language. Optionally generate voice response using Qwen3-TTS.
---

# Voice Reply Skill

When a voice message arrives (attachment_kind="voice"), follow these steps:

## 1. Download & Transcribe

Download the voice attachment, then transcribe with Whisper:

```bash
# Force English detection (Whisper misdetects Malay for Malaysian English/Chinese)
whisper <file_path> --model small --language en --output_format txt --output_dir /tmp/whisper-out
```

If the transcription contains mostly Chinese characters, re-run with `--language zh`:
```bash
whisper <file_path> --model small --language zh --output_format txt --output_dir /tmp/whisper-out
```

## 2. Detect Language from Content

Detect language from the **transcribed text content**, NOT from Whisper's auto-detect (which confuses Malaysian accent with Malay):
- If text is mostly Chinese characters → Mandarin (zh)
- If text is mostly English words → English (en)
- Always follow what the user actually spoke

## 3. Reply with Transcription

Reply to the voice message on Telegram with the transcription prefixed by 🎤, then respond to the content normally in the same language the user spoke.

## 4. Generate Voice Reply (optional — only when response is short/conversational)

Generate a voice response using Qwen3-TTS:

### English
```bash
mlx_audio.tts.generate --model mlx-community/Qwen3-TTS-12Hz-0.6B-Base-bf16 --text "<reply_text>" --output_path /tmp/tts-reply.wav
```

### Chinese/Mandarin
```bash
mlx_audio.tts.generate --model mlx-community/Qwen3-TTS-12Hz-0.6B-Base-bf16 --text "<reply_text>" --lang_code zh --output_path /tmp/tts-reply.wav
```

Convert to OGG for Telegram:
```bash
~/.local/bin/ffmpeg -i /tmp/tts-reply.wav/audio_000.wav -c:a libopus /tmp/tts-reply.ogg -y
```

Then attach the OGG file in the Telegram reply using the `files` parameter.

## Language Rules

- User speaks English + transcribe with `--language en` → reply in English
- User speaks Mandarin + transcribe with `--language zh` → reply in Mandarin (use `--lang_code zh` for TTS)
- Do NOT auto-detect language → match the content language → always follow what the user actually spoke
- Ignore geo-location — a Malaysian speaker may speak English OR Mandarin, detect from content not location
