const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { buildSystemContext } = require('./memory');

// File logger — writes to logs/activity/YYYY-MM-DD.log
const LOG_DIR = path.resolve(__dirname, '..', 'logs', 'activity');
function logToFile(level, msg) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const time = new Date().toISOString().slice(11, 23);
    const line = `[${time}] [${level}] ${msg}\n`;
    fs.appendFileSync(path.join(LOG_DIR, `${date}.log`), line);
  } catch { /* ignore logging errors */ }
}

// MCP server configs — only loaded when message matches keywords
const MCP_SERVERS = {
  playwright: {
    keywords: ['browse', 'website', 'webpage', 'search', 'google', 'screenshot', 'scrape', 'url', 'http', 'open page', 'navigate', 'check in', 'check-in', 'boarding pass', 'book flight', 'airline', 'playwright'],
    config: {
      command: 'npx',
      args: ['@playwright/mcp@latest', '--browser', 'chromium',
        ...(process.env.PLAYWRIGHT_CHROME_PATH ? ['--executable-path', process.env.PLAYWRIGHT_CHROME_PATH] : [])]
    }
  },
  'chrome-devtools': {
    keywords: ['devtools', 'debug page', 'inspect', 'performance trace'],
    config: {
      command: 'npx',
      args: ['chrome-devtools-mcp', '--headless']
    }
  },
  gmail: {
    keywords: ['email', 'gmail', 'mail', 'inbox', 'send email'],
    config: {
      command: 'npx',
      args: ['@gongrzhe/server-gmail-autoauth-mcp']
    }
  }
};

// Detect which MCP servers are needed based on message content
function detectMcpServers(message) {
  const lower = message.toLowerCase();
  const needed = {};
  for (const [name, server] of Object.entries(MCP_SERVERS)) {
    if (server.keywords.some(kw => lower.includes(kw))) {
      needed[name] = server.config;
    }
  }
  return needed;
}

// Detect if a task is complex enough to warrant Opus
const COMPLEX_PATTERNS = [
  // Browser automation — multi-step, needs reasoning
  /check.?in.*flight|boarding pass|web check.?in/i,
  /book.*flight|book.*hotel|book.*ticket/i,
  /fill.*form|submit.*form|complete.*registration/i,
  // Multi-step workflows
  /create.*invoice.*send|generate.*contract.*email/i,
  /research.*and.*summarize|analyze.*and.*report/i,
  /compare.*and.*recommend/i,
  // Code tasks
  /refactor|debug.*and.*fix|implement.*feature/i,
  /write.*script.*that|build.*a.*tool/i,
  // Data extraction & consolidation — multi-sheet/file reads
  /consolidat|all.*sheet|each.*sheet|multiple.*sheet|cross.*reference/i,
  /extract.*from.*excel|read.*excel|from.*spreadsheet/i,
  /all.*candidate|all.*participant|all.*employee|all.*staff/i,
  /generate.*t3|hrdc|psmb|sbl.khas|attendance.*list/i,
  /recon|reconcil/i,
  // Explicit upgrade
  /use opus|opus mode|smart mode/i,
];

function isComplexTask(message) {
  // Check pattern matches
  if (COMPLEX_PATTERNS.some(p => p.test(message))) return true;
  // If Playwright is needed, it's likely complex (browser automation = many steps)
  const mcpServers = detectMcpServers(message);
  if (mcpServers.playwright) return true;
  return false;
}

// Parse a stream-json event into a short, meaningful status (< 10 words)
const TOOL_LABELS = {
  Read: 'Reading file',
  Write: 'Writing file',
  Edit: 'Editing file',
  Bash: 'Running command',
  Glob: 'Searching files',
  Grep: 'Searching code',
  WebFetch: 'Fetching webpage',
  WebSearch: 'Searching the web',
  Task: 'Running subtask',
  NotebookEdit: 'Editing notebook',
};

function parseStreamEvent(line) {
  try {
    const ev = JSON.parse(line);

    // Tool use events
    if (ev.type === 'assistant' && ev.message?.content) {
      for (const block of ev.message.content) {
        if (block.type === 'tool_use') {
          const tool = block.name;
          const label = TOOL_LABELS[tool] || `Using ${tool}`;
          const input = block.input || {};
          if (input.file_path) return `${label}: ${input.file_path.split('/').pop()}`;
          if (input.command) return `${label}: ${input.command.slice(0, 30)}`;
          if (input.pattern) return `${label}: "${input.pattern}"`;
          if (input.query) return `${label}: "${input.query.slice(0, 25)}"`;
          if (input.url) return `Fetching: ${input.url.slice(0, 35)}`;
          return label;
        }
        if (block.type === 'thinking') return 'Thinking...';
      }
    }

    // Result event — final response
    if (ev.type === 'result') return 'Finishing up...';

    // Legacy/fallback: direct tool field
    const tool = ev.tool || ev.tool_name;
    if (tool) {
      const label = TOOL_LABELS[tool] || `Using ${tool}`;
      const input = ev.tool_input || ev.input || {};
      if (input.file_path) return `${label}: ${input.file_path.split('/').pop()}`;
      if (input.command) return `${label}: ${input.command.slice(0, 30)}`;
      return label;
    }
    if (ev.type === 'thinking' || ev.event === 'thinking') return 'Thinking...';
  } catch {
    // Not JSON — check for common text patterns
    if (/thinking/i.test(line)) return 'Thinking...';
    if (/tool.*read/i.test(line)) return 'Reading file';
    if (/tool.*bash/i.test(line)) return 'Running command';
    if (/generating/i.test(line)) return 'Generating...';
  }
  return null;
}

// Internal: spawn a single Claude CLI process and return its result
// This is the low-level function; runClaude wraps it with session resume + retry logic
function _spawnClaude(message, { onProgress, signal, userMessage, sessionId } = {}) {
  return new Promise((resolve, reject) => {
    const cwd = process.env.WORKSPACE_DIR || process.cwd();
    // Use raw user message for keyword detection (avoids false positives from system context)
    const detectText = userMessage || message;
    const complex = isComplexTask(detectText);
    const model = 'opus'; // Always use Opus 4.6 (1M context window)
    const maxTurns = complex ? '70' : '30';
    const args = ['-p', '--verbose', '--output-format', 'stream-json', '--dangerously-skip-permissions', '--model', model, '--max-turns', maxTurns];

    // Resume existing session if available (avoids reloading full context)
    if (sessionId) {
      args.push('--resume', sessionId);
      console.log(`  🔄 Resuming session: ${sessionId.slice(0, 8)}...`);
    }

    // Smart MCP: only load servers matching the user's actual message
    const mcpServers = detectMcpServers(detectText);
    const serverCount = Object.keys(mcpServers).length;

    if (serverCount > 0) {
      const mcpConfig = JSON.stringify({ mcpServers: mcpServers });
      args.push('--mcp-config', mcpConfig, '--strict-mcp-config');
    } else {
      args.push('--strict-mcp-config'); // no MCP servers = fast mode
    }

    // Inject persistent memory as system context (skip when resuming — session already has it)
    if (!sessionId) {
      const systemContext = buildSystemContext();
      if (systemContext) {
        args.push('--append-system-prompt', systemContext);
      }
    }

    args.push(message);

    const env = { ...process.env, HOME: process.env.HOME };
    delete env.CLAUDECODE;
    delete env.TERM_PROGRAM;
    env.CI = '1';

    if (serverCount > 0) {
      console.log(`  ⚙️  Loading MCP: ${Object.keys(mcpServers).join(', ')}`);
    } else {
      console.log(`  ⚡ Fast mode (no MCP)`);
    }
    console.log(`  🧠 Model: ${model}${complex ? ' (complex task detected)' : ''}`);

    // Log full command for debugging
    const cmdPreview = `claude ${args.map(a => a.length > 100 ? a.slice(0, 100) + '...' : a).join(' ')}`;
    logToFile('CMD', cmdPreview);
    logToFile('INFO', `Model: ${model}${complex ? ' (complex)' : ''} | MCP: ${serverCount > 0 ? Object.keys(mcpServers).join(', ') : 'none'}${sessionId ? ` | Resume: ${sessionId.slice(0, 8)}` : ''}`);
    logToFile('INFO', `Message: ${message.slice(0, 200)}`);

    const proc = spawn('claude', args, {
      cwd, env, shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;
    let resultEvent = null; // The final "result" JSON event
    let lastAssistantText = ''; // Track last assistant text for tool-call-ending sessions
    let lastOutputTime = Date.now();
    // Accumulate token usage across all turns
    let totalUsage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

    // 30 minute hard timeout
    const timeout = setTimeout(() => {
      killed = true;
      logToFile('TIMEOUT', `Claude process killed after 30min. stdout: ${stdout.length} chars`);
      logToFile('TIMEOUT', `Last stdout (500 chars): ${stdout.slice(-500)}`);
      proc.kill('SIGTERM');
      setTimeout(() => proc.kill('SIGKILL'), 5000);
      reject(new Error('Claude timed out after 30 minutes'));
    }, 30 * 60 * 1000);

    // Stall detector: kill if no output for 20 minutes (catches TCC permission hangs)
    const stallCheck = setInterval(() => {
      if (Date.now() - lastOutputTime > 20 * 60 * 1000) {
        killed = true;
        logToFile('STALL', `No output for 20min — likely stuck (TCC/permission hang). Killing.`);
        logToFile('STALL', `Last stdout (500 chars): ${stdout.slice(-500)}`);
        clearInterval(stallCheck);
        proc.kill('SIGTERM');
        setTimeout(() => proc.kill('SIGKILL'), 5000);
        reject(new Error('Claude stalled (no output for 20 minutes) — possible macOS permission hang. Try granting Full Disk Access to node in System Settings.'));
      }
    }, 60000);

    // Support cancellation via AbortSignal
    if (signal) {
      signal.addEventListener('abort', () => {
        killed = true;
        logToFile('CANCEL', `Request cancelled. stdout: ${stdout.length} chars`);
        logToFile('CANCEL', `Last stdout (500 chars): ${stdout.slice(-500)}`);
        proc.kill('SIGTERM');
        setTimeout(() => proc.kill('SIGKILL'), 3000);
        reject(new Error('Request cancelled'));
      }, { once: true });
    }

    // stream-json: all events come on stdout as newline-delimited JSON
    proc.stdout.on('data', (chunk) => {
      lastOutputTime = Date.now();
      stdout += chunk.toString();
      const text = chunk.toString().trim();
      if (!text) return;
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Log all events to file for debugging
        logToFile('EVENT', trimmed.slice(0, 500));
        // Check if this is the final result event + accumulate usage
        try {
          const ev = JSON.parse(trimmed);
          if (ev.type === 'result') {
            resultEvent = ev;
          }
          // Track last assistant text content (for when session ends on a tool call)
          if (ev.type === 'assistant' && ev.message?.content) {
            const textBlocks = ev.message.content.filter(b => b.type === 'text' && b.text);
            if (textBlocks.length > 0) {
              lastAssistantText = textBlocks.map(b => b.text).join('\n');
            }
          }
          // Accumulate token usage from assistant events
          const usage = ev.message?.usage || ev.usage;
          if (usage) {
            totalUsage.input_tokens += usage.input_tokens || 0;
            totalUsage.output_tokens += usage.output_tokens || 0;
            totalUsage.cache_creation_input_tokens += usage.cache_creation_input_tokens || 0;
            totalUsage.cache_read_input_tokens += usage.cache_read_input_tokens || 0;
          }
        } catch { /* not JSON */ }
        // Parse for progress updates
        const status = parseStreamEvent(trimmed);
        if (status && onProgress) onProgress(status);
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      logToFile('STDERR', chunk.toString().trim().slice(0, 500));
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      clearInterval(stallCheck);
      if (killed) return;

      logToFile('EXIT', `Claude exited code=${code} | stdout=${stdout.length} chars | stderr=${stderr.length} chars`);

      if (code !== 0 && !resultEvent) {
        logToFile('ERROR', `Non-zero exit. stderr: ${stderr.slice(0, 1000)}`);
        return reject(new Error(stderr || `Claude exited with code ${code}`));
      }

      // Build token usage footer with estimated API cost
      const durationSec = resultEvent ? ((resultEvent.duration_ms || 0) / 1000).toFixed(1) : '?';
      const turns = resultEvent?.num_turns || '?';
      const totalIn = totalUsage.input_tokens + totalUsage.cache_creation_input_tokens + totalUsage.cache_read_input_tokens;
      const totalAll = totalIn + totalUsage.output_tokens;

      // API pricing per million tokens (as of 2025)
      const pricing = model === 'opus'
        ? { input: 15, cacheCreate: 18.75, cacheRead: 1.50, output: 75 }
        : model === 'haiku'
        ? { input: 0.80, cacheCreate: 1.00, cacheRead: 0.08, output: 4 }
        : { input: 3, cacheCreate: 3.75, cacheRead: 0.30, output: 15 }; // sonnet
      const costInput = (totalUsage.input_tokens / 1e6) * pricing.input;
      const costCacheCreate = (totalUsage.cache_creation_input_tokens / 1e6) * pricing.cacheCreate;
      const costCacheRead = (totalUsage.cache_read_input_tokens / 1e6) * pricing.cacheRead;
      const costOutput = (totalUsage.output_tokens / 1e6) * pricing.output;
      const totalCost = costInput + costCacheCreate + costCacheRead + costOutput;
      const costStr = totalCost < 0.01 ? '<$0.01' : `$${totalCost.toFixed(2)}`;

      const tokenFooter = `\n\n---\n📊 *${totalAll.toLocaleString()} tokens* · 💰 ${costStr}\n⬇️ ${totalIn.toLocaleString()} in (${totalUsage.cache_read_input_tokens.toLocaleString()} cached) · ⬆️ ${totalUsage.output_tokens.toLocaleString()} out · 🔄 ${turns} turns · ⏱️ ${durationSec}s · 🧠 ${model}`;

      logToFile('USAGE', `in=${totalUsage.input_tokens} cache_create=${totalUsage.cache_creation_input_tokens} cache_read=${totalUsage.cache_read_input_tokens} out=${totalUsage.output_tokens} turns=${turns} duration=${durationSec}s model=${model} cost=${costStr}`);

      // With stream-json, the last event is the result
      if (resultEvent) {
        const text = (resultEvent.result != null && resultEvent.result !== '') ? resultEvent.result
          : (resultEvent.message != null && resultEvent.message !== '') ? resultEvent.message
          : (lastAssistantText !== '') ? lastAssistantText
          : null;
        if (!text) {
          const denied = resultEvent.permission_denials?.map(d => d.tool_name).join(', ');
          const hitMaxTurns = resultEvent.stop_reason === 'max_turns' || resultEvent.num_turns >= parseInt(maxTurns);
          const fallback = denied
            ? `⚠️ Claude couldn't complete — permission denied for: ${denied}`
            : hitMaxTurns
            ? `⚠️ Max turns (${maxTurns}) reached — task too long. Try breaking it into smaller steps.`
            : '⚠️ Claude returned an empty response. Try again.';
          logToFile('WARN', `Empty response. stop_reason=${resultEvent.stop_reason || 'none'} Denied tools: ${denied || 'none'}. Session: ${resultEvent.session_id || 'none'}`);
          resolve({ response: fallback + tokenFooter, sessionId: resultEvent.session_id || null });
        } else {
          const source = (resultEvent.result != null && resultEvent.result !== '') ? 'result'
            : (resultEvent.message != null && resultEvent.message !== '') ? 'message'
            : 'lastAssistantText';
          logToFile('OK', `Response (${source}): ${text.length} chars | Session: ${resultEvent.session_id || 'none'}`);
          resolve({ response: text + tokenFooter, sessionId: resultEvent.session_id || null });
        }
      } else {
        // Fallback: try to parse the last line of stdout as JSON
        const lines = stdout.trim().split('\n').filter(Boolean);
        const lastLine = lines[lines.length - 1];
        try {
          const r = JSON.parse(lastLine);
          const text = r.result || r.message || r.text || '';
          logToFile('WARN', `No result event, parsed last line: ${text.length} chars`);
          resolve({ response: text || 'Done', sessionId: r.session_id || null });
        } catch {
          logToFile('WARN', `No result event, no parseable JSON. Raw stdout: ${stdout.length} chars`);
          resolve({ response: stdout.trim() || 'Done', sessionId: null });
        }
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      if (!killed) reject(new Error(err.message));
    });
  });
}

// Session resume with automatic fallback: if --resume fails, retry without it
const runClaude = async (message, opts = {}) => {
  const { sessionId, ...restOpts } = opts;

  // If we have a session to resume, try it first
  if (sessionId) {
    try {
      const result = await _spawnClaude(message, { ...restOpts, sessionId });
      return result;
    } catch (err) {
      // Don't retry on cancellation or timeout — those are intentional
      if (err.message === 'Request cancelled' || err.message.includes('timed out') || err.message.includes('stalled')) {
        throw err;
      }
      // Resume failed — fall back to fresh session
      logToFile('RESUME_FAIL', `Session ${sessionId.slice(0, 8)} failed: ${err.message}. Retrying without --resume.`);
      console.log(`  ⚠️  Resume failed, starting fresh session. Error: ${err.message.slice(0, 80)}`);
    }
  }

  // Fresh session (no --resume)
  return _spawnClaude(message, restOpts);
};

module.exports = { runClaude, isComplexTask, detectMcpServers };
