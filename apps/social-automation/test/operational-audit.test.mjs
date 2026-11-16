import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openDatabase } from '../src/database.mjs';
import { auditDailyAutomation } from '../src/operational-audit.mjs';

function fixture() {
  const dataDir = mkdtempSync(join(tmpdir(), 'shoham-audit-'));
  const config = { dataDir, dbPath: join(dataDir, 'db.sqlite'), mediaDir: join(dataDir, 'media'), ownerId: '10000@lid', approvers: [] };
  const db = openDatabase(config);
  return { db, config, close() { db.close(); rmSync(dataDir, { recursive: true, force: true }); } };
}

test('daily audit accepts one completed morning proposal and correct reminder cadence', () => {
  const f = fixture();
  try {
    const created = new Date('2026-11-16T06:30:00Z');
    const auditAt = new Date('2026-11-16T06:45:00Z');
    f.db.prepare(`INSERT INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
      VALUES('morning:2026-11-16','morning_proposal','{}','done',?,?,?)`).run(created.toISOString(), created.toISOString(), created.toISOString());
    f.db.prepare(`INSERT INTO posts(public_id,status,source_kind,brief,media_json,created_at,updated_at,expires_at)
      VALUES('M20261116','awaiting_approval','morning','','[]',?,?,?)`)
      .run(created.toISOString(), created.toISOString(), new Date(created.getTime() + 86_400_000).toISOString());
    const post = f.db.prepare("SELECT id FROM posts WHERE public_id='M20261116'").get();
    f.db.prepare(`INSERT INTO drafts(post_id,version,facebook_text,instagram_text,media_json,fingerprint,status,created_at)
      VALUES(?,1,'a','b','[]','hash','pending',?)`).run(post.id, created.toISOString());
    const draft = f.db.prepare('SELECT id FROM drafts WHERE post_id=?').get(post.id);
    f.db.prepare(`INSERT INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
      VALUES(?, 'approval_group_reminder',?,'pending',?,?,?)`)
      .run(`approval-reminder:${draft.id}:group`, JSON.stringify({ draftId: draft.id }), new Date(created.getTime() + 30 * 60_000).toISOString(), created.toISOString(), created.toISOString());
    f.db.prepare(`INSERT INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
      VALUES(?, 'approval_private_reminder',?,'pending',?,?,?)`)
      .run(`approval-reminder:${draft.id}:private:1`, JSON.stringify({ draftId: draft.id, round: 1 }), new Date(created.getTime() + 2 * 60 * 60_000).toISOString(), created.toISOString(), created.toISOString());
    assert.deepEqual(auditDailyAutomation(f.db, f.config, auditAt), { status: 'ok', date: '2026-11-16', proposalCount: 1, activeDailyPosts: 1 });
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM intake_integrity_alerts WHERE status='open'").get().count, 0);
  } finally { f.close(); }
});

test('daily audit alerts the owner when the morning run is missing', () => {
  const f = fixture();
  try {
    const result = auditDailyAutomation(f.db, f.config, new Date('2026-11-16T06:45:00Z'));
    assert.equal(result.status, 'alert');
    assert.equal(f.db.prepare("SELECT kind FROM intake_integrity_alerts WHERE status='open'").get().kind, 'morning_run_invariant');
    assert.equal(f.db.prepare("SELECT target_chat_id FROM outbox WHERE status='pending'").get().target_chat_id, f.config.ownerId);
  } finally { f.close(); }
});
