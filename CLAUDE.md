# Agent K — Claude Code + Telegram

This project provides skills, configuration, and auto-start infrastructure for running
Claude Code as a 24/7 Telegram bot via the official Telegram Channel plugin.

## How to run

```bash
claude --channels plugin:telegram@claude-plugins-official --dangerously-skip-permissions --verbose
```

Config: `~/.claude/channels/telegram/` (token + access.json)

## Skills (active)

Skills in `skills/` are symlinked to `~/.claude/skills/` and work with the official channel.
See README.md for the full skill list.

## Setup

Run `bash scripts/setup.sh` for interactive first-time setup.
See `SETUP-GUIDE.md` for the complete walkthrough.

## Legacy src/ code

The `src/` directory contains the original Telegraf bot code. It is no longer maintained.
Kept for reference only — the official Claude Code Telegram plugin replaced it in March 2026.
