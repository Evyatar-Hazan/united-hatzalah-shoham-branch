import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openDatabase } from '../src/database.mjs';
import { ingestEvent, scheduleDueWork } from '../src/engine.mjs';
import { processJobs } from '../src/jobs.mjs';
import { flushOutbox } from '../src/outbox.mjs';

function fixture() {
  const dataDir = mkdtempSync(join(tmpdir(), 'shoham-social-'));
  const config = { dataDir, dbPath: join(dataDir, 'db.sqlite'), mediaDir: join(dataDir, 'media'), groupId: 'group@g.us', ownerId: 'owner', dryRun: true, signature: 'signature', bridgeUrl: 'http://127.0.0.1:0', metaPublishCommand: '' };
  const db = openDatabase(config);
  return { db, config, close() { db.close(); rmSync(dataDir, { recursive: true, force: true }); } };
}

test('duplicate inbound messages are idempotent', () => {
  const f = fixture();
  try {
    const event = { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'פעילות קהילתית', media: [] };
    assert.equal(ingestEvent(f.db, f.config, event).type, 'draft_created');
    assert.equal(ingestEvent(f.db, f.config, event).type, 'duplicate');
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM posts').get().count, 1);
  } finally { f.close(); }
});

test('approval must reply to the active draft and queues both channels', () => {
  const f = fixture();
  try {
    ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'תרגול מתנדבים', media: [] });
    const outbox = f.db.prepare("SELECT * FROM outbox WHERE entity_type='draft'").get();
    f.db.prepare('UPDATE outbox SET platform_message_id=? WHERE id=?').run('draft-message', outbox.id);
    const result = ingestEvent(f.db, f.config, { id: 'm2', chatId: 'group@g.us', senderId: 'u2', text: 'מאשר', replyToId: 'draft-message' });
    assert.equal(result.type, 'approved');
    assert.deepEqual(result.channels, ['facebook', 'instagram']);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE kind='publish'").get().count, 2);
  } finally { f.close(); }
});

test('approval without a direct reply asks for clarification', () => {
  const f = fixture();
  try {
    const result = ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'מאשר' });
    assert.equal(result.type, 'clarification_required');
  } finally { f.close(); }
});

test('latest draft query resends the active draft with its media and does not create a post', () => {
  const f = fixture();
  try {
    ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'פעילות מתנדבים', media: [{ key: 'photo', path: '/photo.jpg' }] });
    const draft = f.db.prepare("SELECT * FROM drafts WHERE status='pending'").get();
    f.db.prepare('UPDATE drafts SET facebook_text=replace(facebook_text, ?, ?), instagram_text=replace(instagram_text, ?, ?) WHERE id=?')
      .run('💚', '🧡', '💚', '🧡', draft.id);
    const result = ingestEvent(f.db, f.config, { id: 'm2', chatId: 'group@g.us', senderId: 'u2', text: 'מהי הסקיצה האחרונה שיש לנו?' });
    assert.equal(result.type, 'latest_draft');
    assert.equal(result.draftId, draft.id);
    const response = f.db.prepare("SELECT * FROM outbox WHERE dedupe_key='latest:m2'").get();
    assert.equal(response.media_path, '/photo.jpg');
    assert.match(response.body, /🧡/);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM posts').get().count, 1);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM drafts').get().count, 1);
  } finally { f.close(); }
});

test('a targeted revision applies to the only active draft without a direct reply', () => {
  const f = fixture();
  try {
    ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'פעילות מתנדבים', media: [{ key: 'old', path: '/old.jpg' }] });
    const first = f.db.prepare("SELECT * FROM drafts WHERE status='pending'").get();
    const result = ingestEvent(f.db, f.config, { id: 'm2', chatId: 'group@g.us', senderId: 'u2', text: 'תקן את האימוג׳י ללב כתום' });
    assert.equal(result.type, 'draft_revised');
    const revised = f.db.prepare("SELECT * FROM drafts WHERE status='pending'").get();
    assert.equal(revised.version, 2);
    assert.match(revised.facebook_text, /🧡/);
    assert.doesNotMatch(revised.facebook_text, /💚/);
    assert.equal(revised.media_json, first.media_json);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM posts').get().count, 1);
  } finally { f.close(); }
});

test('image replacement chooses a different approved asset and keeps the existing copy', () => {
  const f = fixture();
  try {
    ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'פעילות מתנדבים', media: [{ key: 'old', path: '/old.jpg' }] });
    const first = f.db.prepare("SELECT * FROM drafts WHERE status='pending'").get();
    f.db.prepare('INSERT INTO media_usage(media_key,source,metadata_json) VALUES(?,?,?)')
      .run('new', 'approved', JSON.stringify({ path: '/new.jpg', album: 'approved' }));
    const result = ingestEvent(f.db, f.config, { id: 'm2', chatId: 'group@g.us', senderId: 'u2', text: 'תחליף תמונה למשהו יותר מתאים' });
    assert.equal(result.type, 'draft_revised');
    const revised = f.db.prepare("SELECT * FROM drafts WHERE status='pending'").get();
    assert.equal(JSON.parse(revised.media_json)[0].key, 'new');
    assert.equal(revised.facebook_text, first.facebook_text);
  } finally { f.close(); }
});

test('resend instruction reuses the current draft and attaches its media', () => {
  const f = fixture();
  try {
    ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'פעילות מתנדבים', media: [{ key: 'photo', path: '/photo.jpg' }] });
    const result = ingestEvent(f.db, f.config, { id: 'm2', chatId: 'group@g.us', senderId: 'u2', text: 'שלח אותה פה' });
    assert.equal(result.type, 'draft_resent');
    const resend = f.db.prepare("SELECT * FROM outbox WHERE dedupe_key='resend:m2'").get();
    assert.equal(resend.media_path, '/photo.jpg');
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM drafts').get().count, 1);
  } finally { f.close(); }
});

test('revision with multiple active drafts asks which draft to change', () => {
  const f = fixture();
  try {
    ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'פוסט ראשון' });
    ingestEvent(f.db, f.config, { id: 'm2', chatId: 'group@g.us', senderId: 'u1', text: 'פוסט שני' });
    const result = ingestEvent(f.db, f.config, { id: 'm3', chatId: 'group@g.us', senderId: 'u2', text: 'תחליף תמונה' });
    assert.equal(result.type, 'clarification_required');
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM posts').get().count, 2);
  } finally { f.close(); }
});

test('revision without an active draft asks for context instead of creating a post', () => {
  const f = fixture();
  try {
    const result = ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u2', text: 'תחליף תמונה' });
    assert.equal(result.type, 'clarification_required');
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM posts').get().count, 0);
  } finally { f.close(); }
});

test('only owner can stop the system', () => {
  const f = fixture();
  try {
    assert.equal(ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'עצור מערכת' }).type, 'owner_only');
    assert.equal(ingestEvent(f.db, f.config, { id: 'm2', chatId: 'group@g.us', senderId: 'owner', text: 'עצור מערכת' }).type, 'stopped');
  } finally { f.close(); }
});

test('missed morning times create only one current proposal job', () => {
  const f = fixture();
  try {
    const now = new Date('2026-11-08T08:00:00.000Z');
    scheduleDueWork(f.db, now);
    scheduleDueWork(f.db, new Date(now.getTime() + 3 * 60 * 60 * 1000));
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE kind='morning_proposal'").get().count, 1);
  } finally { f.close(); }
});

test('dry-run publication never invokes an external publisher', async () => {
  const f = fixture();
  try {
    ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'תרגול', media: [] });
    const outbox = f.db.prepare("SELECT * FROM outbox WHERE entity_type='draft'").get();
    f.db.prepare('UPDATE outbox SET platform_message_id=? WHERE id=?').run('draft-message', outbox.id);
    ingestEvent(f.db, f.config, { id: 'm2', chatId: 'group@g.us', senderId: 'u2', text: 'מאשר לפייסבוק', replyToId: 'draft-message' });
    const results = await processJobs(f.db, f.config);
    assert.equal(results[0].status, 'done');
    assert.equal(f.db.prepare('SELECT status FROM publications').get().status, 'dry_run');
  } finally { f.close(); }
});

test('media sync splits approved albums into bounded browser batches', async () => {
  const f = fixture();
  try {
    const now = new Date('2026-11-08T08:00:00.000Z');
    f.db.prepare(`INSERT INTO jobs
      (job_key,kind,payload_json,status,run_after,created_at,updated_at)
      VALUES('media-sync-test','media_sync','{}','pending',?,?,?)`)
      .run(now.toISOString(), now.toISOString(), now.toISOString());
    const calls = [];
    const browserBridge = {
      async request(type, payload) {
        calls.push({ type, payload });
        return { imported: [] };
      },
    };
    const results = await processJobs(f.db, f.config, now, 20, { browserBridge });
    assert.equal(results[0].error, 'no_approved_media_imported');
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map(({ payload }) => payload.approvedAlbums.length), [4, 4]);
    assert.ok(calls.every(({ type }) => type === 'syncGooglePhotos'));
  } finally { f.close(); }
});

test('WhatsApp dry-run consumes queued messages without leaving them sendable', async () => {
  const f = fixture();
  try {
    ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'תרגול', media: [] });
    const results = await flushOutbox(f.db, f.config);
    assert.equal(results[0].status, 'dry_run');
    assert.equal(f.db.prepare('SELECT status FROM outbox').get().status, 'dry_run');
  } finally { f.close(); }
});
