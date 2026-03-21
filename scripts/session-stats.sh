#!/bin/zsh
# session-stats.sh — Read Claude session token usage and cost
# Usage:
#   bash session-stats.sh snapshot    — save current totals to /tmp (call at START of task)
#   bash session-stats.sh diff        — show delta since last snapshot (call at END of task)
#   bash session-stats.sh             — show cumulative session totals

SESSIONS_DIR="$HOME/.claude/sessions"
PROJECT_DIR="$HOME/.claude/projects/-Users-$(whoami)"
SNAPSHOT_FILE="/tmp/claude-session-stats-snapshot"

# Find current session
SESSION_FILE=$(ls -t "$SESSIONS_DIR"/*.json 2>/dev/null | head -1)
if [ -z "$SESSION_FILE" ]; then
    echo "No active session found"
    exit 1
fi
SESSION_ID=$(python3 -c "import json; print(json.load(open('$SESSION_FILE'))['sessionId'])")
JSONL="$PROJECT_DIR/$SESSION_ID.jsonl"

if [ ! -f "$JSONL" ]; then
    echo "Session log not found: $JSONL"
    exit 1
fi

MODE="${1:-total}"

python3 -c "
import json, os
from datetime import datetime

jsonl = '$JSONL'
mode = '$MODE'
snapshot_file = '$SNAPSHOT_FILE'

total_input = 0
total_output = 0
total_cache_read = 0
total_cache_create = 0
turns = 0
first_ts = None
last_ts = None

with open(jsonl) as f:
    for line in f:
        d = json.loads(line.strip())
        ts = d.get('timestamp', 0)
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts.replace('Z','+00:00')).timestamp() * 1000
            except:
                ts = 0
        if first_ts is None and ts:
            first_ts = ts
        if ts:
            last_ts = ts

        if d.get('type') == 'assistant':
            msg = d.get('message', {})
            if isinstance(msg, dict):
                usage = msg.get('usage', {})
                if usage:
                    turns += 1
                    total_input += usage.get('input_tokens', 0)
                    total_output += usage.get('output_tokens', 0)
                    total_cache_read += usage.get('cache_read_input_tokens', 0)
                    total_cache_create += usage.get('cache_creation_input_tokens', 0)

if mode == 'snapshot':
    with open(snapshot_file, 'w') as f:
        json.dump({
            'input': total_input,
            'output': total_output,
            'cache_read': total_cache_read,
            'cache_create': total_cache_create,
            'turns': turns,
            'ts': last_ts or 0
        }, f)
    print('snapshot saved')

elif mode == 'diff':
    prev = {'input':0,'output':0,'cache_read':0,'cache_create':0,'turns':0,'ts':0}
    if os.path.exists(snapshot_file):
        with open(snapshot_file) as f:
            prev = json.load(f)

    d_input = total_input - prev['input']
    d_output = total_output - prev['output']
    d_cache_read = total_cache_read - prev['cache_read']
    d_cache_create = total_cache_create - prev['cache_create']
    d_turns = turns - prev['turns']
    d_duration = ((last_ts or 0) - prev.get('ts', 0)) / 1000 if prev.get('ts') else 0

    cost = (d_input * 15 + d_output * 75 + d_cache_read * 1.875 + d_cache_create * 18.75) / 1_000_000
    total_cost = (total_input * 15 + total_output * 75 + total_cache_read * 1.875 + total_cache_create * 18.75) / 1_000_000

    print(f'In: {d_input:,} | Cache read: {d_cache_read:,} | Cache write: {d_cache_create:,} | Out: {d_output:,} | Cost: \${cost:.2f} (session: \${total_cost:.2f}) | {d_duration:.0f}s | Turns: {d_turns}')

else:
    cost = (total_input * 15 + total_output * 75 + total_cache_read * 1.875 + total_cache_create * 18.75) / 1_000_000
    duration_min = (last_ts - first_ts) / 60000 if first_ts and last_ts else 0
    print(f'Tokens: {total_input + total_cache_read + total_cache_create:,} in / {total_output:,} out | Cost: \${cost:.2f} | Duration: {duration_min:.0f}min | Turns: {turns}')
"
