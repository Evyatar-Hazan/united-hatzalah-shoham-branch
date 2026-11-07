import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { processIntakeSpool } from '../src/intake-spool.mjs';

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
