import { randomUUID } from 'node:crypto';
import { appendSignature, draftFromBrief, extractCommand, fingerprint, normalize } from './text.mjs';
import { getSetting, nowIso, setSetting } from './database.mjs';

const DAY = 24 * 60 * 60 * 1000;

function enqueue(db, { dedupeKey, body, mediaPath = null, replyToId = null, entityType = null, entityId = null }, now) {
  db.prepare(`INSERT OR IGNORE INTO outbox
    (dedupe_key,kind,body,media_path,reply_to_id,entity_type,entity_id,status,created_at)
    VALUES(?,?,?,?,?,?,?,'pending',?)`)
    .run(dedupeKey, mediaPath ? 'media' : 'text', body, mediaPath, replyToId, entityType, entityId, nowIso(now));
}

function findDraftByReply(db, replyToId, replyToText = '') {
  let row = null;
  if (replyToId) row = db.prepare(`SELECT d.*, p.public_id, p.status AS post_status
    FROM outbox o JOIN drafts d ON o.entity_type='draft' AND o.entity_id=d.id
    JOIN posts p ON p.id=d.post_id WHERE o.platform_message_id=?`).get(replyToId);
  if (row) return row;
  const match = String(replyToText).match(/סקיצה\s+([A-Z0-9]+)\s*[·-]\s*גרסה\s+(\d+)/i);
  if (!match) return null;
  return db.prepare(`SELECT d.*, p.public_id, p.status AS post_status FROM drafts d
    JOIN posts p ON p.id=d.post_id WHERE p.public_id=? AND d.version=?`).get(match[1].toUpperCase(), Number(match[2]));
}

function latestDraft(db, postId) {
  return db.prepare('SELECT * FROM drafts WHERE post_id=? ORDER BY version DESC LIMIT 1').get(postId);
}

function activeDrafts(db) {
  return db.prepare(`SELECT d.*, p.public_id, p.status AS post_status
    FROM drafts d JOIN posts p ON p.id=d.post_id
    WHERE d.status='pending' AND p.status='awaiting_approval'
    ORDER BY p.updated_at DESC`).all();
}

function isRevisionRequest(text) {
  return /(תחליף|החלף|שנה|תקן|תוסיף|הוסף|תסיר|הסר|שלח\s+(?:אותה|אותו|את\s+הסקיצה)|תמונה|אימוג['׳]?י|לב\s+כתום|🧡)/i.test(normalize(text));
}

function wantsImageReplacement(text) {
  return /(?:(?:תחליף|החלף|שנה|תוסיף|הוסף).{0,20}תמונה|תמונה.{0,20}(?:אחרת|חדשה|מתאימה|יותר))/i.test(normalize(text));
}

function wantsResend(text) {
  return /שלח\s+(?:אותה|אותו|את\s+הסקיצה)(?:\s+פה)?/i.test(normalize(text));
}

function wantsOrangeHeart(text) {
  return /(לב\s+כתום|אימוג['׳]?י.{0,20}כתום|🧡)/i.test(normalize(text));
}

function mediaKeys(media) {
  return new Set(media.map((item) => item?.key).filter(Boolean));
}

function chooseAlternativeMedia(db, currentMedia = []) {
  const excluded = mediaKeys(currentMedia);
  const rows = db.prepare(`SELECT * FROM media_usage
    ORDER BY CASE WHEN last_used_at IS NULL THEN 0 ELSE 1 END, COALESCE(last_used_at,''), media_key`).all();
  const row = rows.find((candidate) => !excluded.has(candidate.media_key));
  if (!row) return null;
  const metadata = JSON.parse(row.metadata_json || '{}');
  return { key: row.media_key, ...metadata, source: metadata.source || row.source };
}

function draftBody(post, version, copy, media) {
  const mediaLine = media.length ? `\n\nמדיה: ${media.length} קבצים מצורפים` : '\n\nמדיה: טרם צורפה';
  return `סקיצה ${post.public_id} · גרסה ${version}\n\nפייסבוק:\n${copy.facebook}\n\nאינסטגרם:\n${copy.instagram}${mediaLine}\n\nלאישור השיבו ישירות: מאשר / מאשר לפייסבוק / מאשר לאינסטגרם`;
}

function createDraftVersion(db, post, copy, brief, media, now, type = 'draft_created') {
  const previous = latestDraft(db, post.id);
  const version = (previous?.version || 0) + 1;
  const value = { facebook: copy.facebook, instagram: copy.instagram, media };
  const hash = fingerprint(value);
  db.prepare("UPDATE drafts SET status='superseded' WHERE post_id=? AND status='pending'").run(post.id);
  const result = db.prepare(`INSERT INTO drafts
    (post_id,version,facebook_text,instagram_text,media_json,fingerprint,status,created_at)
    VALUES(?,?,?,?,?,?,'pending',?)`)
    .run(post.id, version, copy.facebook, copy.instagram, JSON.stringify(media), hash, nowIso(now));
  const draftId = Number(result.lastInsertRowid);
  enqueue(db, {
    dedupeKey: `draft:${draftId}`,
    body: draftBody(post, version, copy, media),
    mediaPath: media[0]?.path || null,
    entityType: 'draft',
    entityId: draftId,
  }, now);
  db.prepare("UPDATE posts SET status='awaiting_approval', brief=?, media_json=?, updated_at=?, expires_at=? WHERE id=?")
    .run(brief, JSON.stringify(media), nowIso(now), new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(), post.id);
  return { type, post: post.public_id, draftId, version };
}

function createDraft(db, post, brief, media, now) {
  const copy = draftFromBrief(brief);
  return createDraftVersion(db, post, copy, brief, media, now);
}

function reviseDraft(db, draft, event, now) {
  const post = db.prepare('SELECT * FROM posts WHERE id=?').get(draft.post_id);
  const currentMedia = JSON.parse(draft.media_json || post.media_json || '[]');
  let media = event.media?.length ? event.media : currentMedia;
  if (!event.media?.length && wantsImageReplacement(event.text)) {
    const replacement = chooseAlternativeMedia(db, currentMedia);
    if (!replacement) {
      enqueue(db, { dedupeKey: `media-clarify:${event.id}`, body: 'לא מצאתי כרגע תמונה חלופית במקורות המאושרים. שלחו תמונה כאן או ציינו מאיזה אלבום לבחור.' }, now);
      return { type: 'clarification_required' };
    }
    media = [replacement];
  }
  let copy = { facebook: draft.facebook_text, instagram: draft.instagram_text };
  if (wantsOrangeHeart(event.text)) {
    copy = {
      facebook: copy.facebook.replace(/[💚💙❤️❤]/gu, '🧡'),
      instagram: copy.instagram.replace(/[💚💙❤️❤]/gu, '🧡'),
    };
  }
  const unchanged = fingerprint({ ...copy, media }) === draft.fingerprint;
  if (unchanged && wantsResend(event.text)) {
    enqueue(db, {
      dedupeKey: `resend:${event.id}`,
      body: draftBody(post, draft.version, copy, media),
      mediaPath: media[0]?.path || null,
      entityType: 'draft',
      entityId: draft.id,
    }, now);
    return { type: 'draft_resent', post: post.public_id, draftId: draft.id, version: draft.version };
  }
  if (unchanged) {
    enqueue(db, { dedupeKey: `revision-clarify:${event.id}`, body: 'לא היה ברור איזה שינוי לבצע בסקיצה הפעילה. מה בדיוק לשנות?' }, now);
    return { type: 'clarification_required' };
  }
  return createDraftVersion(db, post, copy, post.brief, media, now, 'draft_revised');
}

function createPost(db, event, now) {
  const publicId = randomUUID().slice(0, 8).toUpperCase();
  const media = Array.isArray(event.media) ? event.media : [];
  const result = db.prepare(`INSERT INTO posts
    (public_id,status,source_message_id,source_kind,brief,media_json,created_at,updated_at)
    VALUES(?,'drafting',?,'whatsapp',?,?,?,?)`)
    .run(publicId, event.id, normalize(event.text), JSON.stringify(media), nowIso(now), nowIso(now));
  return { id: Number(result.lastInsertRowid), public_id: publicId };
}

function handleApproval(db, event, command, draft, now) {
  if (!draft) {
    enqueue(db, { dedupeKey: `clarify:${event.id}`, body: 'לא מצאתי את הסקיצה שאליה התכוונת. נא להשיב ישירות להודעת הסקיצה.' }, now);
    return { type: 'clarification_required' };
  }
  if (draft.status !== 'pending' || draft.post_status !== 'awaiting_approval') {
    enqueue(db, { dedupeKey: `stale:${event.id}`, body: 'הסקיצה הזו אינה הגרסה הפעילה. נא לאשר את הגרסה האחרונה בלבד.' }, now);
    return { type: 'stale_approval' };
  }
  const post = db.prepare('SELECT expires_at FROM posts WHERE id=?').get(draft.post_id);
  if (post?.expires_at && new Date(post.expires_at) < now) {
    enqueue(db, { dedupeKey: `expired:${event.id}`, body: 'תוקף הסקיצה פג לאחר 72 שעות. אכין גרסה עדכנית לאישור חדש.' }, now);
    return { type: 'approval_expired' };
  }
  db.prepare(`INSERT OR IGNORE INTO approvals
    (draft_id,source_message_id,approver_id,channels,approved_at) VALUES(?,?,?,?,?)`)
    .run(draft.id, event.id, event.senderId, JSON.stringify(command.channels), nowIso(now));
  for (const channel of command.channels) {
    db.prepare(`INSERT INTO publications(draft_id,channel,status,attempts,updated_at)
      VALUES(?,?,'queued',0,?) ON CONFLICT(draft_id,channel) DO NOTHING`)
      .run(draft.id, channel, nowIso(now));
    db.prepare(`INSERT OR IGNORE INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
      VALUES(?,'publish',?,'pending',?,?,?)`)
      .run(`publish:${draft.id}:${channel}`, JSON.stringify({ draftId: draft.id, channel }), nowIso(now), nowIso(now), nowIso(now));
  }
  db.prepare("UPDATE posts SET status='approved', updated_at=? WHERE id=?").run(nowIso(now), draft.post_id);
  enqueue(db, { dedupeKey: `approved:${event.id}`, body: `האישור נקלט לגרסה ${draft.version}. הפרסום הוכנס לתור המאובטח.` }, now);
  return { type: 'approved', draftId: draft.id, channels: command.channels };
}

export function ingestEvent(db, config, event, now = new Date()) {
  if (!event?.id || !event?.chatId || !event?.senderId) throw new Error('event requires id, chatId and senderId');
  if (config.groupId && event.chatId !== config.groupId) return { type: 'ignored_chat' };
  const inserted = db.prepare(`INSERT OR IGNORE INTO inbound_messages
    (source_id,chat_id,sender_id,sender_name,text,reply_to_id,media_json,received_at)
    VALUES(?,?,?,?,?,?,?,?)`)
    .run(event.id, event.chatId, event.senderId, event.senderName || null, event.text || '', event.replyToId || null,
      JSON.stringify(event.media || []), event.receivedAt || nowIso(now));
  if (!inserted.changes) return { type: 'duplicate' };

  const command = extractCommand(event.text);
  let draft = findDraftByReply(db, event.replyToId, event.replyToText);
  const revision = command.type === 'content' && isRevisionRequest(event.text);
  if (!draft && revision) {
    const active = activeDrafts(db);
    if (active.length === 1) draft = active[0];
    else {
      const result = { type: 'clarification_required' };
      const body = active.length > 1
        ? 'יש יותר מסקיצה פעילה אחת. נא להשיב ישירות לסקיצה שברצונכם לשנות.'
        : 'אין כרגע סקיצה פעילה לשינוי. שלחו תמונה וטקסט או כתבו איזה פוסט חדש להכין.';
      enqueue(db, { dedupeKey: `revision-target:${event.id}`, body }, now);
      db.prepare('UPDATE inbound_messages SET processed_at=?, result_json=? WHERE source_id=?')
        .run(nowIso(now), JSON.stringify(result), event.id);
      return result;
    }
  }
  let result;
  if (command.type === 'stop' || command.type === 'start') {
    if (!config.ownerId || event.senderId !== config.ownerId) {
      result = { type: 'owner_only' };
      enqueue(db, { dedupeKey: `owner-only:${event.id}`, body: 'רק אביתר רשאי לעצור או להפעיל את המערכת.' }, now);
    } else {
      const enabled = command.type === 'start';
      setSetting(db, 'system_enabled', enabled, now);
      result = { type: enabled ? 'started' : 'stopped' };
      enqueue(db, { dedupeKey: `system:${event.id}`, body: enabled ? 'המערכת הופעלה.' : 'המערכת נעצרה. הודעות יישמרו אך לא יעובדו עד להפעלה.' }, now);
    }
  } else if (!getSetting(db, 'system_enabled', true)) {
    result = { type: 'paused' };
  } else if (command.type === 'approve') {
    result = handleApproval(db, event, command, draft, now);
  } else if (command.type === 'cancel') {
    if (!draft) {
      result = { type: 'clarification_required' };
      enqueue(db, { dedupeKey: `cancel-clarify:${event.id}`, body: 'כדי לבטל, נא להשיב ישירות לסקיצה.' }, now);
    } else {
      db.prepare("UPDATE posts SET status='cancelled', updated_at=? WHERE id=? AND status!='published'").run(nowIso(now), draft.post_id);
      result = { type: 'cancelled', draftId: draft.id };
      enqueue(db, { dedupeKey: `cancelled:${event.id}`, body: 'הסקיצה בוטלה ולא תפורסם.' }, now);
    }
  } else if (command.type === 'retry') {
    if (!draft) {
      result = { type: 'clarification_required' };
      enqueue(db, { dedupeKey: `retry-clarify:${event.id}`, body: 'כדי לנסות שוב, נא להשיב ישירות לקבלת הכשל או לסקיצה.' }, now);
    } else {
      const failed = db.prepare("SELECT channel FROM publications WHERE draft_id=? AND status='failed'").all(draft.id);
      for (const { channel } of failed) {
        db.prepare("UPDATE publications SET status='queued', attempts=0, last_error=NULL, updated_at=? WHERE draft_id=? AND channel=?")
          .run(nowIso(now), draft.id, channel);
        db.prepare(`INSERT OR REPLACE INTO jobs(job_key,kind,payload_json,status,attempts,run_after,created_at,updated_at)
          VALUES(?,'publish',?,'pending',0,?,?,?)`)
          .run(`retry:${event.id}:${channel}`, JSON.stringify({ draftId: draft.id, channel }), nowIso(now), nowIso(now), nowIso(now));
      }
      result = { type: 'retry_queued', channels: failed.map((row) => row.channel) };
    }
  } else if (draft && revision) {
    result = reviseDraft(db, draft, event, now);
  } else if (draft) {
    const post = db.prepare('SELECT * FROM posts WHERE id=?').get(draft.post_id);
    result = createDraft(db, post, normalize(event.text) || post.brief, event.media?.length ? event.media : JSON.parse(post.media_json), now);
  } else {
    const post = createPost(db, event, now);
    if (!normalize(event.text) && !(event.media || []).length) {
      result = { type: 'clarification_required' };
      enqueue(db, { dedupeKey: `empty:${event.id}`, body: 'לא התקבלו טקסט או תמונה. מה תרצו להכין?' }, now);
    } else {
      result = createDraft(db, post, event.text, event.media || [], now);
    }
  }
  db.prepare('UPDATE inbound_messages SET processed_at=?, result_json=? WHERE source_id=?')
    .run(nowIso(now), JSON.stringify(result), event.id);
  return result;
}

export function scheduleDueWork(db, now = new Date()) {
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const parts = Object.fromEntries(local.map((part) => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const weekday = parts.weekday;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const workday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].includes(weekday);
  const pendingMorning = db.prepare("SELECT 1 FROM posts WHERE source_kind='morning' AND status='awaiting_approval' LIMIT 1").get();
  if (workday && minutes >= 490) {
    const syncKey = `media-sync:${date}`;
    db.prepare(`INSERT OR IGNORE INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
      VALUES(?,'media_sync','{}','pending',?,?,?)`).run(syncKey, nowIso(now), nowIso(now), nowIso(now));
  }
  if (workday && minutes >= 510 && !pendingMorning) {
    const key = `morning:${date}`;
    db.prepare(`INSERT OR IGNORE INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
      VALUES(?,'morning_proposal','{}','pending',?,?,?)`).run(key, nowIso(now), nowIso(now), nowIso(now));
  }
  if (weekday === 'Sun' && minutes >= 1080) {
    const weekKey = `weekly:${date}`;
    db.prepare(`INSERT OR IGNORE INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
      VALUES(?,'weekly_report','{}','pending',?,?,?)`).run(weekKey, nowIso(now), nowIso(now), nowIso(now));
  }
}

export function expireOldWork(db, now = new Date()) {
  db.prepare("UPDATE posts SET status='expired', updated_at=? WHERE status IN ('awaiting_approval','approved') AND expires_at IS NOT NULL AND expires_at<?")
    .run(nowIso(now), nowIso(now));
  const cutoff = new Date(now.getTime() - 7 * DAY).toISOString();
  db.prepare("UPDATE jobs SET status='expired', updated_at=? WHERE status IN ('pending','failed') AND created_at<?")
    .run(nowIso(now), cutoff);
}

export function formatOutboxBody(config, body) {
  return appendSignature(body, config.signature);
}
