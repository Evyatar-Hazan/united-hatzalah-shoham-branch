#!/usr/bin/env node
import { openDatabase } from '../src/database.mjs';
import { loadConfig } from '../src/config.mjs';
import { ingestEvent } from '../src/engine.mjs';
import { enhanceDraft } from '../src/content-generator.mjs';
import { prepareMediaVariants } from '../src/media-processor.mjs';

let input = '';
for await (const chunk of process.stdin) input += chunk;
try {
  const payload = JSON.parse(input || '{}');
  const extra = payload.extra || {};
  if (extra.platform !== 'whatsapp') process.exit(0);
  const message = String(extra.user_message || '');
  const reply = message.match(/^\[Replying to (?:your previous message|): "([\s\S]*?)"\]\s*/);
  const text = reply ? message.slice(reply[0].length) : message;
  const rawMedia = [...message.matchAll(/(?:Image|Document|Video|Audio)[^\n]*?path:\s*`?([^`\n]+)`?/gi)].map((match) => ({ path: match[1].trim(), source: 'whatsapp' }));
  const config = loadConfig();
  const db = openDatabase(config);
  const media = [];
  for (const [index, item] of rawMedia.entries()) {
    try { media.push(await prepareMediaVariants(config, item, `${extra.turn_id || Date.now()}-${index}`)); }
    catch { media.push(item); }
  }
  const result = ingestEvent(db, config, {
    id: String(extra.turn_id || `${payload.session_id}:${Date.now()}`),
    chatId: config.groupId,
    senderId: String(extra.sender_id || 'unknown'),
    text,
    replyToText: reply?.[1] || null,
    media,
  });
  if (result.draftId) await enhanceDraft(db, config, result.draftId, { timeoutMs: 6_000 });
  const queued = db.prepare("SELECT id,body FROM outbox WHERE status='pending' ORDER BY id DESC LIMIT 1").get();
  db.close();
  console.log(JSON.stringify({ context: `Shoham social workflow result: ${JSON.stringify(result)}.${queued ? ` Pending response for this turn: ${queued.body}` : ''} Respond in Hebrew, briefly, and do not claim publication unless the result includes a verified URL.` }));
} catch (error) {
  console.log(JSON.stringify({ context: `Shoham social workflow failed safely: ${String(error.message || error)}. Ask one focused clarification and do not publish.` }));
}
