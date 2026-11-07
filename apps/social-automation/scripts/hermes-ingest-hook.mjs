#!/usr/bin/env node
import { openDatabase } from '../src/database.mjs';
import { loadConfig } from '../src/config.mjs';
import { ingestEvent } from '../src/engine.mjs';
import { prepareMediaVariants } from '../src/media-processor.mjs';
import { flushOutbox } from '../src/outbox.mjs';
import { classifyInboundMessage } from '../src/semantic-router.mjs';

let input = '';
for await (const chunk of process.stdin) input += chunk;
try {
  const payload = JSON.parse(input || '{}');
  const extra = payload.extra || {};
  if (extra.platform !== 'whatsapp') process.exit(0);
  const config = loadConfig();
  if (String(extra.chat_id || '') !== String(config.groupId || '')) process.exit(0);
  const message = String(extra.user_message || '');
  const reply = message.match(/^\[Replying to (?:your previous message|): "([\s\S]*?)"\]\s*/);
  const text = reply ? message.slice(reply[0].length) : message;
  const rawMedia = [...message.matchAll(/(?:Image|Document|Video|Audio)[^\n]*?path:\s*`?([^`\n]+)`?/gi)].map((match) => ({ path: match[1].trim(), source: 'whatsapp' }));
  const db = openDatabase(config);
  const active = db.prepare(`SELECT p.public_id,d.version,d.facebook_text,d.instagram_text,d.media_json
    FROM drafts d JOIN posts p ON p.id=d.post_id
    WHERE d.status='pending' AND p.status='awaiting_approval'
    ORDER BY p.updated_at DESC LIMIT 1`).get();
  let semantic;
  try {
    semantic = await classifyInboundMessage(config, {
      message: text,
      isOwner: Boolean(config.ownerId && String(extra.sender_id || '') === String(config.ownerId)),
      replyToBot: Boolean(extra.reply_to_is_own || reply?.[0]?.includes('your previous message')),
      replyText: String(extra.reply_to_text || reply?.[1] || '').slice(0, 800),
      mediaCount: rawMedia.length,
      activeDraft: active ? {
        publicId: active.public_id,
        version: active.version,
        facebook: active.facebook_text,
        instagram: active.instagram_text,
        mediaCount: JSON.parse(active.media_json || '[]').length,
      } : null,
    });
  } catch {
    db.close();
    console.log(JSON.stringify({ context: 'Shoham semantic analysis failed closed. Reply exactly NO_REPLY.' }));
    process.exit(1);
  }
  if (semantic.intent === 'group_conversation') {
    db.close();
    console.log(JSON.stringify({ context: 'Shoham semantic analysis identified ordinary group conversation. Reply exactly NO_REPLY.' }));
    process.exit(0);
  }
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
    replyToId: String(extra.reply_to_id || '') || null,
    replyToText: String(extra.reply_to_text || reply?.[1] || '') || null,
    replyToIsOwn: Boolean(extra.reply_to_is_own || reply?.[0]?.includes('your previous message')),
    semantic,
    media,
  });
  const queued = db.prepare("SELECT id,body FROM outbox WHERE status='pending' ORDER BY id DESC LIMIT 1").get();
  const deliveries = queued ? await flushOutbox(db, config, new Date(), 20) : [];
  db.close();
  const delivered = deliveries.some((item) => item.status === 'sent');
  console.log(JSON.stringify({ context: delivered
    ? `Shoham social workflow result: ${JSON.stringify(result)}. The exact response and any attached media were already sent through the authorized Hermes bridge. Reply exactly NO_REPLY.`
    : `Shoham social workflow result: ${JSON.stringify(result)}.${queued ? ` Pending response for this turn: ${queued.body}` : ''} Respond in Hebrew, briefly, and do not claim publication unless the result includes a verified URL.` }));
} catch (error) {
  console.log(JSON.stringify({ context: `Shoham social workflow failed safely: ${String(error.message || error)}. Ask one focused clarification and do not publish.` }));
  process.exitCode = 1;
}
