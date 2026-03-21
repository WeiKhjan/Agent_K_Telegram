# Agent K — Claude Code + Telegram

AI assistant powered by Claude Code with Telegram as the primary interface. Runs 24/7 on a Mac with auto-start, health monitoring, and daily restart.

## Quick Start

```bash
# 1. Clone and run setup
git clone https://github.com/YOUR_ORG/Agent_K_Telegram.git
cd Agent_K_Telegram
bash scripts/setup.sh

# 2. Test it
claude --channels plugin:telegram@claude-plugins-official --verbose

# 3. Message your bot on Telegram!
```

For detailed first-time setup (including tool installation, BotFather, Mac permissions), see **[SETUP-GUIDE.md](SETUP-GUIDE.md)**.

## How It Works

Agent K uses the official Claude Code Telegram Channel plugin (`plugin:telegram@claude-plugins-official`). Claude Code handles everything natively:

- Two-way Telegram chat (DMs and group chats)
- Per-user allowlisting with access control
- @mention detection in groups
- File attachments (photos, documents up to 50MB)
- Typing indicators and emoji reactions
- 24 custom skills for business operations

### Architecture

```
Telegram ←→ Claude Code CLI (with Telegram plugin)
              ├── Skills (~/.claude/skills/ → skills/)
              ├── MCP Servers (Playwright, Gmail, Sheets, etc.)
              ├── Memory System (~/.claude/projects/.../memory/)
              └── Soul / Identity (~/.claude/CLAUDE.md)
```

## Configuration

| File | Purpose |
|------|---------|
| `~/.claude/channels/telegram/.env` | Bot token |
| `~/.claude/channels/telegram/access.json` | Access control (allowlist, groups) |
| `~/.claude/CLAUDE.md` | Agent identity, security rules, memory system |
| `~/Agent_K_Telegram/.env` | Company/personal config (invoicing, email, etc.) |
| `~/.claude/settings.json` | Enabled plugins |
| `~/.claude/settings.local.json` | Permissions whitelist |
| `~/.claude.json` | MCP server configs (per project) |

## Running

### Foreground (testing)

```bash
claude --channels plugin:telegram@claude-plugins-official --verbose
```

### Production (full permissions)

```bash
claude --channels plugin:telegram@claude-plugins-official --dangerously-skip-permissions --verbose
```

### Auto-start on boot (LaunchAgent)

See [SETUP-GUIDE.md — Step 8](SETUP-GUIDE.md#step-8-set-up-auto-start-launchagent) for LaunchAgent plist setup.

Three LaunchAgents work together:
- **Main** — Starts Agent K on login with auto-restart loop
- **Heartbeat** — Pings Telegram API every 2 min, kills unresponsive process
- **Daily restart** — Kills Claude at midnight to prevent context bloat

## Skills (24 active)

Skills are in `skills/` and symlinked to `~/.claude/skills/`:

| Skill | Description |
|-------|-------------|
| `/check-email` | Check Gmail inbox |
| `/compact` | Pre-compact memory flush |
| `/debug` | Diagnose bot issues |
| `/download-tnb-bill` | Download TNB electricity bills |
| `/excel` | Excel file operations |
| `/flight-booking` | Search flights on Agoda |
| `/flight-checkin` | Online flight check-in |
| `/git-push` | Git commit and push |
| `/google-sheets` | Google Sheets operations |
| `/hotel-booking` | Hotel booking on Agoda |
| `/hr-payroll` | Employment contracts |
| `/hrdc-claims` | HRDC T3 attendance forms |
| `/issue-invoice` | Invoice generation |
| `/issue-quotation` | Quotation generation |
| `/mac-setup` | Mac Mini headless setup |
| `/pdf` | PDF operations |
| `/powerpoint` | PowerPoint operations |
| `/repo-check` | Pre-commit audit |
| `/send-email` | Send emails via Gmail |
| `/send-file` | File delivery (Telegram/email) |
| `/send-telegram` | Send Telegram messages |
| `/skill-creator` | Create/improve skills |
| `/voice-reply` | Voice message transcription + reply |
| `/word` | Word documents |

## Project Structure

```
Agent_K_Telegram/
├── skills/                      # 24 Claude Code skills (source of truth)
│   ├── check-email/
│   ├── issue-invoice/
│   ├── ...
│   └── word/
├── scripts/
│   ├── setup.sh                 # Interactive first-run setup
│   ├── setup-soul.sh            # Agent identity generator
│   ├── setup-skills.sh          # Skills symlink helper
│   ├── heartbeat.sh             # Health monitor for LaunchAgent
│   ├── gmail-auth.py            # Gmail OAuth flow
│   └── gdrive-auth.py          # Google Drive/Sheets OAuth flow
├── config/
│   └── CLAUDE.md.template       # Soul template
├── logs/                        # Runtime logs
├── start-agent-k.command        # Auto-start launcher (with restart loop)
├── start.sh                     # Simple launcher
├── .env.example                 # Environment template
├── SETUP-GUIDE.md              # Complete first-timer setup guide
├── CLAUDE.md                    # Project-level instructions
└── README.md                    # This file
```

### Legacy code (archived)

The `src/` directory contains the original Node.js Telegraf bot code. It is no longer used — kept for reference only. The custom bot has been fully replaced by the official Claude Code Telegram Channel plugin.

## Setup Scripts

```bash
# Full setup (first-time)
bash scripts/setup.sh

# Reconfigure environment variables
bash scripts/setup.sh --reconfigure

# Reconfigure Gmail OAuth
bash scripts/setup.sh --gmail

# Reconfigure Google Drive/Sheets OAuth
bash scripts/setup.sh --google
```

## License

MIT
