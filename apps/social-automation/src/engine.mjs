import { randomUUID } from 'node:crypto';
import { appendSignature, draftFromBrief, extractCommand, fingerprint, normalize } from './text.mjs';
import { getSetting, nowIso, setSetting } from './database.mjs';
import { isLatestDraftQuery, isRevisionText } from './intent.mjs';

const DAY = 24 * 60 * 60 * 1000;
const MORNING_RETRY_COOLDOWN = 15 * 60 * 1000;
const STALE_JOB_TIMEOUT = 10 * 60 * 1000;
const REMINDER_DELAY = 30 * 60 * 1000;

function approvers(config) {
  return config.approvers || [
    { key: 'erez', name: 'ארז', aliases: ['ארז'] },
    { key: 'shlomi', name: 'שלומי', aliases: ['שלומי'] },
    { key: 'dori', name: 'דורי', aliases: ['דורי'] },
    { key: 'shenhav', name: 'שנהב', aliases: ['שנהב'] },
  ];
}

function resolveApprover(config, event) {
  const senderName = normalize(event.senderName || '');
  const senderId = String(event.senderId || '');
  return approvers(config).find((person) => person.senderId === senderId
    || [person.name, ...(person.aliases || [])].some((alias) => senderName.includes(normalize(alias))));
}

function learnApproverIdentity(db, person, event, now) {
  if (!person) return;
  db.prepare(`INSERT INTO approver_identities(approver_key,display_name,sender_id,updated_at)
    VALUES(?,?,?,?) ON CONFLICT(approver_key) DO UPDATE SET
    display_name=excluded.display_name,sender_id=excluded.sender_id,updated_at=excluded.updated_at`)
    .run(person.key, person.name, event.senderId, nowIso(now));
}

function scheduleApprovalReminders(db, draftId, now) {
  const groupAt = new Date(now.getTime() + REMINDER_DELAY);
  const privateAt = new Date(now.getTime() + 2 * REMINDER_DELAY);
  db.prepare(`INSERT OR IGNORE INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
    VALUES(?,'approval_group_reminder',?,'pending',?,?,?)`)
    .run(`approval-reminder:${draftId}:group`, JSON.stringify({ draftId }), nowIso(groupAt), nowIso(now), nowIso(now));
  db.prepare(`INSERT OR IGNORE INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
    VALUES(?,'approval_private_reminder',?,'pending',?,?,?)`)
    .run(`approval-reminder:${draftId}:private:1`, JSON.stringify({ draftId, round: 1 }), nowIso(privateAt), nowIso(now), nowIso(now));
}

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

export function resolveApprovalClarification(db, text, now = new Date()) {
  if (!/^(?:כן|מאשר|מאשר לפרסום)$/u.test(normalize(text))) return null;
  const prompt = db.prepare(`SELECT * FROM outbox
    WHERE status='sent' AND dedupe_key LIKE 'semantic-clarify:%'
    ORDER BY id DESC LIMIT 1`).get();
  if (!prompt?.sent_at) return null;
  const sentAt = new Date(prompt.sent_at);
  if (!Number.isFinite(sentAt.getTime()) || now.getTime() - sentAt.getTime() > 15 * 60 * 1000) return null;
  const match = String(prompt.body || '').match(/(?:טיוטה|סקיצה)\s+([A-Z0-9]+).*?גרסה\s+(\d+)/iu);
  if (!match) return null;
  const draft = db.prepare(`SELECT d.id,d.version,p.public_id
    FROM drafts d JOIN posts p ON p.id=d.post_id
    WHERE p.public_id=? AND d.version=? AND d.status='pending' AND p.status='awaiting_approval'`).get(
      match[1].toUpperCase(), Number(match[2]),
    );
  if (!draft) return null;
  return {
    draftId: draft.id,
    channels: ['facebook', 'instagram'],
    replyToText: `סקיצה ${draft.public_id} · גרסה ${draft.version}`,
  };
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
  return `סקיצה ${post.public_id} · גרסה ${version}\n\nפייסבוק:\n${copy.facebook}\n\nאינסטגרם:\n${copy.instagram}${mediaLine}\n\nנדרשים ארבעה אישורים על הגרסה הזו: ארז, שלומי, דורי ושנהב. כל אחד משיב ישירות לסקיצה: מאשר`;
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
  scheduleApprovalReminders(db, draftId, now);
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
  const replaceImage = event.semantic ? event.semantic.replaceImage : wantsImageReplacement(event.text);
  const resend = event.semantic ? event.semantic.resend : wantsResend(event.text);
  if (!event.media?.length && replaceImage) {
    const replacement = chooseAlternativeMedia(db, currentMedia);
    if (!replacement) {
      enqueue(db, { dedupeKey: `media-clarify:${event.id}`, body: 'לא מצאתי כרגע תמונה חלופית במקורות המאושרים. שלחו תמונה כאן או ציינו מאיזה אלבום לבחור.' }, now);
      return { type: 'clarification_required' };
    }
    media = [replacement];
  }
  let copy = event.semantic?.copy || { facebook: draft.facebook_text, instagram: draft.instagram_text };
  if (!event.semantic && wantsOrangeHeart(event.text)) {
    copy = {
      facebook: copy.facebook.replace(/[💚💙❤️❤]/gu, '🧡'),
      instagram: copy.instagram.replace(/[💚💙❤️❤]/gu, '🧡'),
    };
  }
  const unchanged = fingerprint({ ...copy, media }) === draft.fingerprint;
  if (unchanged && resend) {
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

function handleApproval(db, config, event, command, draft, now) {
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
  const person = resolveApprover(config, event);
  if (!person) {
    enqueue(db, { dedupeKey: `unauthorized-approval:${event.id}`, body: 'האישור לא נספר. המאשרים לגרסה הם ארז, שלומי, דורי ושנהב בלבד.' }, now);
    return { type: 'approval_not_counted', draftId: draft.id };
  }
  learnApproverIdentity(db, person, event, now);
  const duplicate = db.prepare('SELECT 1 FROM approvals WHERE draft_id=? AND approver_key=?').get(draft.id, person.key);
  if (duplicate) {
    enqueue(db, { dedupeKey: `duplicate-approval:${event.id}`, body: `האישור של ${person.name} כבר נספר לגרסה ${draft.version}.` }, now);
    return { type: 'approval_already_counted', draftId: draft.id, approver: person.key };
  }
  db.prepare(`INSERT OR IGNORE INTO approvals
    (draft_id,source_message_id,approver_id,channels,approved_at,approver_key) VALUES(?,?,?,?,?,?)`)
    .run(draft.id, event.id, event.senderId, JSON.stringify(['facebook', 'instagram']), nowIso(now), person.key);
  const approvedKeys = new Set(db.prepare('SELECT approver_key FROM approvals WHERE draft_id=? AND approver_key IS NOT NULL').all(draft.id).map((row) => row.approver_key));
  const missing = approvers(config).filter((candidate) => !approvedKeys.has(candidate.key));
  if (missing.length) {
    enqueue(db, { dedupeKey: `approval-progress:${event.id}`, body: `האישור של ${person.name} נקלט לגרסה ${draft.version}. ממתינים ל: ${missing.map((candidate) => candidate.name).join(', ')}.` }, now);
    return { type: 'approval_recorded', draftId: draft.id, approver: person.key, missing: missing.map((candidate) => candidate.key) };
  }
  for (const channel of ['facebook', 'instagram']) {
    db.prepare(`INSERT INTO publications(draft_id,channel,status,attempts,updated_at)
      VALUES(?,?,'queued',0,?) ON CONFLICT(draft_id,channel) DO NOTHING`)
      .run(draft.id, channel, nowIso(now));
    db.prepare(`INSERT OR IGNORE INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
      VALUES(?,'publish',?,'pending',?,?,?)`)
      .run(`publish:${draft.id}:${channel}`, JSON.stringify({ draftId: draft.id, channel }), nowIso(now), nowIso(now), nowIso(now));
  }
  db.prepare("UPDATE posts SET status='approved', updated_at=? WHERE id=?").run(nowIso(now), draft.post_id);
  enqueue(db, { dedupeKey: `approved:${event.id}`, body: `כל ארבעת האישורים נקלטו לגרסה ${draft.version}. הפוסט הוכנס לפרסום מיידי בפייסבוק ובאינסטגרם.` }, now);
  return { type: 'approved', draftId: draft.id, channels: ['facebook', 'instagram'] };
}

function handleLatestDraftQuery(db, event, now) {
  const draft = activeDrafts(db)[0];
  if (!draft) {
    enqueue(db, { dedupeKey: `latest-empty:${event.id}`, body: 'אין כרגע סקיצה פעילה שממתינה לאישור.' }, now);
    return { type: 'no_active_draft' };
  }
  const media = JSON.parse(draft.media_json || '[]');
  const copy = { facebook: draft.facebook_text, instagram: draft.instagram_text };
  enqueue(db, {
    dedupeKey: `latest:${event.id}`,
    body: `זו הסקיצה הפעילה האחרונה:\n\n${draftBody(draft, draft.version, copy, media)}`,
    mediaPath: media[0]?.path || null,
    entityType: 'draft',
    entityId: draft.id,
  }, now);
  return { type: 'latest_draft', post: draft.public_id, draftId: draft.id, version: draft.version };
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
  learnApproverIdentity(db, resolveApprover(config, event), event, now);

  const command = extractCommand(event.text);
  const semanticIntent = event.semantic?.intent || null;
  const effectiveCommand = semanticIntent === 'approve_draft'
    ? { type: 'approve', channels: event.semantic.channels?.length ? event.semantic.channels : ['facebook', 'instagram'] }
    : semanticIntent === 'cancel_draft' ? { type: 'cancel' }
      : semanticIntent === 'system_control' ? { type: event.semantic.controlAction || 'content' }
        : command;
  const latestQuery = semanticIntent ? semanticIntent === 'latest_draft' : isLatestDraftQuery(event.text);
  let draft = findDraftByReply(db, event.replyToId, event.replyToText);
  const revision = semanticIntent ? semanticIntent === 'revise_draft' : command.type === 'content' && isRevisionText(event.text);
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
  if (effectiveCommand.type === 'stop' || effectiveCommand.type === 'start') {
    if (!config.ownerId || event.senderId !== config.ownerId) {
      result = { type: 'owner_only' };
      enqueue(db, { dedupeKey: `owner-only:${event.id}`, body: 'רק אביתר רשאי לעצור או להפעיל את המערכת.' }, now);
    } else {
      const enabled = effectiveCommand.type === 'start';
      setSetting(db, 'system_enabled', enabled, now);
      result = { type: enabled ? 'started' : 'stopped' };
      enqueue(db, { dedupeKey: `system:${event.id}`, body: enabled ? 'המערכת הופעלה.' : 'המערכת נעצרה. הודעות יישמרו אך לא יעובדו עד להפעלה.' }, now);
    }
  } else if (!getSetting(db, 'system_enabled', true)) {
    result = { type: 'paused' };
  } else if (semanticIntent === 'clarification') {
    result = { type: 'clarification_required' };
    enqueue(db, { dedupeKey: `semantic-clarify:${event.id}`, body: event.semantic.question || 'לא ברור לי מה תרצו שאעשה. אפשר לחדד?' }, now);
  } else if (latestQuery) {
    result = handleLatestDraftQuery(db, event, now);
  } else if (effectiveCommand.type === 'approve') {
    result = handleApproval(db, config, event, effectiveCommand, draft, now);
  } else if (effectiveCommand.type === 'cancel') {
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
  } else if (draft && !semanticIntent) {
    const post = db.prepare('SELECT * FROM posts WHERE id=?').get(draft.post_id);
    result = createDraft(db, post, normalize(event.text) || post.brief, event.media?.length ? event.media : JSON.parse(post.media_json), now);
  } else if (!semanticIntent || semanticIntent === 'create_post') {
    const post = createPost(db, event, now);
    if (!normalize(event.text) && !(event.media || []).length) {
      result = { type: 'clarification_required' };
      enqueue(db, { dedupeKey: `empty:${event.id}`, body: 'לא התקבלו טקסט או תמונה. מה תרצו להכין?' }, now);
    } else {
      result = event.semantic?.copy
        ? createDraftVersion(db, post, event.semantic.copy, event.text, event.media || [], now)
        : createDraft(db, post, event.text, event.media || [], now);
    }
  } else {
    result = { type: 'ignored_conversation' };
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
  for (const row of db.prepare(`SELECT d.id FROM drafts d JOIN posts p ON p.id=d.post_id
    WHERE d.status='pending' AND p.status='awaiting_approval'`).all()) {
    scheduleApprovalReminders(db, row.id, now);
  }
  if (workday && minutes >= 490) {
    const syncKey = `media-sync:${date}`;
    db.prepare(`INSERT OR IGNORE INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
      VALUES(?,'media_sync','{}','pending',?,?,?)`).run(syncKey, nowIso(now), nowIso(now), nowIso(now));
  }
  if (workday && minutes >= 510) {
    const key = `morning:${date}`;
    db.prepare(`INSERT OR IGNORE INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
      VALUES(?,'morning_proposal','{}','pending',?,?,?)`).run(key, nowIso(now), nowIso(now), nowIso(now));
    const existing = db.prepare('SELECT status,attempts,updated_at FROM jobs WHERE job_key=?').get(key);
    const updatedAt = new Date(existing?.updated_at || 0).getTime();
    const failedRetryDue = existing?.status === 'failed'
      && now.getTime() - updatedAt >= MORNING_RETRY_COOLDOWN;
    const staleRunning = existing?.status === 'running'
      && now.getTime() - updatedAt >= STALE_JOB_TIMEOUT;
    if (failedRetryDue || staleRunning) {
      db.prepare(`UPDATE jobs
        SET status='pending',attempts=0,last_error=NULL,run_after=?,updated_at=?
        WHERE job_key=?`).run(nowIso(now), nowIso(now), key);
    }
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
