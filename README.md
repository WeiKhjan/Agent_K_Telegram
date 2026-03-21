# Agent K — DEPRECATED

> **This project has been replaced by the official [Claude Code Telegram Channel](https://code.claude.com/docs/en/channels).**
> As of March 2026, Agent K's custom Telegram bot infrastructure is no longer needed.
> Claude Code v2.1.80+ natively supports Telegram as a channel plugin.

## Migration

Agent K has been replaced by `plugin:telegram@claude-plugins-official`, the official Claude Code Telegram channel. This provides:

- Native two-way Telegram chat (DMs and group chats)
- Per-user allowlisting with pairing flow
- @mention detection in groups
- File attachments (photos, documents up to 50MB)
- Typing indicators and emoji reactions
- Message editing (progress updates)
- No custom bot code to maintain

### What was preserved

- **Skills** — All 23 skills remain in `~/.claude/skills/` (symlinked from this repo's `skills/` directory)
- **Memory system** — `~/.claude/CLAUDE.md` and `~/.claude/projects/.../memory/` unchanged
- **Google OAuth tokens** — Gmail (`~/.gmail-mcp/`) and Drive (`~/.gdrive-mcp/`) tokens still valid
- **MCP servers** — Configured in `~/.claude/settings.local.json`, independent of Agent K

### How to run (new method)

```bash
claude --channels plugin:telegram@claude-plugins-official
```

Configuration:
- Bot token: `~/.claude/channels/telegram/.env`
- Access control: `~/.claude/channels/telegram/access.json`

See [Claude Code Channels documentation](https://code.claude.com/docs/en/channels) for full setup guide.

## Legacy Architecture (archived)

The original Agent K was a Node.js Telegram bot (Telegraf) that spawned Claude Code CLI as a subprocess. It handled session continuity, MCP loading, file delivery, and audit logging. This infrastructure is no longer needed since Claude Code handles it natively.

### Original project structure

```
Agent_K_Telegram/
├── src/               # Bot runtime (deprecated)
│   ├── index.js       # Telegraf handlers
│   ├── claude-runner.js # Claude CLI wrapper
│   ├── database.js    # SQLite sessions & audit
│   └── utils.js       # Auth, formatting
├── skills/            # Claude Code skills (STILL ACTIVE)
├── scripts/           # Setup scripts
├── config/            # Config templates
└── .env.example       # Environment template
```

## Skills (still active)

Skills are symlinked to `~/.claude/skills/` and work with the official channel:

| Skill | Description |
|-------|-------------|
| `/check-email` | Check Gmail inbox |
| `/claude-api` | Claude API/SDK help |
| `/compact` | Pre-compact memory flush |
| `/debug` | Diagnose bot issues |
| `/download-tnb-bill` | Download TNB bills |
| `/excel` | Excel operations |
| `/flight-booking` | Search flights on Agoda |
| `/flight-checkin` | Online flight check-in |
| `/git-push` | Git commit and push |
| `/google-sheets` | Google Sheets operations |
| `/hotel-booking` | Hotel booking on Agoda |
| `/hr-payroll` | Employment contracts |
| `/hrdc-claims` | HRDC T3 attendance |
| `/issue-invoice` | Invoice generation |
| `/issue-quotation` | Quotation generation |
| `/mac-setup` | Mac Mini headless setup |
| `/pdf` | PDF operations |
| `/powerpoint` | PowerPoint operations |
| `/repo-check` | Pre-commit audit |
| `/send-email` | Send emails via Gmail |
| `/send-file` | File delivery |
| `/send-telegram` | Send Telegram messages |
| `/skill-creator` | Create/improve skills |
| `/word` | Word documents |

## License

MIT
