import localforage from 'localforage';
import { AgentConfig, Message, AppSettings } from '../types';
import { DEFAULT_AGENTS } from '../constants';

// Type declaration for SQL.js
declare global {
  interface Window {
    initSqlJs: (config: { locateFile: (file: string) => string }) => Promise<any>;
  }
}

let db: any = null;
const DB_NAME = 'nexus_agents_db';

// Initialize SQL.js and load/create DB
export const initDB = async (): Promise<void> => {
  if (db) return;

  try {
    // @ts-ignore - sql-wasm.js loads this globally
    const SQL = await window.initSqlJs({
      locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });

    const savedDbBuffer = await localforage.getItem<ArrayBuffer>(DB_NAME);

    if (savedDbBuffer) {
      db = new SQL.Database(new Uint8Array(savedDbBuffer));
    } else {
      db = new SQL.Database();
      createTables();
      seedDefaults();
    }
    
    // Run migrations to ensure schema is up to date for existing users
    runMigrations();
    
  } catch (err) {
    console.error("Failed to initialize database:", err);
    throw err;
  }
};

const createTables = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      systemInstruction TEXT,
      provider TEXT,
      model TEXT,
      avatarUrl TEXT,
      color TEXT,
      tools TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      agentId TEXT,
      role TEXT,
      content TEXT,
      timestamp INTEGER,
      isError BOOLEAN,
      groundingMetadata TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // New tables for enhanced features
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      agent1Id TEXT,
      agent2Id TEXT,
      topic TEXT,
      maxTurns INTEGER,
      status TEXT,
      createdAt INTEGER,
      updatedAt INTEGER,
      savedAt INTEGER,
      isFavorite BOOLEAN,
      tags TEXT,
      summary TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id TEXT PRIMARY KEY,
      conversationId TEXT,
      agentId TEXT,
      agentName TEXT,
      content TEXT,
      timestamp INTEGER,
      turnNumber INTEGER
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      agent1Id TEXT,
      agent2Id TEXT,
      additionalAgentIds TEXT,
      topic TEXT,
      maxTurns INTEGER,
      createdAt INTEGER
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS metrics (
      id TEXT PRIMARY KEY,
      agentId TEXT,
      conversationId TEXT,
      responseTime INTEGER,
      messageLength INTEGER,
      sentiment TEXT,
      timestamp INTEGER
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS quotas (
      provider TEXT PRIMARY KEY,
      used INTEGER,
      limit_ INTEGER,
      resetTime INTEGER,
      lastUpdated INTEGER
    );
  `);
  saveDB();
};

const runMigrations = () => {
  // Migration: Add tools column to agents
  try {
    db.run("ALTER TABLE agents ADD COLUMN tools TEXT");
  } catch (e) { /* Column likely exists */ }

  // Migration: Add groundingMetadata column to messages
  try {
    db.run("ALTER TABLE messages ADD COLUMN groundingMetadata TEXT");
  } catch (e) { /* Column likely exists */ }
  
  saveDB();
};

const seedDefaults = () => {
  const stmt = db.prepare("INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  DEFAULT_AGENTS.forEach(agent => {
    stmt.run([
      agent.id, 
      agent.name, 
      agent.description, 
      agent.systemInstruction, 
      agent.provider, 
      agent.model, 
      agent.avatarUrl, 
      agent.color,
      JSON.stringify(agent.tools || [])
    ]);
  });
  stmt.free();
  saveDB();
};

const saveDB = async () => {
  if (!db) return;
  const data = db.export();
  await localforage.setItem(DB_NAME, data);
};

// --- Data Access Layers ---

export const getSettings = (): AppSettings => {
  if (!db) return {};
  try {
    const stmt = db.prepare("SELECT key, value FROM settings");
    const settings: any = {};
    while (stmt.step()) {
      const row = stmt.get();
      settings[row[0]] = row[1];
    }
    stmt.free();
    return settings;
  } catch (e) {
    console.error('Error loading settings:', e);
    return {};
  }
};

export const saveSetting = (key: keyof AppSettings, value: string) => {
  if (!db) return;
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
  saveDB();
};

export const getAgents = (): AgentConfig[] => {
  if (!db) return [];
  try {
    const stmt = db.prepare("SELECT * FROM agents");
    const agents: AgentConfig[] = [];
    while(stmt.step()) {
      const row = stmt.getAsObject();
      // Parse tools JSON
      let tools = [];
      try { tools = row.tools ? JSON.parse(row.tools as string) : []; } catch(e) {}
      
      agents.push({
        ...row,
        tools
      } as unknown as AgentConfig);
    }
    stmt.free();
    return agents;
  } catch (e) {
    console.error('Error loading agents:', e);
    return [];
  }
};

export const saveAgent = (agent: AgentConfig) => {
  if (!db) return;
  db.run("INSERT OR REPLACE INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    agent.id, agent.name, agent.description, agent.systemInstruction, 
    agent.provider, agent.model, agent.avatarUrl, agent.color,
    JSON.stringify(agent.tools || [])
  ]);
  saveDB();
};

export const getMessages = (agentId: string): Message[] => {
  if (!db) return [];
  try {
    const stmt = db.prepare("SELECT * FROM messages WHERE agentId = ? ORDER BY timestamp ASC");
    stmt.bind([agentId]);
    const messages: Message[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      
      let groundingMetadata = undefined;
      try {
        if (row.groundingMetadata) groundingMetadata = JSON.parse(row.groundingMetadata as string);
      } catch (e) {}

      messages.push({
        id: row.id as string,
        role: row.role as any,
        content: row.content as string,
        timestamp: row.timestamp as number,
        isError: !!row.isError,
        groundingMetadata
      });
    }
    stmt.free();
    return messages;
  } catch (e) {
    console.error('Error loading messages:', e);
    return [];
  }
};

export const saveMessage = (agentId: string, message: Message) => {
  if (!db) return;
  db.run("INSERT OR REPLACE INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)", [
    message.id, 
    agentId, 
    message.role, 
    message.content, 
    message.timestamp, 
    message.isError ? 1 : 0,
    message.groundingMetadata ? JSON.stringify(message.groundingMetadata) : null
  ]);
  saveDB();
};

export const deleteMessagesForAgent = (agentId: string) => {
  if (!db) return;
  try {
    db.run("DELETE FROM messages WHERE agentId = ?", [agentId]);
    saveDB();
  } catch (e) {
    console.error('Error deleting messages for agent:', e);
  }
};

export const deleteAgent = (agentId: string) => {
  if (!db) return;
  try {
    db.run("DELETE FROM agents WHERE id = ?", [agentId]);
    saveDB();
  } catch (e) {
    console.error('Error deleting agent:', e);
  }
};

// ===== CONVERSATION FUNCTIONS =====
export const saveConversation = (
  id: string,
  agent1Id: string,
  agent2Id: string,
  topic: string,
  maxTurns: number,
  status: string,
  tags: string[] = [],
  summary?: string
) => {
  if (!db) return;
  try {
    db.run(
      `INSERT OR REPLACE INTO conversations 
       (id, agent1Id, agent2Id, topic, maxTurns, status, createdAt, updatedAt, savedAt, isFavorite, tags, summary) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, agent1Id, agent2Id, topic, maxTurns, status, Date.now(), Date.now(), Date.now(), 0, tags.join(','), summary || '']
    );
    saveDB();
  } catch (e) {
    console.error('Error saving conversation:', e);
  }
};

export const getConversations = (limit = 50) => {
  if (!db) return [];
  try {
    const stmt = db.prepare(`SELECT * FROM conversations ORDER BY savedAt DESC LIMIT ?`);
    stmt.bind([limit]);
    const conversations = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      conversations.push({
        ...row,
        tags: row.tags ? row.tags.split(',') : [],
      });
    }
    stmt.free();
    return conversations;
  } catch (e) {
    console.error('Error loading conversations:', e);
    return [];
  }
};

export const searchConversations = (query: string) => {
  if (!db) return [];
  try {
    const lower = `%${query.toLowerCase()}%`;
    const stmt = db.prepare(`SELECT * FROM conversations WHERE LOWER(topic) LIKE ? OR LOWER(tags) LIKE ? ORDER BY savedAt DESC`);
    stmt.bind([lower, lower]);
    const conversations = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      conversations.push({
        ...row,
        tags: row.tags ? row.tags.split(',') : [],
      });
    }
    stmt.free();
    return conversations;
  } catch (e) {
    console.error('Error searching conversations:', e);
    return [];
  }
};

export const toggleFavorite = (conversationId: string) => {
  if (!db) return;
  try {
    db.run(`UPDATE conversations SET isFavorite = CASE WHEN isFavorite = 0 THEN 1 ELSE 0 END WHERE id = ?`, [conversationId]);
    saveDB();
  } catch (e) {
    console.error('Error toggling favorite:', e);
  }
};

export const deleteConversation = (conversationId: string) => {
  if (!db) return;
  try {
    db.run("DELETE FROM conversations WHERE id = ?", [conversationId]);
    db.run("DELETE FROM conversation_messages WHERE conversationId = ?", [conversationId]);
    saveDB();
  } catch (e) {
    console.error('Error deleting conversation:', e);
  }
};

// ===== CONVERSATION MESSAGE FUNCTIONS =====
export const saveConversationMessage = (message: any) => {
  if (!db) return;
  try {
    db.run(
      `INSERT OR REPLACE INTO conversation_messages 
       (id, conversationId, agentId, agentName, content, timestamp, turnNumber) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [message.id, message.conversationId, message.agentId, message.agentName, message.content, message.timestamp, message.turnNumber]
    );
    saveDB();
  } catch (e) {
    console.error('Error saving conversation message:', e);
  }
};

export const getConversationMessages = (conversationId: string) => {
  if (!db) return [];
  try {
    const stmt = db.prepare(`SELECT * FROM conversation_messages WHERE conversationId = ? ORDER BY turnNumber ASC`);
    stmt.bind([conversationId]);
    const messages = [];
    while (stmt.step()) {
      messages.push(stmt.getAsObject());
    }
    stmt.free();
    return messages;
  } catch (e) {
    console.error('Error loading conversation messages:', e);
    return [];
  }
};

// ===== TEMPLATE FUNCTIONS =====
export const saveTemplate = (
  id: string,
  name: string,
  description: string,
  agent1Id: string,
  agent2Id: string,
  additionalAgentIds: string[],
  topic: string,
  maxTurns: number
) => {
  if (!db) return;
  try {
    db.run(
      `INSERT OR REPLACE INTO templates 
       (id, name, description, agent1Id, agent2Id, additionalAgentIds, topic, maxTurns, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, description, agent1Id, agent2Id, additionalAgentIds.join(','), topic, maxTurns, Date.now()]
    );
    saveDB();
  } catch (e) {
    console.error('Error saving template:', e);
  }
};

export const getTemplates = () => {
  if (!db) return [];
  try {
    const stmt = db.prepare(`SELECT * FROM templates ORDER BY createdAt DESC`);
    const templates = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      templates.push({
        ...row,
        additionalAgentIds: row.additionalAgentIds ? row.additionalAgentIds.split(',') : [],
      });
    }
    stmt.free();
    return templates;
  } catch (e) {
    console.error('Error loading templates:', e);
    return [];
  }
};

export const deleteTemplate = (templateId: string) => {
  if (!db) return;
  try {
    db.run("DELETE FROM templates WHERE id = ?", [templateId]);
    saveDB();
  } catch (e) {
    console.error('Error deleting template:', e);
  }
};

// ===== METRICS FUNCTIONS =====
export const recordMetric = (
  agentId: string,
  conversationId: string,
  responseTime: number,
  messageLength: number,
  sentiment: string
) => {
  if (!db) return;
  try {
    const id = `${Date.now()}-${Math.random()}`;
    db.run(
      `INSERT INTO metrics (id, agentId, conversationId, responseTime, messageLength, sentiment, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, agentId, conversationId, responseTime, messageLength, sentiment, Date.now()]
    );
    saveDB();
  } catch (e) {
    console.error('Error recording metric:', e);
  }
};

export const getAgentMetrics = (agentId: string, days = 7) => {
  if (!db) return [];
  try {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const stmt = db.prepare(`SELECT * FROM metrics WHERE agentId = ? AND timestamp > ? ORDER BY timestamp DESC`);
    stmt.bind([agentId, since]);
    const metrics = [];
    while (stmt.step()) {
      metrics.push(stmt.getAsObject());
    }
    stmt.free();
    return metrics;
  } catch (e) {
    console.error('Error loading agent metrics:', e);
    return [];
  }
};

export const getConversationMetrics = (conversationId: string) => {
  if (!db) return [];
  try {
    const stmt = db.prepare(`SELECT * FROM metrics WHERE conversationId = ? ORDER BY timestamp DESC`);
    stmt.bind([conversationId]);
    const metrics = [];
    while (stmt.step()) {
      metrics.push(stmt.getAsObject());
    }
    stmt.free();
    return metrics;
  } catch (e) {
    console.error('Error loading conversation metrics:', e);
    return [];
  }
};

// ===== QUOTA FUNCTIONS =====
export const updateQuota = (provider: string, used: number, limit: number) => {
  if (!db) return;
  try {
    db.run(
      `INSERT OR REPLACE INTO quotas (provider, used, limit_, resetTime, lastUpdated) VALUES (?, ?, ?, ?, ?)`,
      [provider, used, limit, Date.now() + 24 * 60 * 60 * 1000, Date.now()]
    );
    saveDB();
  } catch (e) {
    console.error('Error updating quota:', e);
  }
};

export const getQuota = (provider: string) => {
  if (!db) return null;
  try {
    const stmt = db.prepare(`SELECT * FROM quotas WHERE provider = ?`);
    stmt.bind([provider]);
    let quota = null;
    if (stmt.step()) {
      quota = stmt.getAsObject();
    }
    stmt.free();
    return quota;
  } catch (e) {
    console.error('Error loading quota:', e);
    return null;
  }
};

export const getAllQuotas = () => {
  if (!db) return [];
  try {
    const stmt = db.prepare(`SELECT * FROM quotas`);
    const quotas = [];
    while (stmt.step()) {
      quotas.push(stmt.getAsObject());
    }
    stmt.free();
    return quotas;
  } catch (e) {
    console.error('Error loading quotas:', e);
    return [];
  }
};
