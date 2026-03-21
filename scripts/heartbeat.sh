#!/bin/zsh
# Telegram Channel Heartbeat Monitor
# Checks if the Telegram bot is responsive via Bot API.
# If the bot is unresponsive OR claude isn't running, kills and lets launchd restart.

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$SCRIPT_DIR/logs/heartbeat.log"
TOKEN_FILE="$HOME/.claude/channels/telegram/.env"
MAX_FAILURES=3
STATE_FILE="/tmp/agent-k-heartbeat-failures"

# Read bot token
TOKEN=$(grep TELEGRAM_BOT_TOKEN "$TOKEN_FILE" 2>/dev/null | cut -d= -f2)
if [[ -z "$TOKEN" ]]; then
    echo "$(date): ERROR - No bot token found" >> "$LOG"
    exit 1
fi

# Check if claude channel process is running
CLAUDE_PID=$(pgrep -f "claude.*channels.*telegram" 2>/dev/null)
if [[ -z "$CLAUDE_PID" ]]; then
    echo "$(date): Claude channel process not running — launchd should restart" >> "$LOG"
    # Reset failure counter
    echo 0 > "$STATE_FILE"
    exit 0
fi

# Ping Telegram Bot API
RESPONSE=$(curl -s -m 10 "https://api.telegram.org/bot${TOKEN}/getMe" 2>/dev/null)
BOT_OK=$(echo "$RESPONSE" | grep -c '"ok":true')

if [[ "$BOT_OK" -eq 1 ]]; then
    # Bot API is reachable — reset failure counter
    echo 0 > "$STATE_FILE"
    exit 0
fi

# Bot API failed — increment failure counter
FAILURES=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
FAILURES=$((FAILURES + 1))
echo "$FAILURES" > "$STATE_FILE"

echo "$(date): Telegram API check failed ($FAILURES/$MAX_FAILURES) — PID: $CLAUDE_PID" >> "$LOG"

if [[ "$FAILURES" -ge "$MAX_FAILURES" ]]; then
    echo "$(date): Max failures reached — killing claude (PID: $CLAUDE_PID) for restart" >> "$LOG"
    kill "$CLAUDE_PID" 2>/dev/null
    sleep 2
    # Force kill if still alive
    kill -9 "$CLAUDE_PID" 2>/dev/null
    echo 0 > "$STATE_FILE"
    echo "$(date): Claude killed — launchd will restart" >> "$LOG"
fi
