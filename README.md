# Agent K — Telegram Bot powered by Claude

A Telegram bot that acts as a conversational interface to Claude Code CLI.
Users send messages via Telegram; the bot forwards them to Claude, maintains
session continuity, and returns responses.

## Features

- Conversational AI via Claude Code CLI
- Session continuity per user
- Media uploads (photos, documents)
- File delivery via Telegram
- Smart MCP loading (Playwright, Gmail, Chrome DevTools)
- 13 built-in skills (invoicing, HR contracts, email, spreadsheets, etc.)

## Prerequisites

- Node.js 20+
- Claude Code CLI (installed and authenticated)
- Telegram Bot Token (from @BotFather)
- Google account for the agent (recommended: create a dedicated one)
- Google Cloud project with OAuth credentials (for Gmail, Sheets, Drive)

## Quick Start

### 0. Check your OS and grant permissions

**What OS are you running?**

<details>
<summary><strong>macOS</strong></summary>

Agent K needs the following macOS permissions to control apps, take screenshots, and access files. Grant these **before** running setup:

**System Settings → Privacy & Security:**

| Permission | What to add | Why |
|---|---|---|
| **Full Disk Access** | Terminal.app, `node` | Read/write files outside `~/` |
| **Accessibility** | Terminal.app, `node` | Control apps via AppleScript/System Events |
| **Screen & System Audio Recording** | Terminal.app | Take screenshots (`screencapture`) |
| **Automation** | Terminal.app → System Events, Finder | Automate native apps via `osascript` |

**How to add Terminal.app:**
1. Open System Settings → Privacy & Security → select the category
2. Click `+`, navigate to `/Applications/Utilities/Terminal.app`
3. Toggle on

**How to add Node.js** (not a `.app`, so it's hidden):
1. In the `+` dialog, press `Cmd + Shift + G`
2. Type the path to your node binary (e.g. `~/.local/bin/` or run `which node` to find it)
3. Select the `node` file and click Open

</details>

<details>
<summary><strong>Linux</strong></summary>

No special permissions needed. Ensure your user has access to the display server (X11/Wayland) if you plan to use screenshot features.

</details>

<details>
<summary><strong>Windows</strong></summary>

Run Terminal/PowerShell as your normal user. No special permissions needed. Use `start-agent-k.bat` to start the bot.

</details>

### 1. Clone and install

```bash
git clone <repo-url>
cd Agent_K_Telegram
npm install
```

### 2. Run setup

```bash
./scripts/setup.sh
```

This interactive script will:
- Install dependencies (if needed)
- Symlink skills to `~/.claude/skills/`
- Configure `.env` (bot token, company info, etc.)
- Set up Gmail API access (optional but recommended)
- Check prerequisites (Claude CLI, Playwright)

### 3. Start the bot

```bash
npm start
```

## Manual Setup (if not using setup.sh)

### Environment Variables

Copy `.env.example` to `.env` and fill in values. See `.env.example` for all available variables and descriptions.

**Required:**
- `TELEGRAM_BOT_TOKEN` — Bot token from @BotFather
- `ALLOWED_CHAT_IDS` — Comma-separated chat IDs the bot responds in

> **Important:** Disable **Group Privacy** for your bot so it can see all messages in groups (not just `/commands`). In @BotFather: `/mybots` → select bot → **Bot Settings** → **Group Privacy** → **Turn OFF**.

**Optional:**
- `TELEGRAM_GROUP_CHAT_ID` — Group chat ID for file delivery to groups
- `TELEGRAM_DM_CHAT_ID` — Your personal chat ID for DM delivery

#### How to get Telegram chat IDs

**Your personal chat ID:**
1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. It replies with your user ID (e.g. `123456789`)

**Group chat ID:**
1. Add the bot to your Telegram group
2. Send any message in the group
3. Send `/chatid` in the group — the bot will reply with the chat ID
4. Group IDs are negative numbers (e.g. `-1001234567890`)
5. Set `TELEGRAM_GROUP_CHAT_ID` in `.env` to this value

> **Tip:** You can also add the group chat ID to `ALLOWED_CHAT_IDS` so the bot responds in that group.

### Skills

Skills are Claude Code slash commands stored in `skills/`.
Run `./scripts/setup-skills.sh` to symlink them to `~/.claude/skills/`.

New skills added to `skills/` are automatically available — no re-run needed.

### Google Cloud Console Setup

Gmail, Google Sheets, and Google Drive features all require a Google Cloud project with OAuth credentials.

**1. Create a Google Cloud project:**
- Go to [console.cloud.google.com](https://console.cloud.google.com)
- Sign in with your agent's Google account (we recommend a dedicated account)
- Click **Select a project** (top bar) > **New Project**
- Name it (e.g. "Agent K") and click **Create**

**2. Enable APIs:**
- Go to **APIs & Services > Library**
- Search and enable each API you need:
  - **Gmail API** — for sending/reading emails
  - **Google Sheets API** — for reading/writing spreadsheets
  - **Google Drive API** — for listing/accessing Drive files

**3. Configure OAuth consent screen:**
- Go to **APIs & Services > OAuth consent screen**
- Choose **External** > click **Create**
- Fill in: App name, User support email, Developer email
- Click **Save and Continue** through the Scopes page
- On **Test users** page: click **Add Users** > add your agent's Gmail address
- Click **Save and Continue** > **Back to Dashboard**

**4. Create OAuth credentials:**
- Go to **APIs & Services > Credentials**
- Click **+ Create Credentials** > **OAuth Client ID**
- Application type: **Desktop app**
- Click **Create**, then **Download JSON**
- Save the file somewhere accessible

**5. Authenticate Gmail:**
```bash
python3 scripts/gmail-auth.py path/to/client_secret.json
```
Log in with your agent's Gmail when the browser opens. Tokens saved to `~/.gmail-mcp/`.

**6. Authenticate Google Drive & Sheets:**
```bash
python3 scripts/gdrive-auth.py path/to/client_secret.json
```
You can reuse the same OAuth client JSON file. Tokens saved to `~/.gdrive-mcp/`.

### Claude Code Config

Copy `config/CLAUDE.md.template` to `~/.claude/CLAUDE.md` and fill in your values.
This gives Claude its personality and operating instructions.

## Architecture

```
Telegram User
     |
     v
+-------------------------------------+
|         Agent K Bot                  |
|  +-----------------------------+    |
|  |   Telegraf (Bot Framework)  |    |
|  +-----------------------------+    |
|              |                      |
|  +-----------+-----------+          |
|  v                       v          |
| Auth                  Express       |
| Middleware            (Webhook)     |
|  |                                  |
|  v                                  |
| Claude Runner --> Claude Code CLI   |
|  |               (skip-permissions) |
|  v                                  |
| SQLite DB                           |
| (sessions + audit)                  |
+-------------------------------------+
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and command list |
| `/new` | Clear session, start new conversation |
| `/status` | Check bot status, session, and workspace |
| `/cd <path>` | Change workspace directory |
| `/sendfile <name>` | Send a file from workspace |
| `/test` | Test Claude CLI availability |
| `/cancel` | Cancel in-progress request |
| `/chatid` | Show current chat ID |

## Project Structure

```
Agent_K_Telegram/
├── src/               # Bot runtime
│   ├── index.js       # Main bot entry, commands, handlers
│   ├── claude-runner.js # Claude Code CLI wrapper
│   ├── database.js    # SQLite session & audit logging
│   └── utils.js       # Auth, message splitting, markdown
├── skills/            # Claude Code skills (13 skills)
├── scripts/           # Setup and utility scripts
├── config/            # Configuration templates
├── data/              # SQLite database (git-ignored)
├── Dockerfile
├── .env.example
└── package.json
```

## Mac Mini Headless Setup

If you're running Agent K on a Mac Mini as an always-on server, configure these settings so it won't sleep when unattended:

**System Settings > Energy Saver:**
- **Turn display off after**: 2 minutes (saves energy, bot doesn't need a display)
- **Prevent automatic sleeping when the display is off**: ON
- **Wake for network access**: ON
- **Start up automatically after a power failure**: ON

**System Settings > Lock Screen:**
- **Require password after screen saver begins**: Never (or a long delay — prevents locking you out remotely)

**System Settings > Users & Groups:**
- **Automatic login**: Select your user account (ensures the bot starts after a reboot without needing a keyboard/mouse)

**System Settings > General > Sharing:**
- **Remote Login**: ON (enables SSH so you can manage the Mac Mini from another machine)

**Auto-start Agent K on boot (optional):**

Create a launchd plist at `~/Library/LaunchAgents/com.agentk.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.agentk.telegram</string>
    <key>WorkingDirectory</key>
    <string>/path/to/Agent_K_Telegram</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>src/index.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/agent-k.out.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/agent-k.err.log</string>
</dict>
</plist>
```

Load it:
```bash
launchctl load ~/Library/LaunchAgents/com.agentk.plist
```

> **Note:** Update the `WorkingDirectory` and node path (`which node`) to match your system.

## Deployment

### Polling (simplest)

```bash
npm start
```

No webhook needed — bot polls Telegram for updates.

### Docker

```bash
docker build -t agent-k .
docker run -d --env-file .env agent-k
```

### Zeabur

Push to GitHub and connect via [zeabur.com](https://zeabur.com). Add environment variables in the dashboard.

## Security

- **Chat whitelist**: Only chats listed in `ALLOWED_CHAT_IDS` receive responses
- **User whitelist**: `ALLOWED_TELEGRAM_IDS` restricts by user ID
- **Permissions bypass**: `--dangerously-skip-permissions` is enabled — restrict access via whitelists
- **Audit logging**: All messages logged to SQLite

## License

MIT
