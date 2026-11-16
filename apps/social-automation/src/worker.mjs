#!/usr/bin/env node
import { loadConfig } from './config.mjs';
import { openDatabase } from './database.mjs';
import { expireOldWork, retireInactiveDrafts, retireSupersededDraftWork, scheduleDueWork } from './engine.mjs';
import { processJobs } from './jobs.mjs';
import { flushOutbox } from './outbox.mjs';
import { startBrowserBridge } from './browser-bridge.mjs';
import { processIntakeSpool } from './intake-spool.mjs';
import { auditDailyAutomation } from './operational-audit.mjs';

const config = loadConfig();
const db = openDatabase(config);
retireSupersededDraftWork(db);
retireInactiveDrafts(db);
const browserBridge = await startBrowserBridge(config);
let stopping = false;

async function cycle() {
  await processIntakeSpool(config, new Date(), { db });
  scheduleDueWork(db);
  expireOldWork(db);
  await processJobs(db, config, new Date(), 20, { browserBridge });
  auditDailyAutomation(db, config);
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
  await browserBridge.close();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { stopping = true; });
}

await run();
