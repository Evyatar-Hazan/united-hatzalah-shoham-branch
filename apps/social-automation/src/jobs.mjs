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

function queueOutbox(db, key, body, now, entityType = null, entityId = null) {
  db.prepare(`INSERT OR IGNORE INTO outbox
    (dedupe_key,kind,body,entity_type,entity_id,status,created_at)
    VALUES(?,'text',?,?,?,'pending',?)`).run(key, body, entityType, entityId, nowIso(now));
}

function chooseMedia(db, now) {
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  return db.prepare(`SELECT * FROM media_usage
    WHERE last_used_at IS NULL OR last_used_at<? ORDER BY COALESCE(last_used_at,'') ASC LIMIT 1`).get(cutoff);
}

async function runMorningJob(db, config, job, now) {
  const media = chooseMedia(db, now);
  if (!media) {
    queueOutbox(db, `${job.job_key}:missing-media`, 'לא מצאתי כרגע נכס מדיה מסונכרן מהמקורות המאושרים. אמשיך לבדוק; אם תרצו פוסט מסוים, שלחו כאן תמונה וטקסט.', now);
    return { status: 'waiting', error: 'approved_media_catalog_empty' };
  }
  const publicId = `M${now.toISOString().slice(0, 10).replaceAll('-', '')}`;
  const brief = `הצעת בוקר המבוססת על נכס מאושר: ${media.media_key}`;
  const postResult = db.prepare(`INSERT INTO posts
    (public_id,status,source_kind,brief,media_json,created_at,updated_at,expires_at)
    VALUES(?,'awaiting_approval','morning',?,?,?,?,?)`)
    .run(publicId, brief, JSON.stringify([{ key: media.media_key, path: JSON.parse(media.metadata_json).path || null }]), nowIso(now), nowIso(now), new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString());
  const postId = Number(postResult.lastInsertRowid);
  const copy = await generateCopy(config, 'הבוקר אנחנו מזכירים שהמוכנות שלנו מתחילה באנשים, באימונים ובציוד שמחכה לרגע האמת.');
  const draftResult = db.prepare(`INSERT INTO drafts
    (post_id,version,facebook_text,instagram_text,media_json,fingerprint,status,created_at)
    VALUES(?,1,?,?,?,?,'pending',?)`)
    .run(postId, copy.facebook, copy.instagram, JSON.stringify([{ key: media.media_key }]), media.media_key, nowIso(now));
  const draftId = Number(draftResult.lastInsertRowid);
  queueOutbox(db, `${job.job_key}:draft`, `הצעת הבוקר ${publicId}\n\nפייסבוק:\n${copy.facebook}\n\nאינסטגרם:\n${copy.instagram}\n\nלאישור השיבו ישירות: מאשר / מאשר לפייסבוק / מאשר לאינסטגרם`, now, 'draft', draftId);
  return { status: 'done' };
}

async function runMediaSyncJob(db, config, services, job, now) {
  if (!services.browserBridge) return { status: 'failed', error: 'browser_bridge_unavailable' };
  const result = await services.browserBridge.request('syncGooglePhotos', {
    approvedAlbums: APPROVED_ALBUMS,
    excludedAlbums: EXCLUDED_ALBUMS,
  }, { timeoutMs: 180_000 });
  let imported = 0;
  for (const item of result.imported || []) {
    if (String(item.source || '').includes(EXCLUDED_ALBUMS[0])) continue;
    const prepared = await prepareMediaVariants(config, { path: item.path, source: item.source, album: item.album }, item.key);
    db.prepare(`INSERT INTO media_usage(media_key,source,metadata_json)
      VALUES(?,?,?) ON CONFLICT(media_key) DO UPDATE SET source=excluded.source, metadata_json=excluded.metadata_json`)
      .run(item.key, item.source || `google-photos:${item.album}`, JSON.stringify(prepared));
    imported += 1;
  }
  return { status: imported ? 'done' : 'failed', error: imported ? null : 'no_approved_media_imported' };
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
    }, { timeoutMs: 120_000 });
  } else {
    return { status: 'failed', error: 'meta_publisher_unavailable' };
  }
  if (!receipt.url) throw new Error('publisher did not return a verified URL');
  db.prepare("UPDATE publications SET status='published', attempts=attempts+1, external_id=?, url=?, last_error=NULL, updated_at=? WHERE id=?")
    .run(receipt.id || null, receipt.url, nowIso(now), publication.id);
  queueOutbox(db, `${job.job_key}:published`, `הפרסום ב־${payload.channel} הושלם ואומת:\n${receipt.url}`, now);
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
      if (job.kind === 'morning_proposal') result = await runMorningJob(db, config, job, now);
      else if (job.kind === 'media_sync') result = await runMediaSyncJob(db, config, services, job, now);
      else if (job.kind === 'weekly_report') result = runWeeklyReport(db, job, now);
      else if (job.kind === 'publish') result = await runPublishJob(db, config, services, job, payload, now);
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
