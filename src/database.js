const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '..', 'data', 'bot.db');
let db = null;

const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes

const getDb = () => {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        telegram_user_id TEXT PRIMARY KEY,
        session_id TEXT,
        mcp_keys TEXT,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_user_id TEXT,
        user_message TEXT,
        bot_response TEXT,
        created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS session_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_user_id TEXT,
        event_type TEXT,
        detail TEXT,
        created_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_session_events_user ON session_events(telegram_user_id, created_at);
    `);

    // Add mcp_keys column if missing (migration for existing DBs)
    try {
      db.exec(`ALTER TABLE sessions ADD COLUMN mcp_keys TEXT DEFAULT ''`);
    } catch { /* column already exists */ }

    // Add preferred_model column if missing (migration for existing DBs)
    try {
      db.exec(`ALTER TABLE sessions ADD COLUMN preferred_model TEXT DEFAULT 'auto'`);
    } catch { /* column already exists */ }

    // Add max_turns column if missing (migration for existing DBs)
    try {
      db.exec(`ALTER TABLE sessions ADD COLUMN max_turns INTEGER DEFAULT 30`);
    } catch { /* column already exists */ }
  }
  return db;
};

const getSession = (userId) => {
  const row = getDb().prepare('SELECT session_id, mcp_keys, updated_at FROM sessions WHERE telegram_user_id = ?').get(String(userId));
  if (!row) return null;

  // Check if session has expired (15min inactivity)
  const lastActive = new Date(row.updated_at).getTime();
  const now = Date.now();
  if (now - lastActive > SESSION_TTL_MS) {
    // Session expired — clear it
    getDb().prepare('DELETE FROM sessions WHERE telegram_user_id = ?').run(String(userId));
    console.log(`[${new Date().toLocaleTimeString()}] 🕐 Session expired for ${userId} (inactive ${Math.round((now - lastActive) / 60000)}min)`);
    return null;
  }

  return row;
};

const saveSession = (userId, sessionId, mcpKeys = '') => {
  if (sessionId) {
    getDb().prepare(`
      INSERT INTO sessions (telegram_user_id, session_id, mcp_keys, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(telegram_user_id) DO UPDATE SET session_id = ?, mcp_keys = ?, updated_at = ?
    `).run(String(userId), sessionId, mcpKeys, new Date().toISOString(), sessionId, mcpKeys, new Date().toISOString());
  } else {
    getDb().prepare('DELETE FROM sessions WHERE telegram_user_id = ?').run(String(userId));
  }
};

// Get last N messages for a user (for fresh session context)
const getRecentMessages = (userId, limit = 5) => {
  return getDb().prepare(`
    SELECT user_message, bot_response, created_at
    FROM audit_log
    WHERE telegram_user_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(String(userId), limit).reverse(); // reverse to chronological order
};

const logMessage = (userId, userMsg, botResp) => {
  try {
    getDb().prepare(`
      INSERT INTO audit_log (telegram_user_id, user_message, bot_response, created_at)
      VALUES (?, ?, ?, ?)
    `).run(String(userId), userMsg.slice(0, 10000), botResp.slice(0, 50000), new Date().toISOString());
  } catch (e) { console.error(`[DB] logMessage failed: ${e.message}`); }
};

const VALID_MODELS = ['auto', 'haiku', 'sonnet', 'opus'];
// Ollama model names: alphanumeric, hyphens, dots, underscores, and colon (for tags like "llama3:8b")
const isValidModel = (m) => VALID_MODELS.includes(m) || (typeof m === 'string' && /^ollama:[\w.\-:]+$/.test(m));

const getPreferredModel = (userId) => {
  const row = getDb().prepare('SELECT preferred_model FROM sessions WHERE telegram_user_id = ?').get(String(userId));
  return (row?.preferred_model && isValidModel(row.preferred_model)) ? row.preferred_model : 'auto';
};

const setPreferredModel = (userId, model) => {
  if (!isValidModel(model)) return;
  getDb().prepare(`
    INSERT INTO sessions (telegram_user_id, preferred_model, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_user_id) DO UPDATE SET preferred_model = ?, updated_at = ?
  `).run(String(userId), model, new Date().toISOString(), model, new Date().toISOString());
};

// Log a structured session event (Phase 3: dual audit trail)
const logEvent = (userId, eventType, detail) => {
  try {
    getDb().prepare(`
      INSERT INTO session_events (telegram_user_id, event_type, detail, created_at)
      VALUES (?, ?, ?, ?)
    `).run(String(userId), eventType, String(detail).slice(0, 2000), new Date().toISOString());
  } catch (e) { /* ignore */ }
};

// Get last N session events for a user (for /debug-session command)
const getSessionEvents = (userId, limit = 20) => {
  return getDb().prepare(`
    SELECT event_type, detail, created_at
    FROM session_events
    WHERE telegram_user_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(String(userId), limit).reverse();
};

// Per-user max_turns setting (Phase 4: budget control)
const getUserMaxTurns = (userId) => {
  const row = getDb().prepare('SELECT max_turns FROM sessions WHERE telegram_user_id = ?').get(String(userId));
  const val = row?.max_turns;
  return (val && Number.isInteger(val) && val > 0) ? val : 30;
};

const setUserMaxTurns = (userId, turns) => {
  const n = Math.max(1, Math.min(100, parseInt(turns, 10) || 30));
  getDb().prepare(`
    INSERT INTO sessions (telegram_user_id, max_turns, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_user_id) DO UPDATE SET max_turns = ?, updated_at = ?
  `).run(String(userId), n, new Date().toISOString(), n, new Date().toISOString());
};

// Initialize DB eagerly at startup (avoid race conditions from concurrent handlers)
getDb();

module.exports = {
  getSession, saveSession, logMessage, getRecentMessages,
  getPreferredModel, setPreferredModel,
  logEvent, getSessionEvents,
  getUserMaxTurns, setUserMaxTurns,
};
