require('dotenv').config();

// Validate required env vars
const REQUIRED_ENV = ['TELEGRAM_BOT_TOKEN'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}. Copy .env.example to .env and configure.`);
    process.exit(1);
  }
}

const { Telegraf } = require('telegraf');
const { runClaude, isComplexTask } = require('./claude-runner');
const { logMessage, getRecentMessages, clearHistory } = require('./database');
const { isUserAllowed, splitMessage, markdownToHtml } = require('./utils');
const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
  telegram: {
    apiRoot: 'https://api.telegram.org',
    agent: new (require('https').Agent)({ keepAlive: true, timeout: 120000 }),
    webhookReply: false,
  },
  handlerTimeout: 1_800_000, // 30 min — match Claude's hard timeout
});
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];

// Track users currently being processed to prevent duplicate spawns
const processingUsers = new Map(); // userId -> { startTime, messageId, abort }

// Session store: chatId -> { sessionId, lastActivity, model }
// Allows --resume to avoid reloading 100k+ tokens on each message
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const chatSessions = new Map();

// Get a valid (non-expired) session ID for a chat, or null
function getSessionId(chatId) {
  const session = chatSessions.get(String(chatId));
  if (!session) return null;
  if (Date.now() - session.lastActivity > SESSION_TIMEOUT_MS) {
    chatSessions.delete(String(chatId));
    console.log(`  ⏰ Session expired for chat ${chatId}`);
    return null;
  }
  return session.sessionId;
}

// Store/update session ID for a chat
function setSessionId(chatId, sessionId) {
  if (!sessionId) return;
  chatSessions.set(String(chatId), { sessionId, lastActivity: Date.now() });
}

// Clear session for a chat (used by /new command)
function clearSessionId(chatId) {
  chatSessions.delete(String(chatId));
}

// Daily midnight cleanup — clear all sessions to free context
function scheduleMidnightCleanup() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0); // next midnight
  const msUntilMidnight = midnight - now;

  setTimeout(() => {
    console.log('🧹 Midnight cleanup: clearing all chat sessions');
    chatSessions.clear();
    processingUsers.clear();
    console.log(`  ✅ Sessions cleared at ${new Date().toISOString()}`);
    // Schedule next midnight cleanup (every 24h)
    setInterval(() => {
      console.log('🧹 Midnight cleanup: clearing all chat sessions');
      chatSessions.clear();
      processingUsers.clear();
      console.log(`  ✅ Sessions cleared at ${new Date().toISOString()}`);
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);

  console.log(`⏰ Midnight cleanup scheduled in ${Math.round(msUntilMidnight / 60000)} minutes`);
}
scheduleMidnightCleanup();

// Helper: Resolve file path relative to workspace
const resolvePath = (filePath) => {
  if (!filePath) return null;
  let resolved = filePath.trim();
  if (!path.isAbsolute(resolved)) {
    resolved = path.join(process.env.WORKSPACE_DIR, resolved);
  }
  return resolved.replace(/\//g, path.sep);
};

// Helper: Extract files from [SEND_IMAGE:] and [SEND_FILE:] tags
const findFilesToSend = (response) => {
  const images = [], files = [];
  const extract = (pattern, arr) => {
    let match;
    while ((match = pattern.exec(response)) !== null) {
      const filePath = resolvePath(match[1]);
      if (filePath && fs.existsSync(filePath) && !arr.includes(filePath)) {
        arr.push(filePath);
      }
    }
  };
  extract(/\[SEND_IMAGE:\s*([^\]]+)\]/gi, images);
  extract(/\[SEND_FILE:\s*([^\]]+)\]/gi, files);
  return { images, files };
};

// Helper: Download file from URL
const downloadFile = (url, dest) => new Promise((resolve, reject) => {
  const file = fs.createWriteStream(dest);
  https.get(url, (res) => {
    res.pipe(file);
    file.on('finish', () => { file.close(); resolve(); });
  }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
});

// Helper: Send response with files
const sendResponse = async (telegram, chatId, response, userId) => {
  const { images, files } = findFilesToSend(response);
  const clean = response.replace(/\[SEND_(IMAGE|FILE):\s*[^\]]+\]/gi, '').trim();

  // Send text
  for (const chunk of splitMessage(markdownToHtml(clean))) {
    try {
      await telegram.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
    } catch {
      await telegram.sendMessage(chatId, clean.slice(0, 4000));
      break;
    }
  }

  // Send images & files
  for (const p of images) {
    await telegram.sendPhoto(chatId, { source: p }, { caption: path.basename(p) }).catch(() => {});
  }
  for (const p of files) {
    await telegram.sendDocument(chatId, { source: p }, { caption: path.basename(p) }).catch(() => {});
  }
};

// Middleware: Only respond in allowed chats. Ignore everything else.
bot.use(async (ctx, next) => {
  const chatId = ctx.chat?.id;
  const chatType = ctx.chat?.type;

  // Only respond in allowed chats (from ALLOWED_CHAT_IDS env var)
  const allowedChats = (process.env.ALLOWED_CHAT_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
  if (allowedChats.length === 0) return next(); // no restriction if unset
  if (!allowedChats.includes(String(chatId))) {
    console.log(`[${new Date().toLocaleTimeString()}] ⛔ Ignored chat ${chatId} (${chatType}) from ${ctx.from?.username || ctx.from?.id}`);
    return;
  }

  // In private/DM chats — process all messages directly (no mention needed)
  if (chatType === 'private') return next();

  // In groups/supergroups, only respond if bot is mentioned or replied to
  if (chatType === 'group' || chatType === 'supergroup') {
    const text = ctx.message?.text || ctx.message?.caption || '';
    const botInfo = await ctx.telegram.getMe();
    const botUsername = botInfo.username;

    const isMentioned = text.includes(`@${botUsername}`);
    const isReplyToBot = ctx.message?.reply_to_message?.from?.id === botInfo.id;

    if (!isMentioned && !isReplyToBot) return;

    console.log(`[${new Date().toLocaleTimeString()}] 📩 ${ctx.from?.username || ctx.from?.id}: ${(ctx.message?.text || ctx.message?.caption || '').slice(0, 80)}`);

    // Strip the @botusername from the message before processing
    if (ctx.message?.text) {
      ctx.message.text = ctx.message.text.replace(new RegExp(`@${botUsername}`, 'g'), '').trim();
    }

    // Prepend replied-to message content so Claude has full context
    if (isReplyToBot && ctx.message?.reply_to_message?.text) {
      const quoted = ctx.message.reply_to_message.text.slice(0, 500);
      ctx.message.text = `[Replying to your message: "${quoted}"]\n\n${ctx.message.text}`;
    }

    return next();
  }
});

// Commands
bot.start((ctx) => ctx.reply(
  `Welcome to Agent K!\n\n` +
  `Commands:\n/new - New conversation\n/clear - Clear chat history\n/status - Bot status\n/test - Test CLI\n` +
  `/cancel - Cancel current request\n/cd <path> - Change workspace\n/sendfile <name> - Send file\n\nJust send a message!`
));

bot.command('chatid', (ctx) => {
  ctx.reply(`Chat ID: ${ctx.chat.id}`);
});

bot.command('new', async (ctx) => {
  clearSessionId(ctx.chat.id);
  ctx.reply('🆕 New conversation started. Session cleared.');
});

bot.command('status', async (ctx) => {
  const recent = getRecentMessages(ctx.from.id.toString(), 1);
  const lastMsg = recent.length > 0 ? new Date(recent[0].created_at).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' }) : 'None';
  const session = chatSessions.get(String(ctx.chat.id));
  const sessionInfo = session
    ? `Active (${session.sessionId.slice(0, 8)}..., ${Math.round((Date.now() - session.lastActivity) / 1000)}s ago)`
    : 'None';
  ctx.reply(`Status: ✅ Online\nLast message: ${lastMsg}\nSession: ${sessionInfo}\nWorkspace: ${process.env.WORKSPACE_DIR}`);
});

bot.command('cd', (ctx) => {
  const newPath = ctx.message.text.slice(4).trim();
  if (!newPath) return ctx.reply(`Workspace: ${process.env.WORKSPACE_DIR}`);
  if (fs.existsSync(newPath)) {
    process.env.WORKSPACE_DIR = newPath;
    ctx.reply(`✅ Changed to: ${newPath}`);
  } else {
    ctx.reply(`❌ Path not found`);
  }
});

bot.command('test', (ctx) => {
  try {
    const { execSync } = require('child_process');
    const ver = execSync('claude --version', { encoding: 'utf8', shell: true, timeout: 10000 });
    ctx.reply(`Claude CLI: ✅ ${ver.trim()}`);
  } catch (e) {
    ctx.reply(`Claude CLI: ❌ ${e.message}`);
  }
});

bot.command('cancel', async (ctx) => {
  const userId = ctx.from.id.toString();
  if (processingUsers.has(userId)) {
    const info = processingUsers.get(userId);
    if (info.abort) info.abort.abort(); // kill the Claude process
    processingUsers.delete(userId);
    clearSessionId(ctx.chat.id); // clear session since it may be in a bad state
    ctx.reply('🛑 Request cancelled. You can send a new message now.');
  } else {
    ctx.reply('No active request to cancel.');
  }
});

bot.command('sendfile', async (ctx) => {
  const file = ctx.message.text.slice(10).trim();
  if (!file) return ctx.reply('Usage: /sendfile <filename>');

  const fullPath = resolvePath(file);
  if (!fs.existsSync(fullPath)) return ctx.reply(`❌ File not found`);

  const ext = path.extname(fullPath).toLowerCase();
  try {
    if (IMAGE_EXTS.includes(ext)) {
      await ctx.replyWithPhoto({ source: fullPath });
    } else {
      await ctx.replyWithDocument({ source: fullPath });
    }
  } catch (e) {
    ctx.reply(`❌ ${e.message}`);
  }
});

bot.command('clear', async (ctx) => {
  const userId = ctx.from.id.toString();
  const count = clearHistory(userId);
  clearSessionId(ctx.chat.id);
  ctx.reply(`🗑 Chat cleared. Removed ${count} message${count !== 1 ? 's' : ''} from history. Session reset.`);
});

// Handle text messages
bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;

  const userId = ctx.from.id.toString();
  const chatId = ctx.chat.id;

  // Check if already processing for this user
  if (processingUsers.has(userId)) {
    const info = processingUsers.get(userId);
    const elapsed = Math.round((Date.now() - info.startTime) / 1000);
    // Auto-clear stale locks after 5 minutes
    if (elapsed > 1800) {
      processingUsers.delete(userId);
      await ctx.reply('Previous request timed out. Processing your new message...');
    } else {
      await ctx.reply(`⏳ Still processing your previous request (${elapsed}s). Use /cancel to abort.`);
      return;
    }
  }

  const complex = isComplexTask(ctx.message.text);
  console.log(`[${new Date().toLocaleTimeString()}] ⚙️  Processing for ${ctx.from?.username || userId}${complex ? ' [OPUS]' : ''}...`);
  const msg = await ctx.reply(complex ? '🧠 Processing with Opus...' : '🤔 Processing...');
  const abort = new AbortController();
  let lastStatus = 'Thinking...';
  processingUsers.set(userId, { startTime: Date.now(), messageId: msg.message_id, abort });

  const onProgress = (status) => {
    if (status) lastStatus = status;
  };

  // Progress: update message with elapsed time + status every 30s
  const progressInterval = setInterval(async () => {
    const info = processingUsers.get(userId);
    if (!info) return clearInterval(progressInterval);
    const elapsed = Math.round((Date.now() - info.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    await ctx.telegram.editMessageText(chatId, msg.message_id, null,
      `🤔 ${lastStatus} (${mins}m ${secs}s)\n/cancel to abort`
    ).catch(() => {});
  }, 30000);

  // Run Claude in background (don't await) so Telegraf can process /cancel and other updates
  const startTime = Date.now();
  const messageText = ctx.message.text;
  const repliedMsg = ctx.message.reply_to_message;
  const chatType = ctx.chat?.type;
  const userName = ctx.from?.first_name || ctx.from?.username || 'Unknown';
  const fromUsername = ctx.from?.username || userId;

  (async () => {
    let prompt = messageText;
    try {
      // Build prompt — include reply context if user replied to a bot message
      if (repliedMsg?.from?.id === (await ctx.telegram.getMe()).id && repliedMsg?.text) {
        const quoted = repliedMsg.text.slice(0, 500);
        prompt = `[Replying to your message: "${quoted}"]\n\n${prompt}`;
      }

      // Inject chat context so Claude knows where the message came from
      const isGroup = chatType === 'group' || chatType === 'supergroup';
      const chatContext = isGroup
        ? `[Chat context: Telegram GROUP chat ${chatId}. Send files/messages to GROUP $TELEGRAM_GROUP_CHAT_ID]\n[User: ${userName} (ID: ${userId})]`
        : `[Chat context: Telegram DM (private) chat ${chatId}. Send files/messages to DM $TELEGRAM_DM_CHAT_ID]\n[User: ${userName} (ID: ${userId})]`;

      const resumeSessionId = getSessionId(chatId);

      // Only inject conversation history for fresh sessions (no --resume)
      // Resumed sessions already have full conversation context in the Claude session
      if (!resumeSessionId) {
        const recent = getRecentMessages(userId, 5);
        if (recent.length > 0) {
          const history = recent.map(m => {
            const time = new Date(m.created_at).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' });
            const userMsg = (m.user_message || '').slice(0, 2000);
            const botMsg = (m.bot_response || '').slice(0, 2000);
            return `[${time}] User: ${userMsg}\n[${time}] Bot: ${botMsg}`;
          }).join('\n\n');
          prompt = `${chatContext}\n[Recent conversation history for context]\n${history}\n\n---\n[Current message]\n${prompt}`;
        } else {
          prompt = `${chatContext}\n${prompt}`;
        }
      } else {
        prompt = `${chatContext}\n${prompt}`;
      }
      const result = await runClaude(prompt, { onProgress, signal: abort.signal, userMessage: messageText, sessionId: resumeSessionId });

      // Store session ID for future --resume (saves reloading 100k+ tokens)
      if (result.sessionId) {
        setSessionId(chatId, result.sessionId);
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const resumed = resumeSessionId ? ' [resumed]' : '';
      console.log(`[${new Date().toLocaleTimeString()}] ✅ Reply to ${fromUsername} (${elapsed}s, ${result.response.length} chars)${resumed}`);

      await logMessage(userId, prompt, result.response);
      await ctx.telegram.deleteMessage(chatId, msg.message_id).catch(() => {});
      await sendResponse(ctx.telegram, chatId, result.response, userId);
    } catch (e) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[${new Date().toLocaleTimeString()}] ❌ Error for ${fromUsername} (${elapsed}s): ${e.message}`);
      // Clear session on error so next message starts fresh
      clearSessionId(chatId);
      // Log failed/cancelled requests to audit_log too
      await logMessage(userId, prompt, `[ERROR after ${elapsed}s] ${e.message}`);
      await ctx.telegram.deleteMessage(chatId, msg.message_id).catch(() => {});
      if (e.message !== 'Request cancelled') {
        await ctx.telegram.sendMessage(chatId, `❌ Error: ${e.message}`);
      }
    } finally {
      clearInterval(progressInterval);
      processingUsers.delete(userId);
    }
  })();
});

// Handle photos & documents
const handleMedia = async (ctx, getFile, prompt) => {
  const userId = ctx.from.id.toString();
  const chatId = ctx.chat.id;

  // Check if already processing for this user
  if (processingUsers.has(userId)) {
    const info = processingUsers.get(userId);
    const elapsed = Math.round((Date.now() - info.startTime) / 1000);
    // Auto-clear stale locks after 5 minutes
    if (elapsed > 1800) {
      processingUsers.delete(userId);
      await ctx.reply('Previous request timed out. Processing your new message...');
    } else {
      await ctx.reply(`⏳ Still processing your previous request (${elapsed}s). Use /cancel to abort.`);
      return;
    }
  }

  const msg = await ctx.reply('🤔 Processing...');
  const abort = new AbortController();
  let lastStatus = 'Thinking...';
  processingUsers.set(userId, { startTime: Date.now(), messageId: msg.message_id, abort });

  const onProgress = (status) => {
    if (status) lastStatus = status;
  };

  const progressInterval = setInterval(async () => {
    const info = processingUsers.get(userId);
    if (!info) return clearInterval(progressInterval);
    const elapsed = Math.round((Date.now() - info.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    await ctx.telegram.editMessageText(chatId, msg.message_id, null,
      `🤔 ${lastStatus} (${mins}m ${secs}s)\n/cancel to abort`
    ).catch(() => {});
  }, 30000);

  // Run in background (don't await) so Telegraf can process /cancel and other updates
  const startTime = Date.now();
  const fromUsername = ctx.from?.username || userId;
  const fileId = getFile(ctx);
  const docFileName = ctx.message?.document?.file_name;
  const chatType = ctx.chat?.type;

  (async () => {
    console.log(`[${new Date().toLocaleTimeString()}] 📎 Media from ${fromUsername}: ${prompt.slice(0, 60)}`);
    try {
      const link = await ctx.telegram.getFileLink(fileId);
      // Preserve original filename for documents, fallback to URL extension
      const origName = docFileName;
      const ext = origName ? path.extname(origName) : (path.extname(new URL(link.href).pathname) || '.tmp');
      const dest = path.join(process.env.WORKSPACE_DIR, `upload_${Date.now()}${ext}`);
      await downloadFile(link.href, dest);

      // Inject chat context so Claude knows where the message came from
      const isGroup = chatType === 'group' || chatType === 'supergroup';
      const chatContext = isGroup
        ? `[Chat context: Telegram GROUP chat ${chatId}. Send files/messages to GROUP $TELEGRAM_GROUP_CHAT_ID]`
        : `[Chat context: Telegram DM (private) chat ${chatId}. Send files/messages to DM $TELEGRAM_DM_CHAT_ID]`;
      const filePrompt = `${chatContext}\n${prompt}\n\nThe user sent a file. It has been downloaded to: ${dest}\nOriginal filename: ${origName || 'unknown'}\nPlease read/process this file to answer the user's request.`;
      const resumeSessionId = getSessionId(chatId);
      const result = await runClaude(filePrompt, { onProgress, signal: abort.signal, userMessage: prompt, sessionId: resumeSessionId });

      // Store session ID for future --resume
      if (result.sessionId) {
        setSessionId(chatId, result.sessionId);
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const resumed = resumeSessionId ? ' [resumed]' : '';
      console.log(`[${new Date().toLocaleTimeString()}] ✅ Media reply to ${fromUsername} (${elapsed}s)${resumed}`);
      await logMessage(userId, filePrompt, result.response);
      await ctx.telegram.deleteMessage(chatId, msg.message_id).catch(() => {});
      await sendResponse(ctx.telegram, chatId, result.response);
    } catch (e) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[${new Date().toLocaleTimeString()}] ❌ Media error for ${fromUsername} (${elapsed}s): ${e.message}`);
      // Clear session on error so next message starts fresh
      clearSessionId(chatId);
      await logMessage(userId, prompt, `[ERROR after ${elapsed}s] ${e.message}`);
      await ctx.telegram.deleteMessage(chatId, msg.message_id).catch(() => {});
      if (e.message !== 'Request cancelled') {
        await ctx.telegram.sendMessage(chatId, `❌ ${e.message}`);
      }
    } finally {
      clearInterval(progressInterval);
      processingUsers.delete(userId);
    }
  })();
};

bot.on('photo', (ctx) => handleMedia(ctx,
  (c) => c.message.photo[c.message.photo.length - 1].file_id,
  ctx.message.caption || 'Analyze this image'
));

bot.on('document', (ctx) => handleMedia(ctx,
  (c) => c.message.document.file_id,
  ctx.message.caption || `Process: ${ctx.message.document.file_name}`
));

// Error handling
bot.catch((err, ctx) => {
  console.error(`[${new Date().toISOString()}] Bot middleware error:`, err.message);
  ctx.reply('An error occurred. Please try again.').catch(() => {});
});

// Auto-restart polling on crash
async function startBot() {
  const webhookUrl = process.env.WEBHOOK_URL;

  if (webhookUrl && !webhookUrl.includes('your-subdomain')) {
    const app = express();
    app.use(express.json());
    app.get('/', (_, res) => res.send('Tele Agent K running!'));
    app.use(bot.webhookCallback('/webhook'));

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, async () => {
      console.log(`🤖 Server on port ${PORT} | Workspace: ${process.env.WORKSPACE_DIR}`);
      setTimeout(async () => {
        try {
          await bot.telegram.setWebhook(webhookUrl);
          console.log(`✅ Webhook: ${webhookUrl}`);
        } catch {
          console.log('Falling back to polling...');
          bot.launch();
        }
      }, 2000);
    });
  } else {
    console.log(`🤖 Starting Agent K in polling mode | Workspace: ${process.env.WORKSPACE_DIR}`);
    await bot.launch({
      dropPendingUpdates: true,
      allowedUpdates: ['message', 'callback_query'],
      polling: { timeout: 60 },  // long-poll 60s (default 30s)
    });
  }
}

// Global error handlers — prevent crash on network timeouts
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] Uncaught exception: ${err.message}`);
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED' || err.code === 'EAI_AGAIN') {
    console.log('⚡ Network error detected, restarting bot in 5s...');
    bot.stop('restart').catch(() => {});
    setTimeout(() => startBot().catch(console.error), 5000);
  } else {
    console.error('💀 Fatal error, exiting...');
    process.exit(1);
  }
});

process.on('unhandledRejection', (err) => {
  console.error(`[${new Date().toISOString()}] Unhandled rejection:`, err?.message || err);
});

startBot().catch(console.error);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
