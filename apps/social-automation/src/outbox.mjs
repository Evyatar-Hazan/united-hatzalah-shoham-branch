import { formatOutboxBody } from './engine.mjs';
import { nowIso } from './database.mjs';

async function bridgePost(config, path, payload) {
  const response = await fetch(`${config.bridgeUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || `bridge returned ${response.status}`);
  return data;
}

export async function flushOutbox(db, config, now = new Date(), limit = 20) {
  if (!config.groupId) throw new Error('SOCIAL_GROUP_ID is required');
  const rows = db.prepare("SELECT * FROM outbox WHERE status='pending' AND attempts<3 ORDER BY id LIMIT ?").all(limit);
  const results = [];
  for (const row of rows) {
    if (config.whatsappDryRun ?? config.dryRun) {
      db.prepare("UPDATE outbox SET status='dry_run', attempts=attempts+1 WHERE id=?").run(row.id);
      results.push({ id: row.id, status: 'dry_run' });
      continue;
    }
    try {
      const body = formatOutboxBody(config, row.body);
      const payload = row.media_path
        ? { chatId: config.groupId, filePath: row.media_path, caption: body }
        : { chatId: config.groupId, message: body, replyTo: row.reply_to_id || undefined };
      const data = await bridgePost(config, row.media_path ? '/send-media' : '/send', payload);
      db.prepare("UPDATE outbox SET status='sent', attempts=attempts+1, sent_at=?, platform_message_id=? WHERE id=?")
        .run(nowIso(now), data.messageId || null, row.id);
      results.push({ id: row.id, status: 'sent', messageId: data.messageId || null });
    } catch (error) {
      db.prepare("UPDATE outbox SET attempts=attempts+1, last_error=? WHERE id=?").run(String(error.message || error), row.id);
      results.push({ id: row.id, status: 'failed', error: String(error.message || error) });
    }
  }
  return results;
}
