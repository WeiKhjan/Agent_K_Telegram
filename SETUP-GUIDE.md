# Agent K — First-Timer Setup Guide

Complete guide to set up Agent K (Claude Code + Telegram) on a fresh Mac.

---

## Prerequisites

- macOS (Apple Silicon or Intel)
- An Anthropic account with Claude Code Pro/Max subscription
- A Telegram account

---

## Step 1: Install Core Tools

### 1a. Install Claude Code CLI

```bash
# Install via npm (requires Node.js) or native installer
curl -fsSL https://claude.ai/install.sh | sh

# Verify
claude --version
```

After install, run `claude` once to authenticate with your Anthropic account.

### 1b. Install Node.js

```bash
# Download Node.js 20+ (LTS)
curl -fsSL https://nodejs.org/dist/v20.19.0/node-v20.19.0-darwin-arm64.tar.gz | tar -xz -C ~/.local/share/
ln -sf ~/.local/share/node-v20.19.0-darwin-arm64/bin/node ~/.local/bin/node
ln -sf ~/.local/share/node-v20.19.0-darwin-arm64/bin/npm ~/.local/bin/npm
ln -sf ~/.local/share/node-v20.19.0-darwin-arm64/bin/npx ~/.local/bin/npx

# Verify
~/.local/bin/node --version
```

### 1c. Install Python (via uv)

```bash
# Install uv (fast Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install Python 3.12
~/.local/bin/uv python install 3.12

# Create office venv for document generation
~/.local/bin/uv venv ~/.local/share/office-venv --python 3.12
~/.local/share/office-venv/bin/pip install python-docx openpyxl python-pptx reportlab pypdf pikepdf pymupdf pdfplumber fpdf2 borb google-auth-oauthlib google-api-python-client docx2pdf

# Verify
~/.local/share/office-venv/bin/python --version
```

### 1d. Install Optional Tools

```bash
# GitHub CLI (for git-push skill)
curl -fsSL https://github.com/cli/cli/releases/download/v2.67.0/gh_2.67.0_macOS_arm64.tar.gz | tar -xz -C /tmp/
cp /tmp/gh_*/bin/gh ~/.local/bin/gh

# ffmpeg (for voice-reply skill — audio conversion)
curl -fsSL https://evermeet.cx/ffmpeg/ffmpeg-7.1.1.zip -o /tmp/ffmpeg.zip
unzip -o /tmp/ffmpeg.zip -d ~/.local/bin/

# OpenAI Whisper (speech-to-text for voice messages)
~/.local/bin/uv tool install openai-whisper

# Qwen3-TTS via MLX Audio (text-to-speech — Apple Silicon only)
~/.local/bin/uv tool install mlx-audio

# Verify voice tools
whisper --help
mlx_audio.tts.generate --help

# Playwright browsers
npx playwright install chromium
```

### 1e. Ensure PATH

Add to `~/.zshrc`:
```bash
export PATH="$HOME/.local/bin:$HOME/.local/share/office-venv/bin:$PATH"
```

---

## Step 2: Create Telegram Bot

1. Open Telegram, search for **@BotFather**
2. Send `/newbot`
3. Choose a display name (e.g., "Agent K")
4. Choose a username (e.g., "my_agent_k_bot") — must end in `bot`
5. **Copy the bot token** (looks like `1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ`)
6. Configure bot settings:
   - Send `/mybots` → select your bot
   - **Bot Settings → Group Privacy → Turn OFF** (so bot can read group messages)
   - **Bot Settings → Allow Groups → Turn ON** (if you want group chat)

### Find your Telegram user ID

- Message **@userinfobot** on Telegram — it will reply with your numeric ID (e.g., `6283327001`)
- Save this — you'll need it for access control

### Find group chat ID (optional)

- Add your bot to a group
- Message **@userinfobot** in that group, or use the Bot API:
  ```bash
  curl "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates" | python3 -m json.tool
  ```
- Group IDs are negative numbers (e.g., `-5125835942`)

---

## Step 3: Clone the Repository

```bash
cd ~
git clone https://github.com/YOUR_ORG/Agent_K_Telegram.git
cd Agent_K_Telegram
```

---

## Step 4: Run Setup Script

```bash
bash scripts/setup.sh
```

This will:
1. Symlink skills to `~/.claude/skills/`
2. Generate your agent's soul (`~/.claude/CLAUDE.md`) — agent name, owner, security
3. Configure environment variables (`.env`)
4. Set up Google OAuth for Gmail and Sheets (optional)
5. Install Playwright browsers
6. Guide Mac Mini headless configuration (optional)

---

## Step 5: Configure Telegram Channel

### 5a. Save bot token

```bash
mkdir -p ~/.claude/channels/telegram
cat > ~/.claude/channels/telegram/.env << 'EOF'
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
EOF
```

### 5b. Configure access control

```bash
cat > ~/.claude/channels/telegram/access.json << 'EOF'
{
  "dmPolicy": "allowlist",
  "allowFrom": ["YOUR_TELEGRAM_USER_ID"],
  "groups": {},
  "ackReaction": "👀",
  "textChunkLimit": 4096,
  "chunkMode": "newline"
}
EOF
```

Replace `YOUR_TELEGRAM_USER_ID` with your numeric ID from Step 2.

To add group support:
```json
{
  "dmPolicy": "allowlist",
  "allowFrom": ["YOUR_USER_ID", "OTHER_USER_ID"],
  "groups": {
    "GROUP_CHAT_ID": {
      "requireMention": true,
      "allowFrom": ["YOUR_USER_ID", "OTHER_USER_ID"]
    }
  },
  "ackReaction": "👀",
  "textChunkLimit": 4096,
  "chunkMode": "newline"
}
```

### 5c. Enable the Telegram plugin

```bash
# This should already be set by Claude Code, but verify:
cat ~/.claude/settings.json
```

Ensure `enabledPlugins` includes:
```json
{
  "enabledPlugins": {
    "telegram@claude-plugins-official": true
  }
}
```

---

## Step 6: Configure MCP Servers

MCP servers extend Claude's capabilities. Configure them in `.claude.json` under your project:

```bash
claude  # Start Claude Code in your home directory
# Then use: /mcp add <server>
```

### Recommended MCP servers:

| Server | Command | Purpose |
|--------|---------|---------|
| **playwright** | `npx @playwright/mcp@latest --browser chromium` | Browser automation |
| **gmail** | `npx @gongrzhe/server-gmail-autoauth-mcp` | Gmail send/read/search |
| **google-sheets** | `uvx mcp-google-sheets@latest` | Google Sheets operations |

### Gmail OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (e.g., "Agent K")
3. Enable APIs: **Gmail API**, **Google Sheets API**, **Google Drive API**
4. Configure OAuth consent screen (External, add your email as test user)
5. Create OAuth credentials (Desktop app) → Download JSON
6. Run the auth scripts:

```bash
# Gmail
python3 ~/Agent_K_Telegram/scripts/gmail-auth.py /path/to/downloaded-oauth-client.json

# Google Sheets/Drive
python3 ~/Agent_K_Telegram/scripts/gdrive-auth.py /path/to/downloaded-oauth-client.json
```

Tokens are saved to `~/.gmail-mcp/` and `~/.gdrive-mcp/` respectively.

---

## Step 7: Test It

### Manual test (foreground)

```bash
cd ~
claude --channels plugin:telegram@claude-plugins-official --verbose
```

Now message your bot on Telegram — you should see the 👀 reaction and get a reply.

Press `Ctrl+C` to stop.

### Test with full permissions (production mode)

```bash
claude --channels plugin:telegram@claude-plugins-official --dangerously-skip-permissions --verbose
```

---

## Step 8: Set Up Auto-Start (LaunchAgent)

### 8a. Create the launcher script

The file `start-agent-k.command` should already exist in the repo. Verify the path matches your username:

```bash
cat ~/Agent_K_Telegram/start-agent-k.command
```

If not, create it:
```bash
cat > ~/Agent_K_Telegram/start-agent-k.command << 'SCRIPT'
#!/bin/zsh
# Agent K auto-start via Login Item
cd "$HOME"
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

while true; do
    echo "Starting Agent K... ($(date))"
    claude --channels plugin:telegram@claude-plugins-official --dangerously-skip-permissions --verbose
    EXIT_CODE=$?
    echo "Agent K exited with code $EXIT_CODE at $(date). Restarting in 30s..."
    sleep 30
done
SCRIPT
chmod +x ~/Agent_K_Telegram/start-agent-k.command
```

### 8b. Create LaunchAgent plist (auto-start on login)

```bash
cat > ~/Library/LaunchAgents/com.agentk.main.plist << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.agentk.main</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/open</string>
        <string>${HOME}/Agent_K_Telegram/start-agent-k.command</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${HOME}/Agent_K_Telegram/logs/agent-k.log</string>
    <key>StandardErrorPath</key>
    <string>${HOME}/Agent_K_Telegram/logs/agent-k.log</string>
</dict>
</plist>
PLIST
```

**Important:** LaunchAgent plists do NOT expand `$HOME` — you must replace `${HOME}` with your actual home directory path:

```bash
sed -i '' "s|\${HOME}|$HOME|g" ~/Library/LaunchAgents/com.agentk.main.plist
```

### 8c. Create heartbeat monitor (optional but recommended)

```bash
# Create logs directory
mkdir -p ~/Agent_K_Telegram/logs

# Update heartbeat.sh to use your paths (it's already in the repo)
# Then create the LaunchAgent:
cat > ~/Library/LaunchAgents/com.agentk.heartbeat.plist << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.agentk.heartbeat</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/zsh</string>
        <string>${HOME}/Agent_K_Telegram/scripts/heartbeat.sh</string>
    </array>

    <key>StartInterval</key>
    <integer>120</integer>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${HOME}/Agent_K_Telegram/logs/heartbeat.log</string>
    <key>StandardErrorPath</key>
    <string>${HOME}/Agent_K_Telegram/logs/heartbeat.log</string>
</dict>
</plist>
PLIST

sed -i '' "s|\${HOME}|$HOME|g" ~/Library/LaunchAgents/com.agentk.heartbeat.plist
```

### 8d. Create daily restart (optional — prevents context bloat)

```bash
cat > ~/Library/LaunchAgents/com.agentk.restart.plist << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.agentk.restart</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/pkill</string>
        <string>-f</string>
        <string>claude.*channels.*telegram</string>
    </array>

    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>0</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>

    <key>StandardOutPath</key>
    <string>${HOME}/Agent_K_Telegram/logs/restart.log</string>
    <key>StandardErrorPath</key>
    <string>${HOME}/Agent_K_Telegram/logs/restart.log</string>
</dict>
</plist>
PLIST

sed -i '' "s|\${HOME}|$HOME|g" ~/Library/LaunchAgents/com.agentk.restart.plist
```

### 8e. Load the LaunchAgents

```bash
launchctl load ~/Library/LaunchAgents/com.agentk.main.plist
launchctl load ~/Library/LaunchAgents/com.agentk.heartbeat.plist
launchctl load ~/Library/LaunchAgents/com.agentk.restart.plist
```

---

## Step 9: Mac Permissions (Required)

### Full Disk Access for Terminal

Agent K needs Terminal.app to have Full Disk Access so it can read/write files:

1. **System Settings → Privacy & Security → Full Disk Access**
2. Click `+`, add **Terminal.app** (or iTerm2 / your terminal)
3. Toggle ON

### Accessibility (for Playwright browser automation)

1. **System Settings → Privacy & Security → Accessibility**
2. Add **Terminal.app**

### Optional: Headless Mac Mini Setup

If running 24/7 without a monitor:

| Setting | Location | Value |
|---------|----------|-------|
| Prevent sleep | System Settings → Energy → Prevent automatic sleeping | ON |
| Wake for network | System Settings → Energy → Wake for network access | ON |
| Auto-restart after power failure | System Settings → Energy | ON |
| Auto-login | System Settings → Users & Groups → Automatic login | Your user |
| SSH access | System Settings → General → Sharing → Remote Login | ON |
| Lock screen | System Settings → Lock Screen → Require password | Never (or long delay) |

---

## Step 10: Verify Everything

### Checklist

```bash
# Claude CLI
claude --version

# Node.js
~/.local/bin/node --version

# Python
~/.local/share/office-venv/bin/python --version

# Skills symlink
ls -la ~/.claude/skills/
# Should point to → ~/Agent_K_Telegram/skills/

# Telegram config
cat ~/.claude/channels/telegram/.env
cat ~/.claude/channels/telegram/access.json

# Soul
head -5 ~/.claude/CLAUDE.md

# Agent running
pgrep -f "claude.*channels.*telegram"

# Heartbeat
cat ~/Agent_K_Telegram/logs/heartbeat.log | tail -5
```

### Send a test message

Open Telegram, message your bot: "Hello, are you working?"

You should see:
1. 👀 reaction appears immediately
2. Bot replies within a few seconds

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Bot doesn't react to messages | Check `access.json` — your user ID must be in `allowFrom` |
| Bot reacts (👀) but doesn't reply | Check `claude` is running: `pgrep -f "claude.*channels"` |
| "Permission denied" errors | Grant Full Disk Access to Terminal (Step 9) |
| Playwright can't open browser | Run `npx playwright install chromium` |
| Gmail auth fails | Re-run `python3 scripts/gmail-auth.py /path/to/oauth.json` |
| LaunchAgent doesn't start | Check paths in plist, then: `launchctl unload` + `launchctl load` |
| Bot works in DM but not group | Check `groups` in `access.json` + disable Group Privacy in BotFather |

---

## File Structure Reference

```
~/Agent_K_Telegram/
├── skills/                          # 24 Claude Code skills (symlinked)
├── scripts/
│   ├── setup.sh                     # Interactive setup
│   ├── setup-soul.sh                # Agent identity generator
│   ├── setup-skills.sh              # Skills symlink helper
│   ├── heartbeat.sh                 # Health monitor
│   ├── gmail-auth.py                # Gmail OAuth flow
│   └── gdrive-auth.py              # Google Drive OAuth flow
├── start-agent-k.command            # Auto-start launcher (with restart loop)
├── start.sh                         # Simple launcher (for launchd direct)
├── .env                             # Company/personal config
└── .env.example                     # Config template

~/.claude/
├── CLAUDE.md                        # Agent soul (identity, security, memory)
├── settings.json                    # Plugins config
├── settings.local.json              # Permissions whitelist
├── skills/ → Agent_K_Telegram/skills/
├── channels/telegram/
│   ├── .env                         # Bot token
│   └── access.json                  # Access control
├── credentials/                     # API keys, tokens (chmod 600)
└── projects/-Users-$(whoami)/memory/
    ├── MEMORY.md                    # Persistent learnings
    └── daily/                       # Session logs

~/.gmail-mcp/                        # Gmail OAuth tokens
~/.gdrive-mcp/                       # Google Drive/Sheets OAuth tokens

~/Library/LaunchAgents/
├── com.agentk.main.plist            # Auto-start on login
├── com.agentk.heartbeat.plist       # Health check every 2 min
└── com.agentk.restart.plist         # Daily restart at midnight
```
