#!/bin/bash
# setup.sh — First-run interactive setup for Agent K (Claude Code + Telegram)
# Idempotent: safe to run multiple times.

set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo ""
echo "========================================="
echo "  Agent K — Setup"
echo "  (Claude Code + Official Telegram Channel)"
echo "========================================="
echo ""

# ── 1. Skills symlink ──
echo "[1/8] Setting up skills..."
bash scripts/setup-skills.sh

# ── 2. Soul setup (CLAUDE.md) ──
echo ""
echo "[2/8] Setting up agent soul..."
bash scripts/setup-soul.sh

# ── 3. Environment variables ──
echo ""
echo "[3/8] Configuring environment..."

if [ "$1" = "--reconfigure" ]; then
  echo "  Reconfiguring .env..."
  CONFIGURE_ENV=true
elif [ -f ".env" ]; then
  echo "  Found existing .env — skipping env setup."
  echo "  Run with --reconfigure to redo."
  CONFIGURE_ENV=false
else
  CONFIGURE_ENV=true
fi

if [ "$CONFIGURE_ENV" = true ]; then
  cp -n .env.example .env 2>/dev/null || true

  echo ""
  echo "  --- MANDATORY ---"
  echo ""

  read -rp "  Telegram bot token (from @BotFather): " BOT_TOKEN
  if [ -z "$BOT_TOKEN" ]; then
    echo "  ERROR: Bot token is required. Get one from @BotFather on Telegram."
    exit 1
  fi
  sed -i.bak "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$BOT_TOKEN|" .env

  # Also save token to the official channel config
  mkdir -p "$HOME/.claude/channels/telegram"
  echo "TELEGRAM_BOT_TOKEN=$BOT_TOKEN" > "$HOME/.claude/channels/telegram/.env"
  echo "  Saved bot token to ~/.claude/channels/telegram/.env"

  echo ""
  echo "  ┌─────────────────────────────────────────────────────────┐"
  echo "  │  IMPORTANT: Disable Group Privacy for your bot         │"
  echo "  │                                                        │"
  echo "  │  1. Open @BotFather on Telegram                        │"
  echo "  │  2. Send /mybots → select your bot                     │"
  echo "  │  3. Bot Settings → Group Privacy → Turn OFF            │"
  echo "  │                                                        │"
  echo "  │  Without this, the bot can only see /commands in       │"
  echo "  │  groups — it won't see regular messages.               │"
  echo "  └─────────────────────────────────────────────────────────┘"
  echo ""
  read -rp "  Press Enter once you've disabled group privacy... "

  # Access control
  echo ""
  echo "  --- ACCESS CONTROL ---"
  echo ""
  echo "  Your Telegram user ID controls who can message the bot."
  echo "  Find it by messaging @userinfobot on Telegram."
  echo ""
  read -rp "  Your Telegram user ID (numeric): " OWNER_TG_ID
  if [ -z "$OWNER_TG_ID" ]; then
    echo "  ERROR: At least one user ID is required for security."
    exit 1
  fi

  # Create access.json for official channel
  cat > "$HOME/.claude/channels/telegram/access.json" << ACCESS_EOF
{
  "dmPolicy": "allowlist",
  "allowFrom": ["$OWNER_TG_ID"],
  "groups": {},
  "ackReaction": "👀",
  "textChunkLimit": 4096,
  "chunkMode": "newline"
}
ACCESS_EOF
  echo "  Created access control at ~/.claude/channels/telegram/access.json"

  # Also save to .env for skills that reference it
  sed -i.bak "s|^ALLOWED_CHAT_IDS=.*|ALLOWED_CHAT_IDS=$OWNER_TG_ID|" .env
  sed -i.bak "s|^ALLOWED_TELEGRAM_IDS=.*|ALLOWED_TELEGRAM_IDS=$OWNER_TG_ID|" .env

  echo ""
  echo "  --- RECOMMENDED (press Enter to skip) ---"
  echo ""

  read -rp "  Working directory [default: ~/]: " WORKSPACE
  WORKSPACE="${WORKSPACE:-$HOME}"
  sed -i.bak "s|^WORKSPACE_DIR=.*|WORKSPACE_DIR=$WORKSPACE|" .env

  read -rp "  Company name: " CO_NAME
  [ -n "$CO_NAME" ] && sed -i.bak "s|^COMPANY_NAME=.*|COMPANY_NAME=$CO_NAME|" .env

  read -rp "  Company email: " CO_EMAIL
  [ -n "$CO_EMAIL" ] && sed -i.bak "s|^COMPANY_EMAIL=.*|COMPANY_EMAIL=$CO_EMAIL|" .env

  read -rp "  Contact person name: " CO_CONTACT
  [ -n "$CO_CONTACT" ] && sed -i.bak "s|^COMPANY_CONTACT_NAME=.*|COMPANY_CONTACT_NAME=$CO_CONTACT|" .env

  read -rp "  Contact person title [default: Director]: " CO_TITLE
  CO_TITLE="${CO_TITLE:-Director}"
  sed -i.bak "s|^COMPANY_CONTACT_TITLE=.*|COMPANY_CONTACT_TITLE=$CO_TITLE|" .env

  read -rp "  Company address (without country): " CO_ADDR
  [ -n "$CO_ADDR" ] && sed -i.bak "s|^COMPANY_ADDRESS=.*|COMPANY_ADDRESS=$CO_ADDR|" .env

  read -rp "  Company registration number: " CO_REG
  [ -n "$CO_REG" ] && sed -i.bak "s|^COMPANY_REG=.*|COMPANY_REG=$CO_REG|" .env

  read -rp "  Email display name [default: same as contact]: " FROM_NAME
  [ -n "$FROM_NAME" ] && sed -i.bak "s|^FROM_NAME=.*|FROM_NAME=$FROM_NAME|" .env

  read -rp "  Email address for sending [default: same as company email]: " FROM_EMAIL
  [ -n "$FROM_EMAIL" ] && sed -i.bak "s|^FROM_EMAIL=.*|FROM_EMAIL=$FROM_EMAIL|" .env

  echo ""
  echo "  Telegram chat IDs (optional — for file delivery routing):"
  echo "    Group chat ID: add bot to group, message @userinfobot"
  echo "    DM chat ID: same as your user ID"
  read -rp "  Telegram group chat ID (optional): " TG_GROUP
  [ -n "$TG_GROUP" ] && sed -i.bak "s|^TELEGRAM_GROUP_CHAT_ID=.*|TELEGRAM_GROUP_CHAT_ID=$TG_GROUP|" .env

  read -rp "  Telegram DM chat ID (optional): " TG_DM
  [ -n "$TG_DM" ] && sed -i.bak "s|^TELEGRAM_DM_CHAT_ID=.*|TELEGRAM_DM_CHAT_ID=$TG_DM|" .env

  echo ""
  echo "  Optional vars you can edit in .env later:"
  echo "    COMPANY_SST_NO, BANK_NAME, BANK_ACCT_NAME,"
  echo "    BANK_ACCT_NO, CC_EMAILS, PLAYWRIGHT_CHROME_PATH,"
  echo "    TNB_EMAIL, TNB_PASSWORD, TNB_ACCOUNT_NUMBERS"

  # Clean up sed backup files
  rm -f .env.bak
fi

# ── 4. Google Cloud Console setup ──
echo ""
echo "[4/8] Google Cloud Console setup"
echo ""

SETUP_GOOGLE=false
if [ "$1" = "--gmail" ] || [ "$1" = "--google" ]; then
  SETUP_GOOGLE=true
elif [ ! -f "$HOME/.gmail-mcp/credentials.json" ] && [ ! -f "$HOME/.gdrive-mcp/credentials.json" ]; then
  SETUP_GOOGLE=true
fi

if [ "$SETUP_GOOGLE" = true ]; then
  echo "  Gmail and Google Sheets/Drive require a Google Cloud project."
  echo "  We recommend creating a NEW Gmail account dedicated to your agent."
  echo ""
  echo "  ┌──────────────────────────────────────────────────────────────┐"
  echo "  │  STEP-BY-STEP: Google Cloud Console Setup                   │"
  echo "  ├──────────────────────────────────────────────────────────────┤"
  echo "  │                                                              │"
  echo "  │  1. Go to https://console.cloud.google.com                  │"
  echo "  │     - Sign in with your agent's Google account              │"
  echo "  │     - Click 'Select a project' (top bar) > 'New Project'   │"
  echo "  │     - Name it (e.g. 'Agent K') and click 'Create'          │"
  echo "  │                                                              │"
  echo "  │  2. Enable APIs:                                            │"
  echo "  │     - Go to: APIs & Services > Library                      │"
  echo "  │     - Search 'Gmail API' > click > 'Enable'                │"
  echo "  │     - Search 'Google Sheets API' > click > 'Enable'        │"
  echo "  │     - Search 'Google Drive API' > click > 'Enable'         │"
  echo "  │                                                              │"
  echo "  │  3. Configure OAuth consent screen:                         │"
  echo "  │     - Go to: APIs & Services > OAuth consent screen         │"
  echo "  │     - Choose 'External' > click 'Create'                   │"
  echo "  │     - App name: your agent's name                           │"
  echo "  │     - User support email: your agent's email                │"
  echo "  │     - Developer email: your agent's email                   │"
  echo "  │     - Click 'Save and Continue' through Scopes              │"
  echo "  │     - On 'Test users' page: click 'Add Users'              │"
  echo "  │       > add your agent's Gmail address > 'Save'            │"
  echo "  │     - Click 'Save and Continue' > 'Back to Dashboard'      │"
  echo "  │                                                              │"
  echo "  │  4. Create OAuth credentials:                               │"
  echo "  │     - Go to: APIs & Services > Credentials                  │"
  echo "  │     - Click '+ Create Credentials' > 'OAuth Client ID'    │"
  echo "  │     - Application type: 'Desktop app'                      │"
  echo "  │     - Name: anything (e.g. 'Agent K Desktop')              │"
  echo "  │     - Click 'Create'                                        │"
  echo "  │     - Click 'Download JSON' on the popup                   │"
  echo "  │     - Save the file somewhere accessible                    │"
  echo "  │                                                              │"
  echo "  └──────────────────────────────────────────────────────────────┘"
  echo ""

  # ── 4a. Gmail auth ──
  echo "  --- Gmail API Setup ---"
  if [ "$1" = "--gmail" ] || [ ! -f "$HOME/.gmail-mcp/credentials.json" ]; then
    read -rp "  Path to OAuth client JSON for Gmail (or Enter to skip): " GMAIL_OAUTH_PATH

    if [ -n "$GMAIL_OAUTH_PATH" ] && [ -f "$GMAIL_OAUTH_PATH" ]; then
      echo "  Running Gmail OAuth flow..."
      python3 "$REPO_DIR/scripts/gmail-auth.py" "$GMAIL_OAUTH_PATH"
    else
      echo "  Skipped. Gmail sending disabled."
      echo "  Run ./scripts/setup.sh --gmail later to set up."
    fi
  else
    echo "  Gmail credentials found. Skipping."
  fi

  # ── 4b. Google Drive/Sheets auth ──
  echo ""
  echo "  --- Google Drive & Sheets API Setup ---"
  if [ "$1" = "--google" ] || [ ! -f "$HOME/.gdrive-mcp/sheets-token.json" ]; then
    echo "  (You can reuse the SAME OAuth client JSON from Gmail setup.)"
    read -rp "  Path to OAuth client JSON for Drive/Sheets (or Enter to skip): " GDRIVE_OAUTH_PATH

    if [ -n "$GDRIVE_OAUTH_PATH" ] && [ -f "$GDRIVE_OAUTH_PATH" ]; then
      echo "  Running Google Drive & Sheets OAuth flow..."
      python3 "$REPO_DIR/scripts/gdrive-auth.py" "$GDRIVE_OAUTH_PATH"
    else
      echo "  Skipped. Google Sheets disabled."
      echo "  Run ./scripts/setup.sh --google later to set up."
    fi
  else
    echo "  Google Drive/Sheets credentials found. Skipping."
  fi
else
  echo "  Google credentials found. Skipping."
  echo "  Run with --gmail or --google to reconfigure."
fi

# ── 5. Configure MCP servers info ──
echo ""
echo "[5/8] MCP server status..."

if [ -f "$HOME/.gdrive-mcp/sheets-token.json" ]; then
  echo "  Google Sheets MCP: credentials ready at ~/.gdrive-mcp/"
else
  echo "  Google Sheets MCP: no credentials (skipped)"
fi

if [ -f "$HOME/.gmail-mcp/credentials.json" ]; then
  echo "  Gmail MCP: credentials ready at ~/.gmail-mcp/"
else
  echo "  Gmail MCP: no credentials (skipped)"
fi

# ── 6. Check Claude CLI ──
echo ""
echo "[6/8] Checking prerequisites..."

if command -v claude &>/dev/null; then
  CLAUDE_VER=$(claude --version 2>/dev/null || echo "unknown")
  echo "  Claude CLI: $CLAUDE_VER"
else
  echo "  WARNING: Claude CLI not found."
  echo "  Install with: curl -fsSL https://claude.ai/install.sh | sh"
fi

if command -v node &>/dev/null; then
  echo "  Node.js: $(node --version 2>/dev/null)"
else
  echo "  WARNING: Node.js not found. Required for MCP servers."
fi

if [ -f "$HOME/.local/share/office-venv/bin/python" ]; then
  echo "  Office venv: $($HOME/.local/share/office-venv/bin/python --version 2>/dev/null)"
else
  echo "  WARNING: Office venv not found at ~/.local/share/office-venv/"
  echo "  See SETUP-GUIDE.md Step 1c for installation."
fi

# ── 7. Playwright ──
echo ""
echo "[7/8] Playwright browser..."

if npx playwright --version &>/dev/null 2>&1; then
  echo "  Playwright: installed"
else
  echo "  Installing Playwright chromium..."
  npx playwright install chromium
fi

# ── 8. Mac Mini Headless Setup (optional) ──
echo ""
echo "[8/8] Mac Mini headless setup (optional)"
echo ""
echo "  If you're running Agent K on a Mac Mini as an always-on server,"
echo "  configure it so it won't sleep and the display turns off."
echo ""
echo "  ┌──────────────────────────────────────────────────────────────┐"
echo "  │  Mac Mini Headless Configuration                            │"
echo "  ├──────────────────────────────────────────────────────────────┤"
echo "  │                                                              │"
echo "  │  System Settings > Energy Saver (or Energy):                │"
echo "  │                                                              │"
echo "  │  1. Turn display off after: 2 minutes (or your preference) │"
echo "  │  2. Prevent automatic sleeping when the display is off: ON  │"
echo "  │  3. Wake for network access: ON                             │"
echo "  │  4. Start up automatically after a power failure: ON        │"
echo "  │                                                              │"
echo "  │  System Settings > Lock Screen:                             │"
echo "  │                                                              │"
echo "  │  5. Require password after screen saver begins: Never       │"
echo "  │     (or a long delay — avoids locking you out remotely)     │"
echo "  │                                                              │"
echo "  │  System Settings > General > Login Items & Extensions:      │"
echo "  │                                                              │"
echo "  │  6. Enable 'Allow in the Background' for any launch agents  │"
echo "  │                                                              │"
echo "  │  System Settings > Users & Groups:                          │"
echo "  │                                                              │"
echo "  │  7. Automatic login: Select your user account               │"
echo "  │     (ensures bot starts after reboot without keyboard)      │"
echo "  │                                                              │"
echo "  │  Optional — Enable SSH for remote access:                   │"
echo "  │                                                              │"
echo "  │  8. System Settings > General > Sharing                     │"
echo "  │     > Remote Login: ON                                      │"
echo "  │     (allows ssh into the Mac Mini from another machine)     │"
echo "  │                                                              │"
echo "  └──────────────────────────────────────────────────────────────┘"
echo ""

# ── Done ──
echo ""
echo "========================================="
echo "  Setup complete!"
echo ""
echo "  Start Agent K:"
echo "    claude --channels plugin:telegram@claude-plugins-official --verbose"
echo ""
echo "  Start with full permissions (production):"
echo "    claude --channels plugin:telegram@claude-plugins-official --dangerously-skip-permissions --verbose"
echo ""
echo "  Auto-start on boot:"
echo "    See SETUP-GUIDE.md Step 8 for LaunchAgent setup."
echo ""
echo "  Reconfigure later:"
echo "    ./scripts/setup.sh --reconfigure  (env vars)"
echo "    ./scripts/setup.sh --gmail        (Gmail API)"
echo "    ./scripts/setup.sh --google       (Google Drive/Sheets)"
echo "========================================="
echo ""
