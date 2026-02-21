import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || process.env.BROWSER_PORT || 3001);
const OLLAMA_DEFAULT_BASE = 'http://localhost:11434';
const RAW_AUTH_TOKEN_TTL_DAYS = Number(process.env.AUTH_TOKEN_TTL_DAYS || 30);
const AUTH_TOKEN_TTL_DAYS = Number.isFinite(RAW_AUTH_TOKEN_TTL_DAYS) && RAW_AUTH_TOKEN_TTL_DAYS > 0
  ? RAW_AUTH_TOKEN_TTL_DAYS
  : 30;
const AUTH_TOKEN_TTL_MS = AUTH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'nexus-auth.sqlite');
const LOG_PATH = process.env.APP_LOG_PATH || path.join(process.cwd(), 'data', 'app.log');
const LOG_MAX_STRING = Number(process.env.APP_LOG_MAX_STRING || 8000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const SHOULD_SERVE_CLIENT = process.env.SERVE_CLIENT !== 'false';

let browser = null;
let browserLaunching = null;
let authDb = null;

async function ensureBrowser() {
  if (browser && browser.isConnected()) return browser;
  if (!browserLaunching) {
    browserLaunching = chromium.launch({ headless: true })
      .then((launched) => {
        browser = launched;
        browserLaunching = null;
        browser.on('disconnected', () => {
          browser = null;
        });
        console.log('Playwright browser initialized');
        return browser;
      })
      .catch((err) => {
        browserLaunching = null;
        throw err;
      });
  }
  return browserLaunching;
}

const normalizeUrl = (input) => {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : (trimmed.startsWith('//') ? `https:${trimmed}` : `https://${trimmed}`);
  try {
    const parsed = new URL(withProtocol);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch (err) {
    return null;
  }
};

const normalizeOllamaBase = (input) => {
  const raw = (input ? String(input).trim() : '') || process.env.OLLAMA_BASE_URL || OLLAMA_DEFAULT_BASE;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) return null;
    const cleanedPath = parsed.pathname.replace(/\/+$/, '').replace(/\/v1$/i, '');
    parsed.pathname = cleanedPath;
    return parsed.toString().replace(/\/$/, '');
  } catch (err) {
    return null;
  }
};

const parseOllamaModelsFromOpenAI = (data) => {
  if (!data || !Array.isArray(data.data)) return [];
  return data.data.map((m) => m?.id).filter(Boolean);
};

const parseOllamaModelsFromTags = (data) => {
  if (!data || !Array.isArray(data.models)) return [];
  return data.models.map((m) => m?.name).filter(Boolean);
};

const parseOllamaPullStatus = (text) => {
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]);
      if (obj?.status) return obj.status;
      if (obj?.error) return obj.error;
    } catch (err) {
      continue;
    }
  }
  return String(text).slice(0, 200);
};

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
  'password',
  'pass',
  'pwd',
  'secret',
  'token',
  'authorization',
  'apiKey',
  'apikey',
  'api_key',
  'key',
  'credentials'
]);

const REDACT_PATTERNS = [
  /bearer\s+[a-z0-9._-]+/gi,
  /\bsk-[a-z0-9_-]{8,}\b/gi,
  /\bgsk_[a-z0-9_-]{8,}\b/gi,
  /\bsk-ant-[a-z0-9_-]{8,}\b/gi,
  /\bAIza[0-9a-z_-]{8,}\b/gi,
  /\bxai-[a-z0-9_-]{8,}\b/gi
];

const ensureLogDir = () => {
  const dir = path.dirname(LOG_PATH);
  if (dir && dir !== '.') {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const hashIdentifier = (value) => {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
};

const redactString = (value) => {
  let output = String(value);
  for (const pattern of REDACT_PATTERNS) {
    output = output.replace(pattern, REDACTED);
  }
  if (LOG_MAX_STRING > 0 && output.length > LOG_MAX_STRING) {
    const extra = output.length - LOG_MAX_STRING;
    return `${output.slice(0, LOG_MAX_STRING)}...[truncated ${extra} chars]`;
  }
  return output;
};

const sanitizeForLog = (value, depth = 0) => {
  if (depth > 8) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, depth + 1));
  }
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (typeof value === 'object') {
    const output = {};
    for (const [key, val] of Object.entries(value)) {
      const lowerKey = String(key).toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('token')) {
        output[key] = REDACTED;
        continue;
      }
      output[key] = sanitizeForLog(val, depth + 1);
    }
    return output;
  }
  return value;
};

const appendLog = async (entry) => {
  try {
    ensureLogDir();
    const line = `${JSON.stringify(entry)}\n`;
    console.log(line.trim());
    await fs.promises.appendFile(LOG_PATH, line, 'utf8');
  } catch (err) {
    console.warn('Failed to write log entry', err);
  }
};

const ensureAuthDb = async () => {
  if (authDb) return authDb;
  const dir = path.dirname(SQLITE_PATH);
  if (dir && dir !== '.') {
    fs.mkdirSync(dir, { recursive: true });
  }

  authDb = await open({
    filename: SQLITE_PATH,
    driver: sqlite3.Database
  });

  await authDb.exec('PRAGMA foreign_keys = ON;');
  await authDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await authDb.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await authDb.run(`DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')`);
  console.log(`SQLite auth DB ready at ${SQLITE_PATH}`);
  return authDb;
};

const hashPassword = async (password) => bcrypt.hash(password, 10);
const verifyPassword = async (password, hash) => bcrypt.compare(password, hash);

const getAuthToken = (req) => {
  const header = String(req.headers?.authorization || '');
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  return req.body?.token || req.query?.token || null;
};

const createSession = async (userId) => {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + AUTH_TOKEN_TTL_MS).toISOString();
  await authDb.run(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt]
  );
  return { token, expiresAt };
};

const fetchSessionUser = async (token) => {
  if (!token) return null;
  const row = await authDb.get(
    `SELECT sessions.token, sessions.expires_at, users.id as userId, users.email, users.name
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token = ?`,
    token
  );
  if (!row) return null;
  const expiry = Date.parse(row.expires_at);
  if (Number.isFinite(expiry) && expiry <= Date.now()) {
    await authDb.run('DELETE FROM sessions WHERE token = ?', token);
    return null;
  }
  return {
    token: row.token,
    expiresAt: row.expires_at,
    user: { id: row.userId, email: row.email, name: row.name }
  };
};

app.post('/api/log', async (req, res) => {
  try {
    const event = String(req.body?.event || '').trim();
    if (!event) {
      return res.status(400).json({ ok: false, error: 'Event is required.' });
    }

    const levelRaw = String(req.body?.level || 'info').toLowerCase();
    const level = ['info', 'warn', 'error'].includes(levelRaw) ? levelRaw : 'info';
    const source = String(req.body?.source || 'client');
    const timestamp = new Date(Number(req.body?.ts || Date.now())).toISOString();

    let user = null;
    const token = getAuthToken(req);
    if (token) {
      await ensureAuthDb();
      const session = await fetchSessionUser(token);
      if (session?.user) {
        user = {
          id: session.user.id,
          emailHash: hashIdentifier(session.user.email || ''),
          name: session.user.name || null
        };
      }
    }

    const entry = {
      ts: timestamp,
      level,
      event,
      source,
      user,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      data: sanitizeForLog(req.body?.data || {})
    };

    void appendLog(entry);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Logging failed.' });
  }
});

app.post('/api/browse', async (req, res) => {
  const normalizedUrl = normalizeUrl(req.body?.url);
  if (!normalizedUrl) {
    return res.status(400).json({ error: 'Valid http/https URL is required', success: false });
  }

  let page = null;

  try {
    const browserInstance = await ensureBrowser();
    page = await browserInstance.newPage();
    await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const content = await page.evaluate(() => {
      document.querySelectorAll('script, style, nav, header, footer').forEach(el => el.remove());
      return document.body.innerText;
    });

    const cleanContent = content.replace(/\s+/g, ' ').trim().slice(0, 20000);
    res.json({ content: cleanContent, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message, success: false });
  } finally {
    if (page) {
      try { await page.close(); } catch (e) {}
    }
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    await ensureAuthDb();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim() || null;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ ok: false, error: 'A valid email is required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters.' });
    }

    const existing = await authDb.get('SELECT id FROM users WHERE email = ?', email);
    if (existing) {
      return res.status(409).json({ ok: false, error: 'Email already exists. Please sign in.' });
    }

    const passwordHash = await hashPassword(password);
    const result = await authDb.run(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      [email, passwordHash, name]
    );
    const userId = result.lastID;
    const session = await createSession(userId);
    void appendLog({
      ts: new Date().toISOString(),
      level: 'info',
      event: 'auth_register',
      source: 'server',
      user: { id: userId, emailHash: hashIdentifier(email), name },
      data: { emailDomain: email.split('@')[1] || null }
    });
    return res.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: { id: userId, email, name }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return res.status(500).json({ ok: false, error: message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    await ensureAuthDb();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required.' });
    }

    const user = await authDb.get(
      'SELECT id, email, name, password_hash FROM users WHERE email = ?',
      email
    );
    if (!user) {
      void appendLog({
        ts: new Date().toISOString(),
        level: 'warn',
        event: 'auth_login_failed',
        source: 'server',
        user: { emailHash: hashIdentifier(email) },
        data: { reason: 'invalid_credentials' }
      });
      return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      void appendLog({
        ts: new Date().toISOString(),
        level: 'warn',
        event: 'auth_login_failed',
        source: 'server',
        user: { id: user.id, emailHash: hashIdentifier(email), name: user.name || null },
        data: { reason: 'invalid_credentials' }
      });
      return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
    }

    const session = await createSession(user.id);
    void appendLog({
      ts: new Date().toISOString(),
      level: 'info',
      event: 'auth_login_success',
      source: 'server',
      user: { id: user.id, emailHash: hashIdentifier(email), name: user.name || null }
    });
    return res.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return res.status(500).json({ ok: false, error: message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    await ensureAuthDb();
    const token = getAuthToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Missing token.' });
    }

    const session = await fetchSessionUser(token);
    if (!session) {
      return res.status(401).json({ ok: false, error: 'Session expired. Please sign in again.' });
    }

    return res.json({ ok: true, user: session.user, expiresAt: session.expiresAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to validate session';
    return res.status(500).json({ ok: false, error: message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    await ensureAuthDb();
    const token = getAuthToken(req);
    if (!token) {
      return res.status(400).json({ ok: false, error: 'Missing token.' });
    }
    const session = await fetchSessionUser(token);
    await authDb.run('DELETE FROM sessions WHERE token = ?', token);
    void appendLog({
      ts: new Date().toISOString(),
      level: 'info',
      event: 'auth_logout',
      source: 'server',
      user: session?.user ? {
        id: session.user.id,
        emailHash: hashIdentifier(session.user.email || ''),
        name: session.user.name || null
      } : null
    });
    return res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logout failed';
    return res.status(500).json({ ok: false, error: message });
  }
});

app.get('/api/ollama/models', async (req, res) => {
  const base = normalizeOllamaBase(req.query?.baseUrl);
  if (!base) {
    return res.status(400).json({ ok: false, error: 'Invalid Ollama base URL' });
  }
  try {
    const resOpenAI = await fetch(`${base}/v1/models`);
    if (resOpenAI.ok) {
      const data = await resOpenAI.json();
      const models = parseOllamaModelsFromOpenAI(data);
      if (models.length > 0) {
        return res.json({ ok: true, source: 'openai', models });
      }
    }
  } catch (err) {}

  try {
    const resTags = await fetch(`${base}/api/tags`);
    if (!resTags.ok) {
      return res.status(resTags.status).json({ ok: false, error: `Ollama status ${resTags.status}` });
    }
    const data = await resTags.json();
    const models = parseOllamaModelsFromTags(data);
    return res.json({ ok: true, source: 'ollama', models });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reach Ollama';
    return res.status(500).json({ ok: false, error: message });
  }
});

app.post('/api/ollama/pull', async (req, res) => {
  const base = normalizeOllamaBase(req.query?.baseUrl);
  if (!base) {
    return res.status(400).json({ ok: false, error: 'Invalid Ollama base URL' });
  }
  const name = req.body?.name;
  if (!name) {
    return res.status(400).json({ ok: false, error: 'Model name is required' });
  }
  try {
    const response = await fetch(`${base}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: text || `Status ${response.status}` });
    }
    return res.json({ ok: true, status: parseOllamaPullStatus(text) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reach Ollama';
    return res.status(500).json({ ok: false, error: message });
  }
});

if (SHOULD_SERVE_CLIENT && fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

if (SHOULD_SERVE_CLIENT && fs.existsSync(DIST_DIR)) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({ ok: true, service: 'nexus-agent-studio', message: 'API server running.' });
  });
}

app.get('/health', (_req, res) => {
  const ready = !!(browser && browser.isConnected());
  res.json({ ok: true, browserReady: ready });
});

app.listen(PORT, () => {
  ensureBrowser().catch((err) => {
    console.error('Failed to initialize Playwright browser:', err);
  });
  ensureAuthDb().catch((err) => {
    console.error('Failed to initialize SQLite auth DB:', err);
  });
  console.log(`Browser API running on http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  if (authDb) await authDb.close();
  process.exit();
});
