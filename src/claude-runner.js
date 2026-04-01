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
  },
  duckduckgo: {
    keywords: ['search', 'google', 'look up', 'find info', 'latest news', 'current', 'today', 'recent', 'what is', 'who is', 'price of', 'news', 'internet', 'online', 'real-time', 'real time', 'live'],
    config: {
      command: '/home/lerler/.nvm/versions/node/v20.20.1/bin/duckduckgo-mcp',
      args: []
    }
  }
};

// Score an MCP server against message tokens (Phase 2: permission context)
// Returns count of keyword matches — load server if score > 0
function scoreMcpServer(server, tokens) {
  return server.keywords.reduce((score, kw) => {
    return score + (tokens.some(t => kw.includes(t) || t === kw) ? 1 : 0);
  }, 0);
}

// Detect which MCP servers are needed based on scored token overlap
function detectMcpServers(message) {
  const tokens = message.toLowerCase().match(/\w+/g) || [];
  const needed = {};
  for (const [name, server] of Object.entries(MCP_SERVERS)) {
    if (scoreMcpServer(server, tokens) > 0) {
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

// Patterns for simple tasks that can use cheap local LLM (Ollama)
const SIMPLE_PATTERNS = [
  /^(hi|hello|hey|good\s*(morning|afternoon|evening))[.!?]?$/i,
  /what('?s| is) (the time|today|the date|the weather)/i,
  /translate|in (malay|chinese|mandarin|bahasa|spanish|french|german)/i,
  /what does .{1,40} mean/i,
  /calculate|how much is \d|what is \d.*\d/i,
  /define |what is a |explain briefly|summarize in one sentence/i,
  /^(thanks|thank you|ok|okay|got it|noted)[.!?]?$/i,
  /^(yes|no|true|false)[.!?]?$/i,
];

function shouldUseOllama(message, ollamaAvailable, mcpServers) {
  if (process.env.OLLAMA_ONLY === 'true') return true;  // Force all tasks to Ollama (bypasses availability check)
  if (!ollamaAvailable) return false;                // Ollama not available
  if (isComplexTask(message)) return false;          // Complex = use Claude
  if (mcpServers.playwright) return false;           // Browser automation = Claude
  if (mcpServers.duckduckgo) return false;           // Web search = Claude (Ollama has no search tools)
  if (/^\/[a-z-]+\s/i.test(message)) return false;  // Skills (/skill-name) = Claude
  if (process.env.OLLAMA_DEFAULT === 'true') return true; // Educator opt-in for all simple tasks
  return SIMPLE_PATTERNS.some(p => p.test(message.trim())); // Match simple patterns
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

// Phase 1: Typed event dispatcher — replaces ad-hoc if/else in stdout handler
// Each handler receives (event, state) and mutates state in place
const STREAM_EVENT_HANDLERS = {
  result: (ev, state) => {
    state.resultEvent = ev;
    if (ev.is_error) {
      const errText = JSON.stringify(ev).toLowerCase();
      if (/credit|rate.limit|402|429|billing/.test(errText)) {
        state.rateLimitRejected = true;
        logToFile('WARN', 'Rate limit detected in result event');
      }
    }
  },
  rate_limit_event: (ev, state) => {
    const info = ev.rate_limit_info || {};
    if (info.status === 'rejected') {
      state.rateLimitRejected = true;
      state.rateLimitResetsAt = info.resetsAt || null;
      logToFile('WARN', `Rate limit rejected: type=${info.rateLimitType} resetsAt=${info.resetsAt}`);
    }
  },
};

function dispatchStreamEvent(ev, state) {
  const handler = STREAM_EVENT_HANDLERS[ev.type];
  if (handler) handler(ev, state);
  // Accumulate token usage from any event that carries it
  const usage = ev.message?.usage || ev.usage;
  if (usage) {
    state.totalUsage.input_tokens += usage.input_tokens || 0;
    state.totalUsage.output_tokens += usage.output_tokens || 0;
    state.totalUsage.cache_creation_input_tokens += usage.cache_creation_input_tokens || 0;
    state.totalUsage.cache_read_input_tokens += usage.cache_read_input_tokens || 0;
  }
}

// Simple session model: every message is a fresh Claude process
// Context comes from recent history injected into the prompt (by index.js)
// No --resume, no session tracking, no MCP mismatch issues
const MODEL_IDS = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus:   'claude-opus-4-6',
};

const runClaude = (message, { onProgress, signal, modelOverride, maxTurns } = {}) => {
  return new Promise((resolve, reject) => {
    const cwd = process.env.WORKSPACE_DIR || process.cwd();
    const complex = isComplexTask(message);
    // Use user-selected model if set; fall back to auto-detection
    const model = (modelOverride && modelOverride !== 'auto') ? modelOverride : (complex ? 'opus' : 'sonnet');
    const modelId = MODEL_IDS[model] || model;
    const turns = (maxTurns && Number.isInteger(maxTurns) && maxTurns > 0) ? maxTurns : 30;
    const args = ['-p', '--verbose', '--output-format', 'stream-json', '--dangerously-skip-permissions', '--model', modelId, '--max-turns', String(turns)];

    // Smart MCP: only load servers matching the message
    const mcpServers = detectMcpServers(message);
    const serverCount = Object.keys(mcpServers).length;

    if (serverCount > 0) {
      const mcpConfig = JSON.stringify({ mcpServers: mcpServers });
      args.push('--mcp-config', mcpConfig, '--strict-mcp-config');
    } else {
      args.push('--strict-mcp-config'); // no MCP servers = fast mode
    }

    // Inject persistent memory as system context
    const systemContext = buildSystemContext();
    if (systemContext) {
      args.push('--append-system-prompt', systemContext);
    }

    args.push(message);

    // Build a minimal allowlist of safe environment variables (security: don't leak secrets to child process)
    const SAFE_ENV_KEYS = [
      'HOME', 'PATH', 'SHELL', 'LANG', 'LANGUAGE', 'TERM', 'USER', 'TMPDIR', 'TMP', 'TEMP',
      'WORKSPACE_DIR', 'CI', 'NODE_ENV',
      // Claude CLI specific
      'ANTHROPIC_API_KEY', 'CLAUDE_CODE_USE_BEDROCK', 'AWS_REGION',
    ];
    const env = {};
    for (const key of SAFE_ENV_KEYS) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
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
    logToFile('INFO', `Model: ${model}${complex ? ' (complex)' : ''} | MCP: ${serverCount > 0 ? Object.keys(mcpServers).join(', ') : 'none'}`);
    logToFile('INFO', `Message: ${message.slice(0, 200)}`);

    const proc = spawn('claude', args, {
      cwd, env, shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;
    let lastOutputTime = Date.now();
    // Typed event state — mutated by STREAM_EVENT_HANDLERS dispatcher
    const state = {
      resultEvent: null,
      totalUsage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      rateLimitRejected: false,
      rateLimitResetsAt: null,
    };

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
        // Dispatch to typed event handlers
        try {
          const ev = JSON.parse(trimmed);
          dispatchStreamEvent(ev, state);
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

      // Detect rate limit / credit exhaustion
      const stderrRateLimit = /402|429|out.of.credit|rate.limit|credit.balance|billing/i.test(stderr);
      if (state.rateLimitRejected || (code !== 0 && stderrRateLimit)) {
        const resetMsg = state.rateLimitResetsAt
          ? ` Resets at ${new Date(state.rateLimitResetsAt * 1000).toLocaleTimeString()}.`
          : '';
        logToFile('WARN', `Claude rate limited.${resetMsg}`);
        const err = new Error(`Claude usage limit reached.${resetMsg}`);
        err.isRateLimit = true;
        err.resetsAt = state.rateLimitResetsAt;
        return reject(err);
      }

      if (code !== 0 && !state.resultEvent) {
        logToFile('ERROR', `Non-zero exit. stderr: ${stderr.slice(0, 1000)}`);
        return reject(new Error(stderr || `Claude exited with code ${code}`));
      }

      // Build token usage footer with estimated API cost
      const { totalUsage, resultEvent } = state;
      const durationSec = resultEvent ? ((resultEvent.duration_ms || 0) / 1000).toFixed(1) : '?';
      const numTurns = resultEvent?.num_turns || '?';
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

      const tokenFooter = `\n\n---\n📊 *${totalAll.toLocaleString()} tokens* · 💰 ${costStr}\n⬇️ ${totalIn.toLocaleString()} in (${totalUsage.cache_read_input_tokens.toLocaleString()} cached) · ⬆️ ${totalUsage.output_tokens.toLocaleString()} out · 🔄 ${numTurns} turns · ⏱️ ${durationSec}s · 🧠 ${model}`;

      logToFile('USAGE', `in=${totalUsage.input_tokens} cache_create=${totalUsage.cache_creation_input_tokens} cache_read=${totalUsage.cache_read_input_tokens} out=${totalUsage.output_tokens} turns=${numTurns} duration=${durationSec}s model=${model} cost=${costStr}`);

      // With stream-json, the last event is the result
      if (resultEvent) {
        const text = (resultEvent.result != null && resultEvent.result !== '') ? resultEvent.result
          : (resultEvent.message != null && resultEvent.message !== '') ? resultEvent.message
          : null;
        if (!text) {
          const denied = resultEvent.permission_denials?.map(d => d.tool_name).join(', ');
          const fallback = denied ? `⚠️ Claude couldn't complete — permission denied for: ${denied}` : '⚠️ Claude returned an empty response. Try again.';
          logToFile('WARN', `Empty response. Denied tools: ${denied || 'none'}. Session: ${resultEvent.session_id || 'none'}`);
          resolve({ response: fallback + tokenFooter, sessionId: resultEvent.session_id || null });
        } else {
          logToFile('OK', `Response: ${text.length} chars | Session: ${resultEvent.session_id || 'none'}`);
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
};

module.exports = { runClaude, isComplexTask, detectMcpServers, shouldUseOllama };
