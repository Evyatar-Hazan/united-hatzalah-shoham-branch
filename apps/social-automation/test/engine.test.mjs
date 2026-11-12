import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openDatabase } from '../src/database.mjs';
import { ingestEvent, resolveApprovalClarification, scheduleDueWork } from '../src/engine.mjs';
import { processJobs } from '../src/jobs.mjs';
import { flushOutbox } from '../src/outbox.mjs';

const APPROVERS = [
  { key: 'erez', name: 'ארז', senderId: '10001@lid' },
  { key: 'shlomi', name: 'שלומי', senderId: '10002@lid' },
  { key: 'dori', name: 'דורי', senderId: '10003@lid' },
  { key: 'shenhav', name: 'שנהב', senderId: '10004@lid' },
];

function fixture() {
  const dataDir = mkdtempSync(join(tmpdir(), 'shoham-social-'));
  const config = { dataDir, dbPath: join(dataDir, 'db.sqlite'), mediaDir: join(dataDir, 'media'), groupId: 'group@g.us', ownerId: 'owner', approvers: APPROVERS, dryRun: true, signature: 'signature', bridgeUrl: 'http://127.0.0.1:0', metaPublishCommand: '' };
  const db = openDatabase(config);
  return { db, config, close() { db.close(); rmSync(dataDir, { recursive: true, force: true }); } };
}

function approve(f, replyToId, prefix = 'approval', now = new Date()) {
  return APPROVERS.slice(0, 1).map((person, index) => ingestEvent(f.db, f.config, {
    id: `${prefix}-${person.key}`,
    chatId: 'group@g.us',
    senderId: person.senderId,
    senderName: person.name,
    text: 'מאשר',
    replyToId,
  }, new Date(now.getTime() + index * 1000)));
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

test('one approval from the approved roster queues both channels', () => {
  const f = fixture();
  try {
    ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'תרגול מתנדבים', media: [] });
    const outbox = f.db.prepare("SELECT * FROM outbox WHERE entity_type='draft'").get();
    f.db.prepare('UPDATE outbox SET platform_message_id=? WHERE id=?').run('draft-message', outbox.id);
    const last = APPROVERS[2];
    const result = ingestEvent(f.db, f.config, {
      id: `approval-${last.key}`, chatId: 'group@g.us', senderId: last.senderId,
      senderName: last.name, text: 'מאשר', replyToId: 'draft-message',
    });
    assert.equal(result.type, 'approved');
    assert.deepEqual(result.channels, ['facebook', 'instagram']);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE kind='publish'").get().count, 2);
  } finally { f.close(); }
});

test('the owner is not an approver and cannot advance the approval gate', () => {
  const f = fixture();
  try {
    ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'תרגול מתנדבים', media: [] });
    const outbox = f.db.prepare("SELECT * FROM outbox WHERE entity_type='draft'").get();
    f.db.prepare('UPDATE outbox SET platform_message_id=? WHERE id=?').run('draft-message', outbox.id);
    const result = ingestEvent(f.db, f.config, { id: 'owner-approval', chatId: 'group@g.us', senderId: 'owner', senderName: 'אביתר', text: 'מאשר', replyToId: 'draft-message' });
    assert.equal(result.type, 'approval_not_counted');
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM approvals').get().count, 0);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE kind='publish'").get().count, 0);
  } finally { f.close(); }
});

test('approval without a direct reply asks for clarification', () => {
  const f = fixture();
  try {
    const result = ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'מאשר' });
    assert.equal(result.type, 'clarification_required');
  } finally { f.close(); }
});

test('verified private approval stays private and updates group approval status', () => {
  const f = fixture();
  try {
    const now = new Date('2026-11-12T08:00:00.000Z');
    ingestEvent(f.db, f.config, { id: 'draft-private', chatId: 'group@g.us', senderId: 'member', text: 'פעילות קהילתית' }, now);
    const draft = f.db.prepare("SELECT d.*,p.public_id FROM drafts d JOIN posts p ON p.id=d.post_id WHERE d.status='pending'").get();
    f.db.prepare(`INSERT INTO outbox
      (dedupe_key,kind,body,entity_type,entity_id,target_chat_id,status,created_at,sent_at,platform_message_id)
      VALUES(?,'text','תזכורת פרטית','draft',?,?, 'sent',?,?,?)`)
      .run(`private-reminder:${draft.id}:erez`, draft.id, APPROVERS[0].senderId, now.toISOString(), now.toISOString(), 'private-reminder-message');
    const result = ingestEvent(f.db, f.config, {
      id: 'private-approval', chatId: APPROVERS[0].senderId, isPrivate: true,
      senderId: APPROVERS[0].senderId, senderName: APPROVERS[0].name, text: 'מאשר',
      semantic: { intent: 'approve_draft', channels: ['facebook', 'instagram'] },
    }, new Date(now.getTime() + 1000));
    assert.equal(result.type, 'approved');
    assert.equal(f.db.prepare('SELECT approver_key FROM approvals WHERE draft_id=?').get(draft.id).approver_key, 'erez');
    const privateAck = f.db.prepare("SELECT * FROM outbox WHERE dedupe_key='approval-private-ack:private-approval'").get();
    const groupStatus = f.db.prepare("SELECT * FROM outbox WHERE dedupe_key='approved:private-approval'").get();
    assert.equal(privateAck.target_chat_id, APPROVERS[0].senderId);
    assert.equal(groupStatus.target_chat_id, null);
    assert.doesNotMatch(groupStatus.body, /תזכורת פרטית/);
  } finally { f.close(); }
});

test('unknown private sender is ignored before the message is stored', () => {
  const f = fixture();
  try {
    const result = ingestEvent(f.db, f.config, {
      id: 'unknown-private', chatId: '99999@lid', isPrivate: true,
      senderId: '99999@lid', text: 'מאשר', semantic: { intent: 'approve_draft' },
    });
    assert.equal(result.type, 'ignored_private_sender');
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM inbound_messages WHERE source_id='unknown-private'").get().count, 0);
  } finally { f.close(); }
});

test('private conversation never becomes public post content', () => {
  const f = fixture();
  try {
    const person = APPROVERS[0];
    const result = ingestEvent(f.db, f.config, {
      id: 'private-chat', chatId: person.senderId, isPrivate: true,
      senderId: person.senderId, senderName: person.name, text: 'מה קורה?',
      semantic: { intent: 'clarification', question: 'אפשר לחדד למה התכוונת?' },
    });
    assert.equal(result.type, 'clarification_required');
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM posts').get().count, 0);
    assert.equal(f.db.prepare("SELECT target_chat_id FROM outbox WHERE dedupe_key='semantic-clarify:private-chat'").get().target_chat_id, person.senderId);
  } finally { f.close(); }
});

test('a short yes confirms the exact draft named in the latest bot clarification', () => {
  const f = fixture();
  try {
    const now = new Date('2026-11-08T07:36:00.000Z');
    ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'תרגול מתנדבים', media: [] }, now);
    const draft = f.db.prepare("SELECT d.*,p.public_id FROM drafts d JOIN posts p ON p.id=d.post_id WHERE d.status='pending'").get();
    f.db.prepare(`INSERT INTO outbox
      (dedupe_key,kind,body,status,created_at,sent_at) VALUES(?,'text',?,'sent',?,?)`)
      .run('semantic-clarify:m2', `לפרסם את טיוטה ${draft.public_id} בגרסה ${draft.version} בפייסבוק ובאינסטגרם?`, now.toISOString(), now.toISOString());
    const resolved = resolveApprovalClarification(f.db, 'כן', new Date(now.getTime() + 30_000));
    assert.deepEqual(resolved, {
      draftId: draft.id,
      channels: ['facebook', 'instagram'],
      replyToText: `סקיצה ${draft.public_id} · גרסה ${draft.version}`,
    });
    const result = ingestEvent(f.db, f.config, {
      id: 'm3', chatId: 'group@g.us', senderId: 'erez-id', senderName: 'ארז', text: 'כן',
      replyToText: resolved.replyToText,
      semantic: { intent: 'approve_draft', confidence: 1, channels: resolved.channels },
    }, new Date(now.getTime() + 30_000));
    assert.equal(result.type, 'approved');
  } finally { f.close(); }
});

test('a short yes does not approve an expired clarification context', () => {
  const f = fixture();
  try {
    const now = new Date('2026-11-08T07:00:00.000Z');
    ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'תרגול מתנדבים', media: [] }, now);
    const draft = f.db.prepare("SELECT d.*,p.public_id FROM drafts d JOIN posts p ON p.id=d.post_id WHERE d.status='pending'").get();
    f.db.prepare(`INSERT INTO outbox
      (dedupe_key,kind,body,status,created_at,sent_at) VALUES(?,'text',?,'sent',?,?)`)
      .run('semantic-clarify:m2', `לפרסם את טיוטה ${draft.public_id} בגרסה ${draft.version} בפייסבוק ובאינסטגרם?`, now.toISOString(), now.toISOString());
    assert.equal(resolveApprovalClarification(f.db, 'כן', new Date(now.getTime() + 16 * 60_000)), null);
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

test('semantic group conversation never becomes draft copy even when replying to a draft', () => {
  const f = fixture();
  try {
    ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'פעילות מתנדבים', media: [{ key: 'photo', path: '/photo.jpg' }], semantic: { intent: 'create_post', confidence: 0.99 } });
    const draftOutbox = f.db.prepare("SELECT * FROM outbox WHERE entity_type='draft'").get();
    f.db.prepare('UPDATE outbox SET platform_message_id=? WHERE id=?').run('draft-message', draftOutbox.id);
    const result = ingestEvent(f.db, f.config, {
      id: 'm2', chatId: 'group@g.us', senderId: 'u2', text: '@all יש למישהו הערות או שאפשר לפרסם?',
      replyToId: 'draft-message', semantic: { intent: 'group_conversation', confidence: 0.99 },
    });
    assert.equal(result.type, 'ignored_conversation');
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM posts').get().count, 1);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM drafts').get().count, 1);
    assert.doesNotMatch(f.db.prepare('SELECT facebook_text FROM drafts').get().facebook_text, /@all/);
  } finally { f.close(); }
});

test('semantic create-post decision creates a draft without keyword rules', () => {
  const f = fixture();
  try {
    const result = ingestEvent(f.db, f.config, {
      id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'היום התקיים תרגול מתנדבים',
      semantic: { intent: 'create_post', confidence: 0.97 },
    });
    assert.equal(result.type, 'draft_created');
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM posts').get().count, 1);
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

test('a revised version retires the prior approval and requires a fresh approval', () => {
  const f = fixture();
  try {
    ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'פעילות מתנדבים', media: [] });
    const firstOutbox = f.db.prepare("SELECT * FROM outbox WHERE entity_type='draft'").get();
    f.db.prepare('UPDATE outbox SET platform_message_id=? WHERE id=?').run('draft-v1', firstOutbox.id);
    const firstDraft = f.db.prepare("SELECT id FROM drafts WHERE status='pending'").get();
    f.db.prepare(`INSERT INTO approvals
      (draft_id,source_message_id,approver_id,channels,approved_at,approver_key)
      VALUES(?,?,?,?,?,?)`).run(firstDraft.id, 'old-approval', APPROVERS[0].senderId, '["facebook","instagram"]', new Date().toISOString(), APPROVERS[0].key);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE job_key LIKE ? AND kind LIKE 'approval_%'")
      .get(`approval-reminder:${firstDraft.id}:%`).count, 2);
    f.db.prepare(`INSERT INTO outbox(dedupe_key,kind,body,status,created_at)
      VALUES(?,'text','תזכורת ישנה','pending',?)`)
      .run(`approval-reminder:${firstDraft.id}:group:message`, new Date().toISOString());
    const revision = ingestEvent(f.db, f.config, {
      id: 'revise-v2', chatId: 'group@g.us', senderId: 'member', text: 'תקן את האימוג׳י ללב כתום',
    });
    assert.equal(revision.type, 'draft_revised');
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM approvals WHERE draft_id=?').get(revision.draftId).count, 0);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM approvals WHERE draft_id=?').get(firstDraft.id).count, 0);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE job_key LIKE ? AND kind LIKE 'approval_%'")
      .get(`approval-reminder:${firstDraft.id}:%`).count, 0);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM outbox WHERE dedupe_key LIKE ?')
      .get(`approval-reminder:${firstDraft.id}:%`).count, 0);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE kind='publish'").get().count, 0);
  } finally { f.close(); }
});

test('an unapproved draft gets group and targeted Hermes reminders after thirty minutes', async () => {
  const f = fixture();
  try {
    const now = new Date('2026-11-08T06:30:00.000Z');
    for (const person of APPROVERS) {
      ingestEvent(f.db, f.config, {
        id: `learn-${person.key}`, chatId: 'group@g.us', senderId: person.senderId, senderName: person.name,
        text: 'הודעת קבוצה', semantic: { intent: 'group_conversation', confidence: 1 },
      }, now);
    }
    ingestEvent(f.db, f.config, { id: 'draft', chatId: 'group@g.us', senderId: 'u1', text: 'פעילות מתנדבים', media: [{ key: 'photo', path: '/photo.jpg' }] }, now);
    const draftOutbox = f.db.prepare("SELECT * FROM outbox WHERE entity_type='draft'").get();
    f.db.prepare('UPDATE outbox SET platform_message_id=? WHERE id=?').run('draft-message', draftOutbox.id);
    await processJobs(f.db, f.config, new Date(now.getTime() + 31 * 60_000));
    const groupReminder = f.db.prepare("SELECT * FROM outbox WHERE dedupe_key LIKE 'approval-reminder:%:group:message'").get();
    assert.match(groupReminder.body, /ארז, שלומי, דורי, שנהב/);
    assert.equal(groupReminder.target_chat_id, null);
    const privateRows = f.db.prepare("SELECT target_chat_id,body,media_path FROM outbox WHERE dedupe_key LIKE 'approval-reminder:%:private:1:%' ORDER BY target_chat_id").all();
    assert.deepEqual(privateRows.map((row) => row.target_chat_id), ['10001@lid', '10002@lid', '10003@lid', '10004@lid']);
    for (const row of privateRows) {
      assert.match(row.body, /הפוסט הבא עדיין ממתין לאישור שלך/);
      assert.match(row.body, /פייסבוק:\nפעילות מתנדבים/);
      assert.match(row.body, /אינסטגרם:\nפעילות מתנדבים/);
      assert.equal(row.media_path, '/photo.jpg');
    }
    assert.ok(f.db.prepare("SELECT COUNT(*) AS count FROM outbox WHERE dedupe_key LIKE 'approval-reminder:%:private:1:%' AND entity_type='draft' AND entity_id IS NOT NULL").get().count === 4);
    const next = f.db.prepare("SELECT * FROM jobs WHERE job_key LIKE 'approval-reminder:%:private:2'").get();
    assert.ok(next);
  } finally { f.close(); }
});

test('private reminders never send to placeholder identities', async () => {
  const f = fixture();
  try {
    const now = new Date('2026-11-08T06:30:00.000Z');
    ingestEvent(f.db, f.config, { id: 'draft', chatId: 'group@g.us', senderId: 'u1', text: 'פעילות מתנדבים', media: [] }, now);
    f.db.prepare(`INSERT INTO approver_identities(approver_key,display_name,sender_id,updated_at)
      VALUES('shenhav','שנהב','recovered-group-member-shanhav',?)
      ON CONFLICT(approver_key) DO UPDATE SET sender_id=excluded.sender_id`).run(now.toISOString());
    await processJobs(f.db, f.config, new Date(now.getTime() + 31 * 60_000));
    const unsafe = f.db.prepare("SELECT COUNT(*) AS count FROM outbox WHERE target_chat_id='recovered-group-member-shanhav'").get();
    assert.equal(unsafe.count, 0);
  } finally { f.close(); }
});

test('approver identity learning rejects non-WhatsApp placeholders', () => {
  const f = fixture();
  try {
    f.db.prepare("DELETE FROM approver_identities WHERE approver_key='shenhav'").run();
    ingestEvent(f.db, f.config, {
      id: 'placeholder', chatId: 'group@g.us', senderId: 'recovered-group-member-shanhav', senderName: 'שנהב',
      text: 'הודעת קבוצה', semantic: { intent: 'group_conversation', confidence: 1 },
    });
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM approver_identities WHERE approver_key='shenhav'").get().count, 0);
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

test('an older pending morning draft never blocks the next workday proposal', () => {
  const f = fixture();
  try {
    const sunday = new Date('2026-11-08T08:00:00.000Z');
    scheduleDueWork(f.db, sunday);
    f.db.prepare(`INSERT INTO posts
      (public_id,status,source_kind,brief,media_json,created_at,updated_at)
      VALUES('M20261108','awaiting_approval','morning','','[]',?,?)`).run(sunday.toISOString(), sunday.toISOString());
    const post = f.db.prepare("SELECT id FROM posts WHERE public_id='M20261108'").get();
    f.db.prepare(`INSERT INTO drafts
      (post_id,version,facebook_text,instagram_text,media_json,fingerprint,status,created_at)
      VALUES(?,1,'פייסבוק','אינסטגרם','[]','old','pending',?)`).run(post.id, sunday.toISOString());
    scheduleDueWork(f.db, new Date('2026-11-09T08:00:00.000Z'));
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE kind='morning_proposal'").get().count, 2);
  } finally { f.close(); }
});

test('a failed morning job is rearmed after the computer wakes later', () => {
  const f = fixture();
  try {
    const now = new Date('2026-11-09T10:30:00.000Z');
    const failedAt = new Date(now.getTime() - 20 * 60_000).toISOString();
    f.db.prepare(`INSERT INTO jobs
      (job_key,kind,payload_json,status,attempts,run_after,last_error,created_at,updated_at)
      VALUES('morning:2026-11-09','morning_proposal','{}','failed',3,?,'semantic_router_timeout',?,?)`)
      .run(failedAt, failedAt, failedAt);
    scheduleDueWork(f.db, now);
    const job = f.db.prepare("SELECT * FROM jobs WHERE job_key='morning:2026-11-09'").get();
    assert.equal(job.status, 'pending');
    assert.equal(job.attempts, 0);
    assert.equal(job.last_error, null);
  } finally { f.close(); }
});

test('a recent failed morning job is not rearmed in a tight loop', () => {
  const f = fixture();
  try {
    const now = new Date('2026-11-09T10:30:00.000Z');
    const failedAt = new Date(now.getTime() - 5 * 60_000).toISOString();
    f.db.prepare(`INSERT INTO jobs
      (job_key,kind,payload_json,status,attempts,run_after,last_error,created_at,updated_at)
      VALUES('morning:2026-11-09','morning_proposal','{}','failed',3,?,'semantic_router_timeout',?,?)`)
      .run(failedAt, failedAt, failedAt);
    scheduleDueWork(f.db, now);
    const job = f.db.prepare("SELECT * FROM jobs WHERE job_key='morning:2026-11-09'").get();
    assert.equal(job.status, 'failed');
    assert.equal(job.attempts, 3);
  } finally { f.close(); }
});

test('an orphaned morning post without a draft does not block the current proposal', () => {
  const f = fixture();
  try {
    const now = new Date('2026-11-08T06:31:00.000Z');
    f.db.prepare(`INSERT INTO posts
      (public_id,status,source_kind,brief,media_json,created_at,updated_at)
      VALUES('MORPHAN','awaiting_approval','morning','','[]',?,?)`).run(now.toISOString(), now.toISOString());
    scheduleDueWork(f.db, now);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE kind='morning_proposal'").get().count, 1);
  } finally { f.close(); }
});

test('daily proposal is idempotent, includes media, and completes both publication ledgers', async () => {
  const f = fixture();
  try {
    const now = new Date('2026-11-08T06:31:00.000Z');
    f.db.prepare('INSERT INTO media_usage(media_key,source,metadata_json) VALUES(?,?,?)')
      .run('approved-photo', 'google-photos:approved', JSON.stringify({ path: '/approved.jpg', variants: { facebook: '/approved-facebook.jpg', instagram: '/approved-instagram.jpg' } }));
    scheduleDueWork(f.db, now);
    f.db.prepare("UPDATE jobs SET status='done' WHERE kind='media_sync'").run();
    const copy = {
      facebook: 'הבוקר אנחנו מזכירים שהמוכנות שלנו מתחילה באנשים ובציוד.',
      instagram: 'מוכנים למען הקהילה 🧡\n\n#איחודהצלה #שוהם #קהילה',
      clarification: null,
      generator: 'codex',
    };
    const morning = await processJobs(f.db, f.config, now, 20, { generateCopy: async () => copy });
    assert.deepEqual(morning.map(({ kind, status }) => ({ kind, status })), [{ kind: 'morning_proposal', status: 'done' }]);
    const post = f.db.prepare("SELECT * FROM posts WHERE source_kind='morning'").get();
    const draft = f.db.prepare('SELECT * FROM drafts WHERE post_id=?').get(post.id);
    const draftMedia = JSON.parse(draft.media_json);
    const proposal = f.db.prepare("SELECT * FROM outbox WHERE dedupe_key='morning:2026-11-08:draft'").get();
    assert.equal(post.public_id, 'M20261108');
    assert.equal(draftMedia[0].path, '/approved.jpg');
    assert.equal(proposal.media_path, '/approved.jpg');
    assert.equal(f.db.prepare("SELECT post_id FROM media_usage WHERE media_key='approved-photo'").get().post_id, post.id);

    const stalePost = f.db.prepare(`INSERT INTO posts
      (public_id,status,source_kind,brief,media_json,created_at,updated_at)
      VALUES('STALE','awaiting_approval','whatsapp','ישן','[]',?,?)`)
      .run(new Date(now.getTime() - 60_000).toISOString(), new Date(now.getTime() - 60_000).toISOString());
    const staleDraft = f.db.prepare(`INSERT INTO drafts
      (post_id,version,facebook_text,instagram_text,media_json,fingerprint,status,created_at)
      VALUES(?,1,'ישן','ישן','[]','stale','pending',?)`)
      .run(Number(stalePost.lastInsertRowid), new Date(now.getTime() - 60_000).toISOString());
    f.db.prepare(`INSERT INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
      VALUES('approval-reminder:stale:private:1','approval_private_reminder',?,'pending',?,?,?)`)
      .run(JSON.stringify({ draftId: Number(staleDraft.lastInsertRowid), round: 1 }), new Date(now.getTime() + 60 * 60_000).toISOString(), now.toISOString(), now.toISOString());
    f.db.prepare(`INSERT INTO outbox(dedupe_key,kind,body,entity_type,entity_id,status,created_at)
      VALUES('approval-reminder:stale:private:1:erez','text','ישן','draft',?,'pending',?)`)
      .run(Number(staleDraft.lastInsertRowid), now.toISOString());

    f.db.prepare('UPDATE outbox SET platform_message_id=? WHERE id=?').run('morning-draft-message', proposal.id);
    const approvals = approve(f, 'morning-draft-message', 'morning-approval', new Date(now.getTime() + 60_000));
    assert.equal(approvals[0].type, 'approved');
    f.config.metaDryRun = false;
    const calls = [];
    const browserBridge = {
      async request(type, payload) {
        calls.push({ type, payload });
        return payload.channel === 'facebook'
          ? { id: 'fb-post', url: 'https://www.facebook.com/ihud.shoham/posts/fb-post/' }
          : { id: 'ig-post', url: 'https://www.instagram.com/ihud.shoham/p/ig-post/' };
      },
    };
    const published = await processJobs(f.db, f.config, new Date(now.getTime() + 120_000), 20, { browserBridge });
    assert.equal(published.length, 2);
    assert.ok(published.every(({ status }) => status === 'done'));
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM publications WHERE status='published'").get().count, 2);
    assert.equal(f.db.prepare('SELECT status FROM posts WHERE id=?').get(post.id).status, 'published');
    assert.equal(f.db.prepare('SELECT status FROM drafts WHERE id=?').get(draft.id).status, 'published');
    assert.equal(f.db.prepare('SELECT status FROM posts WHERE id=?').get(Number(stalePost.lastInsertRowid)).status, 'cancelled');
    assert.equal(f.db.prepare('SELECT status FROM drafts WHERE id=?').get(Number(staleDraft.lastInsertRowid)).status, 'superseded');
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE job_key='approval-reminder:stale:private:1'").get().count, 0);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM outbox WHERE dedupe_key='approval-reminder:stale:private:1:erez'").get().count, 0);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(({ type, payload }) => type === 'publishMeta' && payload.media[0].path === '/approved.jpg'));
    const volunteerShare = f.db.prepare("SELECT body FROM outbox WHERE dedupe_key=?").get(`publish:${draft.id}:volunteer-share`);
    assert.match(volunteerShare.body, /הודעה מוכנה להעברה לקבוצת המתנדבים/);
    assert.match(volunteerShare.body, /facebook\.com\/ihud\.shoham/);
    assert.match(volunteerShare.body, /instagram\.com\/ihud\.shoham/);
    assert.doesNotMatch(volunteerShare.body, /—/u);
  } finally { f.close(); }
});

test('a partial morning post is resumed instead of inserted twice', async () => {
  const f = fixture();
  try {
    const now = new Date('2026-11-08T06:31:00.000Z');
    f.db.prepare('INSERT INTO media_usage(media_key,source,metadata_json) VALUES(?,?,?)')
      .run('approved-photo', 'google-photos:approved', JSON.stringify({ path: '/approved.jpg' }));
    f.db.prepare(`INSERT INTO posts
      (public_id,status,source_kind,brief,media_json,created_at,updated_at,expires_at)
      VALUES('M20261108','awaiting_approval','morning','','[]',?,?,?)`)
      .run(now.toISOString(), now.toISOString(), new Date(now.getTime() + 86_400_000).toISOString());
    f.db.prepare(`INSERT INTO jobs
      (job_key,kind,payload_json,status,run_after,created_at,updated_at)
      VALUES('morning:2026-11-08','morning_proposal','{}','pending',?,?,?)`)
      .run(now.toISOString(), now.toISOString(), now.toISOString());
    const result = await processJobs(f.db, f.config, now, 20, { generateCopy: async () => ({ facebook: 'פייסבוק', instagram: 'אינסטגרם' }) });
    assert.equal(result[0].status, 'done');
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM posts').get().count, 1);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM drafts').get().count, 1);
  } finally { f.close(); }
});

test('dry-run publication never invokes an external publisher', async () => {
  const f = fixture();
  try {
    ingestEvent(f.db, f.config, { id: 'm1', chatId: 'group@g.us', senderId: 'u1', text: 'תרגול', media: [] });
    const outbox = f.db.prepare("SELECT * FROM outbox WHERE entity_type='draft'").get();
    f.db.prepare('UPDATE outbox SET platform_message_id=? WHERE id=?').run('draft-message', outbox.id);
    approve(f, 'draft-message', 'dry-run-approval');
    const results = await processJobs(f.db, f.config, new Date(Date.now() + 10_000));
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

test('media sync remains healthy when the approved local catalog already has media', async () => {
  const f = fixture();
  try {
    const now = new Date('2026-11-08T08:00:00.000Z');
    f.db.prepare('INSERT INTO media_usage(media_key,source,metadata_json) VALUES(?,?,?)')
      .run('existing', 'google-photos:approved', JSON.stringify({ path: '/existing.jpg' }));
    f.db.prepare(`INSERT INTO jobs
      (job_key,kind,payload_json,status,run_after,created_at,updated_at)
      VALUES('media-sync-existing','media_sync','{}','pending',?,?,?)`)
      .run(now.toISOString(), now.toISOString(), now.toISOString());
    const browserBridge = { async request() { return { imported: [] }; } };
    const results = await processJobs(f.db, f.config, now, 20, { browserBridge });
    assert.equal(results[0].status, 'done');
    assert.equal(f.db.prepare("SELECT status FROM jobs WHERE job_key='media-sync-existing'").get().status, 'done');
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
