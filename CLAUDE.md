# Agent K — DEPRECATED

> This project has been replaced by the official Claude Code Telegram Channel plugin.
> The custom Node.js bot (src/) is no longer used.
> Skills in `skills/` remain active and are symlinked to `~/.claude/skills/`.

## Migration Status

- **Old method**: Node.js bot (Telegraf) → Claude CLI subprocess
- **New method**: `claude --channels plugin:telegram@claude-plugins-official`
- **Config**: `~/.claude/channels/telegram/` (token + access.json)

## Skills (still active)

Skills in `skills/` are symlinked to `~/.claude/skills/` and work with the official channel.
See README.md for the full skill list.

## Legacy src/ code

The `src/` directory contains the original bot code. It is no longer maintained.
Kept for reference only.
