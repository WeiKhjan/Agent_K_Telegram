---
name: debug
description: Diagnose Agent K bot issues — check audit logs, process status, DB health, and recent errors. Use when something isn't working, bot errors out, requests time out, user reports Agent K issues, or you need to check why a message failed.
---

## When to Use
When debugging bot issues, checking if messages were processed, or diagnosing errors.

## Diagnostic Steps

### 1. Bot Process
```bash
pgrep -f "node src/index.js" && echo "Bot is running" || echo "Bot NOT running"
```

### 2. Recent Audit Log (last 10 messages)
```bash
sqlite3 ~/Agent_K_Telegram/data/bot.db \
  "SELECT id, telegram_user_id, substr(user_message,1,80) as msg, created_at FROM audit_log ORDER BY id DESC LIMIT 10;"
```

### 3. Session Status
```bash
sqlite3 ~/Agent_K_Telegram/data/bot.db \
  "SELECT telegram_user_id, session_id, updated_at FROM sessions;"
```

### 4. DB Health
```bash
sqlite3 ~/Agent_K_Telegram/data/bot.db "PRAGMA integrity_check;"
sqlite3 ~/Agent_K_Telegram/data/bot.db "SELECT count(*) as total_messages FROM audit_log;"
ls -la ~/Agent_K_Telegram/data/bot.db
```

### 5. Active Claude Processes
```bash
pgrep -fa "claude.*-p" || echo "No Claude processes running"
```

### 6. Symlink Health
```bash
ls -la ~/.claude/skills
ls ~/.claude/skills/ | wc -l
```

## Output Format
Summarize findings as:
- **Bot:** running / not running
- **Last message:** timestamp + preview
- **DB:** healthy / issue
- **Skills:** N skills linked
- **Issues found:** list any problems
