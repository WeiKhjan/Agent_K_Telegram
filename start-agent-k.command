#!/bin/zsh
# Agent K auto-start via Login Item
# Opens in Terminal.app — real TTY + keychain access for Claude auth

cd "$HOME"
export PATH="$HOME/.bun/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

while true; do
    echo "🤖 Starting Agent K... ($(date))"
    claude --channels plugin:telegram@claude-plugins-official --dangerously-skip-permissions --verbose
    EXIT_CODE=$?
    echo "⚠️  Agent K exited with code $EXIT_CODE at $(date). Restarting in 30s..."
    sleep 30
done
