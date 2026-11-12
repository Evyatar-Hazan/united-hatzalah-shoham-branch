#!/usr/bin/env node
import { openDatabase } from '../src/database.mjs';
import { loadConfig } from '../src/config.mjs';
import { ingestEvent, resolveApprovalClarification } from '../src/engine.mjs';
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
  const isPrivate = extra.source_scope === 'private';
  if (!isPrivate && String(extra.chat_id || '') !== String(config.groupId || '')) process.exit(0);
  const message = String(extra.user_message || '');
  const reply = message.match(/^\[Replying to (?:your previous message|): "([\s\S]*?)"\]\s*/);
  const text = reply ? message.slice(reply[0].length) : message;
  const rawMedia = [...message.matchAll(/(?:Image|Document|Video|Audio)[^\n]*?path:\s*`?([^`\n]+)`?/gi)].map((match) => ({ path: match[1].trim(), source: 'whatsapp' }));
  const db = openDatabase(config);
  if (isPrivate) {
    const known = db.prepare('SELECT 1 FROM approver_identities WHERE sender_id=? LIMIT 1').get(String(extra.sender_id || ''));
    if (!known) {
      db.close();
      process.exit(0);
    }
  }
  const active = db.prepare(`SELECT p.public_id,d.version,d.facebook_text,d.instagram_text,d.media_json
    FROM drafts d JOIN posts p ON p.id=d.post_id
    WHERE d.status='pending' AND p.status='awaiting_approval'
    ORDER BY p.updated_at DESC LIMIT 1`).get();
  const approvalClarification = isPrivate ? null : resolveApprovalClarification(db, text);
  let semantic;
  try {
    semantic = /^(?:כן|מאשר|מאשר לפרסום)$/u.test(text.trim()) ? {
      intent: 'approve_draft',
      confidence: 1,
      reason: isPrivate ? 'private_approval_from_verified_approver' : 'explicit_approval',
      channels: approvalClarification?.channels || ['facebook', 'instagram'],
      copy: null,
      replaceImage: false,
      resend: false,
      controlAction: null,
    } : approvalClarification ? {
      intent: 'approve_draft', confidence: 1, reason: 'affirmative_answer_to_exact_draft_confirmation',
      channels: approvalClarification.channels, copy: null, replaceImage: false, resend: false, controlAction: null,
    } : await classifyInboundMessage(config, {
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
    if (isPrivate) semantic = { ...semantic, intent: 'clarification', question: 'קיבלתי. אם זו תשובת אישור, אפשר לכתוב כאן: מאשר. אם זו הערה לסקיצה, כתבו מה בדיוק לשנות.' };
    else {
      db.close();
      console.log(JSON.stringify({ context: 'Shoham semantic analysis identified ordinary group conversation. Reply exactly NO_REPLY.' }));
      process.exit(0);
    }
  }
  if (isPrivate && ['create_post', 'revise_draft', 'cancel_draft', 'system_control'].includes(semantic.intent)) {
    semantic = { intent: 'clarification', confidence: 1, reason: 'private_messages_never_become_public_content', question: 'קיבלתי את ההודעה בפרטי. כדי שלא אפרש אותה בטעות כתוכן לפרסום, כתבו אם זו הערה לסקיצה או אישור.' };
  }
  const media = [];
  for (const [index, item] of rawMedia.entries()) {
    try { media.push(await prepareMediaVariants(config, item, `${extra.turn_id || Date.now()}-${index}`)); }
    catch { media.push(item); }
  }
  const result = ingestEvent(db, config, {
    id: String(extra.turn_id || `${payload.session_id}:${Date.now()}`),
    chatId: String(extra.chat_id || config.groupId),
    isPrivate,
    senderId: String(extra.sender_id || 'unknown'),
    senderName: String(extra.sender_name || ''),
    text,
    replyToId: String(extra.reply_to_id || '') || null,
    replyToText: String(extra.reply_to_text || reply?.[1] || approvalClarification?.replyToText || '') || null,
    replyToIsOwn: Boolean(extra.reply_to_is_own || reply?.[0]?.includes('your previous message') || approvalClarification),
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
