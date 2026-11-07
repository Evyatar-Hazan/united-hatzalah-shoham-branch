import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
        user_message: 'בדיקת סקיצה',
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
