import { spawn } from 'node:child_process';
import { nowIso } from './database.mjs';
import { generateCopy } from './content-generator.mjs';
import { prepareMediaVariants } from './media-processor.mjs';

export const APPROVED_ALBUMS = [
  'תמונות כלליות סניף שוהם והמושבים',
  'קורס חובשים מס2 שתיים שוהם',
  'טקס סיום קורס חובשים 2 שוהם 2026',
  'תמונות מזירות אירוע סניף שוהם',
  'תמונות לפרסום איחוד שוהם והמושבים',
  'קורס חובשים מס2 שוהם',
  'תמונות קורס 444 שוהם',
  'ועידת ראשי סניפים 8.1.25 👍',
];
export const EXCLUDED_ALBUMS = ['רגעים של אור (יומיים אחרונים במחנה חנוכה)'];
const REMINDER_DELAY = 30 * 60 * 1000;

function approvers(config) {
  return config.approvers || [
    { key: 'erez', name: 'ארז' },
  ];
}

function approvalInstruction(config) {
  const roster = approvers(config);
  const names = roster.map((person) => person.name).join(', ');
  return roster.length === 1
    ? `נדרש אישור של ${names}. יש להשיב ישירות לסקיצה: מאשר`
    : `נדרש אישור אחד על הגרסה הזו מאחד המאשרים: ${names}. יש להשיב ישירות לסקיצה: מאשר`;
}

function runCommand(command, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/zsh', ['-lc', command], { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `command exited ${code}`)));
    child.stdin.end(JSON.stringify(input));
  });
}

function queueOutbox(db, key, body, now, entityType = null, entityId = null, mediaPath = null, targetChatId = null) {
  db.prepare(`INSERT OR IGNORE INTO outbox
    (dedupe_key,kind,body,media_path,entity_type,entity_id,target_chat_id,status,created_at)
    VALUES(?,?,?,?,?,?,?,'pending',?)`).run(key, mediaPath ? 'media' : 'text', body, mediaPath, entityType, entityId, targetChatId, nowIso(now));
}

function chooseMedia(db, now) {
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  return db.prepare(`SELECT * FROM media_usage
    WHERE last_used_at IS NULL OR last_used_at<? ORDER BY RANDOM() LIMIT 1`).get(cutoff);
}

function scheduleApprovalReminders(db, draftId, now) {
  const groupAt = new Date(now.getTime() + REMINDER_DELAY);
  const privateAt = groupAt;
  db.prepare(`INSERT OR IGNORE INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
    VALUES(?,'approval_group_reminder',?,'pending',?,?,?)`)
    .run(`approval-reminder:${draftId}:group`, JSON.stringify({ draftId }), nowIso(groupAt), nowIso(now), nowIso(now));
  db.prepare(`INSERT OR IGNORE INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
    VALUES(?,'approval_private_reminder',?,'pending',?,?,?)`)
    .run(`approval-reminder:${draftId}:private:1`, JSON.stringify({ draftId, round: 1 }), nowIso(privateAt), nowIso(now), nowIso(now));
}

function approvalState(db, config, draftId) {
  const draft = db.prepare(`SELECT d.*,p.public_id,p.status AS post_status FROM drafts d
    JOIN posts p ON p.id=d.post_id WHERE d.id=?`).get(draftId);
  if (!draft || draft.status !== 'pending' || draft.post_status !== 'awaiting_approval') return { active: false, draft, missing: [] };
  const approved = new Set(db.prepare('SELECT approver_key FROM approvals WHERE draft_id=? AND approver_key IS NOT NULL').all(draftId).map((row) => row.approver_key));
  if (approved.size > 0) return { active: false, draft, missing: [] };
  return { active: true, draft, missing: approvers(config).filter((person) => !approved.has(person.key)) };
}

function runGroupApprovalReminder(db, config, payload, job, now) {
  const state = approvalState(db, config, payload.draftId);
  if (!state.active || !state.missing.length) return { status: 'done' };
  queueOutbox(db, `${job.job_key}:message`, `תזכורת לאישור סקיצה ${state.draft.public_id}, גרסה ${state.draft.version}. ממתינים ל: ${state.missing.map((person) => person.name).join(', ')}. נא להשיב ישירות לסקיצה: מאשר`, now);
  return { status: 'done' };
}

function reminderMediaPath(draft) {
  try {
    const media = JSON.parse(draft.media_json || '[]');
    const first = media[0] || {};
    return first.path || first.originalPath || first.variants?.facebook || first.variants?.instagram || null;
  } catch {
    return null;
  }
}

function privateReminderBody(person, draft) {
  return `היי ${person.name}, הפוסט הבא עדיין ממתין לאישור שלך:\n\nסקיצה ${draft.public_id}, גרסה ${draft.version}\n\nפייסבוק:\n${draft.facebook_text}\n\nאינסטגרם:\n${draft.instagram_text}\n\nאפשר להשיב לי כאן בפרטי: מאשר`;
}

function retireOlderAwaitingPosts(db, publishedDraft, now) {
  const publishedPost = db.prepare('SELECT id,created_at FROM posts WHERE id=?').get(publishedDraft.post_id);
  if (!publishedPost) return 0;
  const stalePosts = db.prepare(`SELECT id FROM posts
    WHERE status='awaiting_approval' AND id!=? AND created_at<=?`).all(publishedPost.id, publishedPost.created_at);
  let retired = 0;
  for (const post of stalePosts) {
    const draftIds = db.prepare("SELECT id FROM drafts WHERE post_id=? AND status='pending'").all(post.id).map((row) => row.id);
    db.prepare("UPDATE drafts SET status='superseded' WHERE post_id=? AND status='pending'").run(post.id);
    db.prepare("UPDATE posts SET status='cancelled',updated_at=? WHERE id=? AND status='awaiting_approval'").run(nowIso(now), post.id);
    for (const draftId of draftIds) {
      db.prepare('DELETE FROM approvals WHERE draft_id=?').run(draftId);
      db.prepare("DELETE FROM publications WHERE draft_id=? AND status!='published'").run(draftId);
      for (const job of db.prepare(`SELECT id,payload_json FROM jobs
        WHERE kind IN ('publish','approval_group_reminder','approval_private_reminder')
        AND status IN ('pending','failed','running')`).all()) {
        try {
          if (Number(JSON.parse(job.payload_json).draftId) === Number(draftId)) db.prepare('DELETE FROM jobs WHERE id=?').run(job.id);
        } catch {
          // Unrelated malformed jobs stay on their normal failure path.
        }
      }
      db.prepare(`DELETE FROM outbox WHERE status='pending' AND (
        (entity_type='draft' AND entity_id=?) OR dedupe_key LIKE ?
      )`).run(draftId, `approval-reminder:${draftId}:%`);
    }
    retired += 1;
  }
  return retired;
}

function runPrivateApprovalReminder(db, config, payload, job, now) {
  const state = approvalState(db, config, payload.draftId);
  if (!state.active || !state.missing.length) return { status: 'done' };
  for (const person of state.missing) {
    const identity = db.prepare('SELECT sender_id FROM approver_identities WHERE approver_key=?').get(person.key);
    if (!/^\d{5,}@(lid|s\.whatsapp\.net)$/.test(String(identity?.sender_id || ''))) continue;
    queueOutbox(
      db,
      `${job.job_key}:${person.key}`,
      privateReminderBody(person, state.draft),
      now,
      'draft',
      state.draft.id,
      reminderMediaPath(state.draft),
      identity.sender_id,
    );
  }
  const nextRound = Number(payload.round || 1) + 1;
  const nextAt = new Date(now.getTime() + REMINDER_DELAY);
  db.prepare(`INSERT OR IGNORE INTO jobs(job_key,kind,payload_json,status,run_after,created_at,updated_at)
    VALUES(?,'approval_private_reminder',?,'pending',?,?,?)`)
    .run(`approval-reminder:${payload.draftId}:private:${nextRound}`, JSON.stringify({ draftId: payload.draftId, round: nextRound }), nowIso(nextAt), nowIso(now), nowIso(now));
  return { status: 'done' };
}

async function runMorningJob(db, config, services, job, now) {
  const media = chooseMedia(db, now);
  if (!media) {
    queueOutbox(db, `${job.job_key}:missing-media`, 'לא מצאתי כרגע נכס מדיה מסונכרן מהמקורות המאושרים. אמשיך לבדוק; אם תרצו פוסט מסוים, שלחו כאן תמונה וטקסט.', now);
    return { status: 'waiting', error: 'approved_media_catalog_empty' };
  }
  const jobDate = String(job.job_key).match(/^morning:(\d{4}-\d{2}-\d{2})$/)?.[1] || now.toISOString().slice(0, 10);
  const publicId = `M${jobDate.replaceAll('-', '')}`;
  const brief = `הצעת בוקר המבוססת על נכס מאושר: ${media.media_key}`;
  const existing = db.prepare(`SELECT p.id AS post_id,d.id AS draft_id,d.facebook_text,d.instagram_text,d.media_json
    FROM posts p LEFT JOIN drafts d ON d.post_id=p.id AND d.status='pending'
    WHERE p.public_id=? ORDER BY d.version DESC LIMIT 1`).get(publicId);
  if (existing?.draft_id) {
    const draftMedia = JSON.parse(existing.media_json || '[]');
    queueOutbox(db, `${job.job_key}:draft`, `הצעת הבוקר ${publicId}\n\nפייסבוק:\n${existing.facebook_text}\n\nאינסטגרם:\n${existing.instagram_text}\n\n${approvalInstruction(config)}`, now, 'draft', existing.draft_id, draftMedia[0]?.path || null);
    scheduleApprovalReminders(db, existing.draft_id, now);
    return { status: 'done' };
  }
  const generate = services.generateCopy || generateCopy;
  const metadata = JSON.parse(media.metadata_json || '{}');
  const mediaItem = { key: media.media_key, ...metadata, source: metadata.source || media.source };
  const copy = await generate(
    config,
    'הכן הצעת בוקר חיה שמבוססת על מה שנראה בתמונה המאושרת. התייחס רק לפרטים חזותיים ברורים, בלי להמציא את שם האירוע, מועד, אנשים או תוצאה. המסר צריך להיות קשור ישירות לתמונה ולא להיות פוסט כללי על התנדבות.',
    { timeoutMs: 120_000, imagePaths: mediaItem.path ? [mediaItem.path] : [] },
  );
  const mediaJson = JSON.stringify([mediaItem]);
  let postId = existing?.post_id || null;
  let draftId;
  db.exec('BEGIN IMMEDIATE');
  try {
    if (postId) {
      db.prepare(`UPDATE posts SET status='awaiting_approval',brief=?,media_json=?,updated_at=?,expires_at=? WHERE id=?`)
        .run(brief, mediaJson, nowIso(now), new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(), postId);
    } else {
      const postResult = db.prepare(`INSERT INTO posts
        (public_id,status,source_kind,brief,media_json,created_at,updated_at,expires_at)
        VALUES(?,'awaiting_approval','morning',?,?,?,?,?)`)
        .run(publicId, brief, mediaJson, nowIso(now), nowIso(now), new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString());
      postId = Number(postResult.lastInsertRowid);
    }
    const draftResult = db.prepare(`INSERT INTO drafts
      (post_id,version,facebook_text,instagram_text,media_json,fingerprint,status,created_at)
      VALUES(?,1,?,?,?,?,'pending',?)`)
      .run(postId, copy.facebook, copy.instagram, mediaJson, media.media_key, nowIso(now));
    draftId = Number(draftResult.lastInsertRowid);
    queueOutbox(db, `${job.job_key}:draft`, `הצעת הבוקר ${publicId}\n\nפייסבוק:\n${copy.facebook}\n\nאינסטגרם:\n${copy.instagram}\n\n${approvalInstruction(config)}`, now, 'draft', draftId, mediaItem.path || null);
    scheduleApprovalReminders(db, draftId, now);
    db.prepare('UPDATE media_usage SET last_used_at=?,post_id=? WHERE media_key=?')
      .run(nowIso(now), postId, media.media_key);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { status: 'done' };
}

async function runMediaSyncJob(db, config, services, job, now) {
  if (!services.browserBridge) return { status: 'failed', error: 'browser_bridge_unavailable' };
  const results = [];
  for (let offset = 0; offset < APPROVED_ALBUMS.length; offset += 4) {
    results.push(await services.browserBridge.request('syncGooglePhotos', {
      approvedAlbums: APPROVED_ALBUMS.slice(offset, offset + 4),
      excludedAlbums: EXCLUDED_ALBUMS,
    }, { timeoutMs: 180_000 }));
  }
  let imported = 0;
  for (const item of results.flatMap((result) => result.imported || [])) {
    if (String(item.source || '').includes(EXCLUDED_ALBUMS[0])) continue;
    const prepared = await prepareMediaVariants(config, { path: item.path, source: item.source, album: item.album }, item.key);
    db.prepare(`INSERT INTO media_usage(media_key,source,metadata_json)
      VALUES(?,?,?) ON CONFLICT(media_key) DO UPDATE SET source=excluded.source, metadata_json=excluded.metadata_json`)
      .run(item.key, item.source || `google-photos:${item.album}`, JSON.stringify(prepared));
    imported += 1;
  }
  const available = db.prepare('SELECT COUNT(*) AS count FROM media_usage').get().count;
  return { status: imported || available ? 'done' : 'failed', error: imported || available ? null : 'no_approved_media_imported' };
}

function runWeeklyReport(db, job, now) {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const published = db.prepare("SELECT COUNT(*) AS count FROM publications WHERE status='published' AND updated_at>=?").get(since).count;
  const pending = db.prepare("SELECT COUNT(*) AS count FROM posts WHERE status='awaiting_approval'").get().count;
  const failures = db.prepare("SELECT COUNT(*) AS count FROM publications WHERE status='failed' AND updated_at>=?").get(since).count;
  queueOutbox(db, `${job.job_key}:report`, `דוח שבועי קצר\n• פרסומים שהושלמו: ${published}\n• סקיצות שממתינות לאישור: ${pending}\n• כשלים פתוחים מהשבוע: ${failures}\n• המערכת שמרה checkpoint ולא תפרסם פריט פעמיים.`, now);
  return { status: 'done' };
}

async function runPublishJob(db, config, services, job, payload, now) {
  const publication = db.prepare('SELECT * FROM publications WHERE draft_id=? AND channel=?').get(payload.draftId, payload.channel);
  if (!publication || publication.status === 'published') return { status: 'done' };
  const draft = db.prepare('SELECT * FROM drafts WHERE id=?').get(payload.draftId);
  if (!draft) return { status: 'failed', error: 'draft_missing' };
  if (config.metaDryRun ?? config.dryRun) {
    db.prepare("UPDATE publications SET status='dry_run', attempts=attempts+1, updated_at=? WHERE id=?").run(nowIso(now), publication.id);
    queueOutbox(db, `${job.job_key}:dry-run`, `בדיקת dry-run הושלמה עבור ${payload.channel}. לא בוצע פרסום חיצוני.`, now);
    return { status: 'done' };
  }
  const text = payload.channel === 'facebook' ? draft.facebook_text : draft.instagram_text;
  let receipt;
  if (config.metaPublishCommand) {
    const output = await runCommand(config.metaPublishCommand, { channel: payload.channel, text, media: JSON.parse(draft.media_json), draftId: draft.id });
    receipt = output ? JSON.parse(output) : {};
  } else if (services.browserBridge) {
    receipt = await services.browserBridge.request('publishMeta', {
      channel: payload.channel,
      text,
      media: JSON.parse(draft.media_json),
      draftId: draft.id,
      businessId: config.metaBusinessId,
      pageId: config.metaPageId,
      approvalFingerprint: draft.fingerprint,
      verifyExisting: job.attempts > 0,
    }, { timeoutMs: 120_000 });
  } else {
    return { status: 'failed', error: 'meta_publisher_unavailable' };
  }
  if (!receipt.url) throw new Error('publisher did not return a verified URL');
  db.prepare("UPDATE publications SET status='published', attempts=attempts+1, external_id=?, url=?, last_error=NULL, updated_at=? WHERE id=?")
    .run(receipt.id || null, receipt.url, nowIso(now), publication.id);
  const incomplete = db.prepare("SELECT COUNT(*) AS count FROM publications WHERE draft_id=? AND status!='published'").get(draft.id).count;
  if (!incomplete) {
    db.prepare("UPDATE drafts SET status='published' WHERE id=?").run(draft.id);
    db.prepare("UPDATE posts SET status='published',updated_at=? WHERE id=?").run(nowIso(now), draft.post_id);
    retireOlderAwaitingPosts(db, draft, now);
    const links = Object.fromEntries(db.prepare("SELECT channel,url FROM publications WHERE draft_id=? AND status='published'").all(draft.id)
      .map((row) => [row.channel, row.url]));
    queueOutbox(db, `publish:${draft.id}:volunteer-share`, `הודעה מוכנה להעברה לקבוצת המתנדבים:\n\nחברים יקרים 🧡\n\nהפוסט החדש שלנו עלה עכשיו בפייסבוק ובאינסטגרם. נשמח שתיכנסו לפרגן בלייק, בתגובה ואם מתאים גם בשיתוף. כל מעורבות עוזרת לנו להגיע לעוד אנשים 🙏\n\nפייסבוק:\n${links.facebook}\n\nאינסטגרם:\n${links.instagram}\n\nתודה אלופים!`, now);
  }
  return { status: 'done' };
}

export async function processJobs(db, config, now = new Date(), limit = 20, services = {}) {
  const jobs = db.prepare("SELECT * FROM jobs WHERE status IN ('pending','failed') AND run_after<=? AND attempts<3 ORDER BY id LIMIT ?").all(nowIso(now), limit);
  const results = [];
  for (const job of jobs) {
    db.prepare("UPDATE jobs SET status='running', attempts=attempts+1, updated_at=? WHERE id=?").run(nowIso(now), job.id);
    try {
      const payload = JSON.parse(job.payload_json);
      let result;
      if (job.kind === 'morning_proposal') result = await runMorningJob(db, config, services, job, now);
      else if (job.kind === 'media_sync') result = await runMediaSyncJob(db, config, services, job, now);
      else if (job.kind === 'weekly_report') result = runWeeklyReport(db, job, now);
      else if (job.kind === 'publish') result = await runPublishJob(db, config, services, job, payload, now);
      else if (job.kind === 'approval_group_reminder') result = runGroupApprovalReminder(db, config, payload, job, now);
      else if (job.kind === 'approval_private_reminder') result = runPrivateApprovalReminder(db, config, payload, job, now);
      else result = { status: 'failed', error: 'unknown_job_kind' };
      db.prepare('UPDATE jobs SET status=?, last_error=?, updated_at=? WHERE id=?')
        .run(result.status, result.error || null, nowIso(now), job.id);
      results.push({ id: job.id, kind: job.kind, ...result });
    } catch (error) {
      const status = job.attempts + 1 >= 3 ? 'failed' : 'pending';
      const retryAt = new Date(now.getTime() + 2 ** job.attempts * 60_000).toISOString();
      db.prepare('UPDATE jobs SET status=?, last_error=?, run_after=?, updated_at=? WHERE id=?')
        .run(status, String(error.message || error), retryAt, nowIso(now), job.id);
      results.push({ id: job.id, kind: job.kind, status, error: String(error.message || error) });
    }
  }
  return results;
}
