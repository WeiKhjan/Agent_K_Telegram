#!/bin/zsh
# Start Agent K via Claude Code Official Telegram Channel
# Auto-starts on boot via LaunchAgent

export PATH="$HOME/.bun/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

claude --channels plugin:telegram@claude-plugins-official --dangerously-skip-permissions --verbose
