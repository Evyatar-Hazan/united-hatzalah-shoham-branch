#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { openDatabase, setSetting } from './database.mjs';
import { loadConfig } from './config.mjs';
import { expireOldWork, ingestEvent, scheduleDueWork } from './engine.mjs';
import { processJobs } from './jobs.mjs';
import { flushOutbox } from './outbox.mjs';

const config = loadConfig();
const db = openDatabase(config);
const [command = 'status', ...args] = process.argv.slice(2);

function option(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

async function readJsonInput() {
  const path = option('--file');
  if (path) return JSON.parse(await readFile(path, 'utf8'));
  let body = '';
  for await (const chunk of process.stdin) body += chunk;
  if (!body.trim()) throw new Error('JSON input required via --file or stdin');
  return JSON.parse(body);
}

function status() {
  return {
    dryRun: config.dryRun,
    groupConfigured: Boolean(config.groupId),
    ownerConfigured: Boolean(config.ownerId),
    posts: db.prepare('SELECT status, COUNT(*) AS count FROM posts GROUP BY status').all(),
    jobs: db.prepare('SELECT status, COUNT(*) AS count FROM jobs GROUP BY status').all(),
    outbox: db.prepare('SELECT status, COUNT(*) AS count FROM outbox GROUP BY status').all(),
    lastInboundId: db.prepare('SELECT MAX(id) AS id FROM inbound_messages').get().id || 0,
  };
}

async function main() {
  if (command === 'init') {
    setSetting(db, 'system_enabled', true);
    return { initialized: true, dbPath: config.dbPath, ...status() };
  }
  if (command === 'ingest') return ingestEvent(db, config, await readJsonInput());
  if (command === 'tick') {
    scheduleDueWork(db);
    expireOldWork(db);
    return { jobs: await processJobs(db, config), outbox: await flushOutbox(db, config) };
  }
  if (command === 'process-jobs') return processJobs(db, config);
  if (command === 'flush') return flushOutbox(db, config);
  if (command === 'add-media') {
    const item = await readJsonInput();
    if (!item.key || !item.source) throw new Error('media requires key and source');
    db.prepare(`INSERT INTO media_usage(media_key,source,metadata_json)
      VALUES(?,?,?) ON CONFLICT(media_key) DO UPDATE SET source=excluded.source, metadata_json=excluded.metadata_json`)
      .run(item.key, item.source, JSON.stringify(item));
    return { added: item.key };
  }
  if (command === 'status') return status();
  if (command === 'reset-dry-run') {
    db.exec("DELETE FROM approvals; DELETE FROM publications; DELETE FROM drafts; DELETE FROM posts; DELETE FROM inbound_messages; DELETE FROM jobs; DELETE FROM outbox;");
    return { reset: true };
  }
  throw new Error(`unknown command: ${command}`);
}

try {
  console.log(JSON.stringify(await main(), null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: String(error.message || error) }));
  process.exitCode = 1;
} finally {
  db.close();
}
