import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inbound_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL UNIQUE,
  chat_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  text TEXT NOT NULL DEFAULT '',
  reply_to_id TEXT,
  media_json TEXT NOT NULL DEFAULT '[]',
  received_at TEXT NOT NULL,
  processed_at TEXT,
  result_json TEXT
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  source_message_id TEXT,
  source_kind TEXT NOT NULL,
  brief TEXT NOT NULL DEFAULT '',
  media_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT,
  FOREIGN KEY(source_message_id) REFERENCES inbound_messages(source_id)
);
CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  version INTEGER NOT NULL,
  facebook_text TEXT NOT NULL,
  instagram_text TEXT NOT NULL,
  media_json TEXT NOT NULL DEFAULT '[]',
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(post_id, version),
  UNIQUE(post_id, fingerprint)
);
CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id INTEGER NOT NULL REFERENCES drafts(id),
  source_message_id TEXT NOT NULL UNIQUE,
  approver_id TEXT NOT NULL,
  channels TEXT NOT NULL,
  approved_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS publications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id INTEGER NOT NULL REFERENCES drafts(id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  external_id TEXT,
  url TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(draft_id, channel)
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  run_after TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dedupe_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  media_path TEXT,
  reply_to_id TEXT,
  entity_type TEXT,
  entity_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
  ,platform_message_id TEXT
);
CREATE TABLE IF NOT EXISTS media_usage (
  media_key TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  last_used_at TEXT,
  post_id INTEGER REFERENCES posts(id),
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_jobs_ready ON jobs(status, run_after);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(status, id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, updated_at);
`;

export function openDatabase(config) {
  mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  mkdirSync(config.mediaDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(config.dbPath);
  db.exec(SCHEMA);
  return db;
}

export function nowIso(now = new Date()) {
  return now.toISOString();
}

export function setSetting(db, key, value, now = new Date()) {
  db.prepare(`INSERT INTO settings(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    .run(key, JSON.stringify(value), nowIso(now));
}

export function getSetting(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}
