import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { processIntakeSpool } from '../src/intake-spool.mjs';
import { openDatabase } from '../src/database.mjs';

test('durable intake spool survives failure and resumes once', async () => {
  const intakeSpoolDir = mkdtempSync(join(tmpdir(), 'shoham-intake-'));
  const config = { intakeSpoolDir };
  try {
    writeFileSync(join(intakeSpoolDir, 'event.json'), JSON.stringify({ extra: { turn_id: 'm1' } }));
    const failed = await processIntakeSpool(config, new Date('2026-11-07T20:00:00Z'), {
      runHook: async () => { throw new Error('restart'); },
    });
    assert.equal(failed[0].status, 'retry');
    assert.deepEqual(readdirSync(intakeSpoolDir), ['event.json']);

    const seen = [];
    const resumed = await processIntakeSpool(config, new Date('2026-11-07T20:01:00Z'), {
      runHook: async (payload) => seen.push(payload.extra.turn_id),
    });
    assert.equal(resumed[0].status, 'processed');
    assert.deepEqual(seen, ['m1']);
    assert.deepEqual(readdirSync(intakeSpoolDir), []);
  } finally {
    rmSync(intakeSpoolDir, { recursive: true, force: true });
  }
});

test('durable intake receipt is reconciled only after the inbound message is stored', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'shoham-intake-db-'));
  const intakeSpoolDir = join(dataDir, 'spool');
  const config = { dataDir, intakeSpoolDir, dbPath: join(dataDir, 'db.sqlite'), mediaDir: join(dataDir, 'media'), groupId: 'group@g.us', ownerId: '10000@lid', approvers: [] };
  const db = openDatabase(config);
  try {
    const payload = { extra: { turn_id: 'receipt-1', chat_id: 'group@g.us', sender_id: 'member', user_message: 'שיחה רגילה' } };
    mkdirSync(intakeSpoolDir, { recursive: true });
    writeFileSync(join(intakeSpoolDir, 'event.json'), JSON.stringify(payload));
    const results = await processIntakeSpool(config, new Date('2026-11-16T08:00:00Z'), {
      db,
      runHook: async () => {
        db.prepare(`INSERT INTO inbound_messages(source_id,chat_id,sender_id,text,media_json,received_at,processing_status)
          VALUES('receipt-1','group@g.us','member','שיחה רגילה','[]',?,'processed')`).run('2026-11-16T08:00:00Z');
      },
    });
    assert.equal(results[0].status, 'processed');
    assert.equal(db.prepare("SELECT reconciliation_status FROM intake_receipts WHERE source_id='receipt-1'").get().reconciliation_status, 'matched');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM intake_integrity_alerts').get().count, 0);
  } finally {
    db.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('durable intake spool recovers an event claimed before a worker restart', async () => {
  const intakeSpoolDir = mkdtempSync(join(tmpdir(), 'shoham-intake-'));
  const config = { intakeSpoolDir };
  try {
    writeFileSync(join(intakeSpoolDir, 'event.json.processing-123'), JSON.stringify({ extra: { turn_id: 'm2' } }));
    const seen = [];
    const results = await processIntakeSpool(config, new Date(), {
      runHook: async (payload) => seen.push(payload.extra.turn_id),
    });
    assert.equal(results[0].status, 'processed');
    assert.deepEqual(seen, ['m2']);
    assert.deepEqual(readdirSync(intakeSpoolDir), []);
  } finally {
    rmSync(intakeSpoolDir, { recursive: true, force: true });
  }
});
