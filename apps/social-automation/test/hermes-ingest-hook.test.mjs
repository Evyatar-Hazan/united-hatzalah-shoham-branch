import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../src/database.mjs';

const hook = fileURLToPath(new URL('../scripts/hermes-ingest-hook.mjs', import.meta.url));
const groupId = 'test-group@g.us';

function runHook(chatId) {
  const dataDir = mkdtempSync(join(tmpdir(), 'shoham-hook-'));
  const result = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({
      session_id: 'test-session',
      extra: {
        platform: 'whatsapp',
        chat_id: chatId,
        user_message: 'תכין פוסט חדש על פעילות קהילתית',
        turn_id: `turn-${chatId}`,
        sender_id: 'test-sender',
      },
    }),
    encoding: 'utf8',
    env: {
      ...process.env,
      SOCIAL_DATA_DIR: dataDir,
      SOCIAL_GROUP_ID: groupId,
      SOCIAL_DRY_RUN: 'true',
      SOCIAL_WHATSAPP_DRY_RUN: 'true',
      SOCIAL_META_DRY_RUN: 'true',
      NODE_ENV: 'test',
      SOCIAL_SEMANTIC_DECISION_JSON: '{"intent":"create_post","confidence":0.99,"reason":"explicit request","question":null,"channels":[]}',
    },
  });
  return { dataDir, result };
}

test('Hermes ingest hook ignores WhatsApp chats outside the configured group', () => {
  const { dataDir, result } = runHook('different-group@g.us');
  try {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(existsSync(join(dataDir, 'social.db')), false);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('Hermes ingest hook accepts the configured WhatsApp group', () => {
  const { dataDir, result } = runHook(groupId);
  try {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Shoham social workflow result/);
    assert.equal(existsSync(join(dataDir, 'social.db')), true);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('Hermes ingest hook accepts a private approval only from a verified approver', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'shoham-hook-private-'));
  const senderId = '10001@lid';
  const config = {
    dataDir, dbPath: join(dataDir, 'social.db'), mediaDir: join(dataDir, 'media'), groupId,
    approvers: [{ key: 'erez', name: 'ארז', senderId }], dryRun: true, signature: 'signature',
  };
  const db = openDatabase(config);
  db.prepare(`INSERT INTO posts(public_id,status,source_kind,brief,media_json,created_at,updated_at,expires_at)
    VALUES('PRIVATE1','awaiting_approval','whatsapp','פעילות','[]',?,?,?)`)
    .run(new Date().toISOString(), new Date().toISOString(), new Date(Date.now() + 86_400_000).toISOString());
  const post = db.prepare("SELECT id FROM posts WHERE public_id='PRIVATE1'").get();
  db.prepare(`INSERT INTO drafts(post_id,version,facebook_text,instagram_text,media_json,fingerprint,status,created_at)
    VALUES(?,1,'פייסבוק','אינסטגרם','[]','hash','pending',?)`).run(post.id, new Date().toISOString());
  const draft = db.prepare('SELECT id FROM drafts WHERE post_id=?').get(post.id);
  db.prepare(`INSERT INTO outbox(dedupe_key,kind,body,entity_type,entity_id,target_chat_id,status,created_at,sent_at)
    VALUES('private-reminder','text','תזכורת','draft',?,?,'sent',?,?)`)
    .run(draft.id, senderId, new Date().toISOString(), new Date().toISOString());
  db.close();
  const result = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ session_id: 'private-test', extra: {
      platform: 'whatsapp', chat_id: senderId, source_scope: 'private', user_message: 'מאשר',
      turn_id: 'private-turn', sender_id: senderId, sender_name: 'ארז',
    } }),
    encoding: 'utf8',
    env: {
      ...process.env, SOCIAL_DATA_DIR: dataDir, SOCIAL_GROUP_ID: groupId,
      SOCIAL_APPROVERS_JSON: JSON.stringify(config.approvers), SOCIAL_DRY_RUN: 'true',
      SOCIAL_WHATSAPP_DRY_RUN: 'true', SOCIAL_META_DRY_RUN: 'true', NODE_ENV: 'test',
    },
  });
  try {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /approval_recorded/);
    const check = openDatabase(config);
    assert.equal(check.prepare('SELECT approver_key FROM approvals WHERE draft_id=?').get(draft.id).approver_key, 'erez');
    assert.equal(check.prepare("SELECT target_chat_id FROM outbox WHERE dedupe_key='approval-private-ack:private-turn'").get().target_chat_id, senderId);
    assert.equal(check.prepare("SELECT target_chat_id FROM outbox WHERE dedupe_key='approval-progress:private-turn'").get().target_chat_id, null);
    check.close();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
