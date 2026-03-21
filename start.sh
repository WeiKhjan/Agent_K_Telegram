#!/bin/zsh
# Start Agent K via Claude Code Official Telegram Channel
# Run in a separate terminal or tmux session

export PATH="$HOME/.bun/bin:$PATH"

echo "Starting Agent K (Claude Code Telegram Channel)..."
echo "   Press Ctrl+C to stop"
echo ""

claude --channels plugin:telegram@claude-plugins-official
