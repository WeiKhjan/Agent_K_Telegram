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
    `);

    // Add mcp_keys column if missing (migration for existing DBs)
    try {
      db.exec(`ALTER TABLE sessions ADD COLUMN mcp_keys TEXT DEFAULT ''`);
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

// Initialize DB eagerly at startup (avoid race conditions from concurrent handlers)
getDb();

const clearHistory = (userId) => {
  const db = getDb();
  const deleted = db.prepare('DELETE FROM audit_log WHERE telegram_user_id = ?').run(String(userId));
  db.prepare('DELETE FROM sessions WHERE telegram_user_id = ?').run(String(userId));
  return deleted.changes;
};

module.exports = { getSession, saveSession, logMessage, getRecentMessages, clearHistory };
