#!/bin/zsh
# Start Agent K via Claude Code Official Telegram Channel
# Auto-starts on boot via LaunchAgent
# Workspace trust pre-approved in ~/.claude.json

export PATH="$HOME/.bun/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# script allocates a pseudo-TTY so Claude stays in interactive mode
# (launchd doesn't provide a TTY, causing Claude to enter --print mode)
script -q /dev/null claude --dangerously-skip-permissions --verbose --channels plugin:telegram@claude-plugins-official
