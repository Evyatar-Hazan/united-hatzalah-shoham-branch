#!/usr/bin/env node
import { loadConfig } from './config.mjs';
import { openDatabase } from './database.mjs';
import { expireOldWork, scheduleDueWork } from './engine.mjs';
import { processJobs } from './jobs.mjs';
import { flushOutbox } from './outbox.mjs';

const config = loadConfig();
const db = openDatabase(config);
let stopping = false;

async function cycle() {
  scheduleDueWork(db);
  expireOldWork(db);
  await processJobs(db, config);
  await flushOutbox(db, config);
}

async function run() {
  while (!stopping) {
    try {
      await cycle();
    } catch (error) {
      console.error(JSON.stringify({ at: new Date().toISOString(), error: String(error.message || error) }));
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
  db.close();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { stopping = true; });
}

await run();
