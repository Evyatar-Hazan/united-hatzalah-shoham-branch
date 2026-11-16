import { nowIso } from './database.mjs';

function localParts(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, weekday: values.weekday, minutes: Number(values.hour) * 60 + Number(values.minute) };
}

function validPrivateTarget(value) {
  return /^\d{5,}@(lid|s\.whatsapp\.net)$/.test(String(value || ''));
}

function localDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function setAlert(db, config, key, kind, details, body, now) {
  const created = db.prepare(`INSERT OR IGNORE INTO intake_integrity_alerts
    (alert_key,kind,details_json,status,created_at) VALUES(?,?,?,'open',?)`)
    .run(key, kind, JSON.stringify(details), nowIso(now));
  if (created.changes && validPrivateTarget(config.ownerId)) {
    db.prepare(`INSERT OR IGNORE INTO outbox
      (dedupe_key,kind,body,target_chat_id,status,created_at) VALUES(?,'text',?,?,'pending',?)`)
      .run(`operational-alert:${key}`, body, config.ownerId, nowIso(now));
  }
}

function resolveAlert(db, key, now) {
  db.prepare("UPDATE intake_integrity_alerts SET status='resolved',resolved_at=? WHERE alert_key=? AND status='open'")
    .run(nowIso(now), key);
}

export function auditDailyAutomation(db, config, now = new Date()) {
  const local = localParts(now);
  const workday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].includes(local.weekday);
  if (!workday || local.minutes < 520) return { status: 'not_due', date: local.date };
  const compactDate = local.date.replaceAll('-', '');
  const morningKey = `morning:${local.date}`;
  const key = `morning-run:${local.date}`;
  const morning = db.prepare('SELECT status,last_error FROM jobs WHERE job_key=?').get(morningKey);
  const dailyPosts = db.prepare(`SELECT id,public_id,status,created_at FROM posts
    WHERE status NOT IN ('cancelled','expired')`).all().filter((post) => localDate(post.created_at) === local.date);
  const proposalCount = db.prepare('SELECT COUNT(*) AS count FROM posts WHERE public_id=?').get(`M${compactDate}`).count;
  if (!morning || !['done', 'waiting'].includes(morning.status) || proposalCount > 1 || dailyPosts.length > 1) {
    setAlert(db, config, key, 'morning_run_invariant', {
      morningStatus: morning?.status || 'missing', lastError: morning?.last_error || null,
      proposalCount, activeDailyPosts: dailyPosts.length,
    }, 'התראת מערכת: בדיקת הבוקר מצאה שמסלול הסושיאל לא השלים מצב תקין. המערכת ממשיכה לנסות אוטומטית ונדרש לבדוק את יומן העבודה.', now);
    return { status: 'alert', date: local.date, proposalCount, activeDailyPosts: dailyPosts.length };
  }
  resolveAlert(db, key, now);

  const reminderIssues = [];
  for (const draft of db.prepare(`SELECT d.id,d.created_at FROM drafts d JOIN posts p ON p.id=d.post_id
    WHERE d.status='pending' AND p.status='awaiting_approval'`).all()) {
    const created = new Date(draft.created_at).getTime();
    const group = db.prepare("SELECT run_after FROM jobs WHERE job_key=?").get(`approval-reminder:${draft.id}:group`);
    const privateFirst = db.prepare("SELECT run_after FROM jobs WHERE job_key=?").get(`approval-reminder:${draft.id}:private:1`);
    const groupDelay = new Date(group?.run_after || 0).getTime() - created;
    const privateDelay = new Date(privateFirst?.run_after || 0).getTime() - created;
    if (groupDelay < 30 * 60 * 1000 || privateDelay < 2 * 60 * 60 * 1000) reminderIssues.push(draft.id);
  }
  const reminderKey = `reminder-cadence:${local.date}`;
  if (reminderIssues.length) {
    setAlert(db, config, reminderKey, 'reminder_cadence', { draftIds: reminderIssues },
      'התראת מערכת: נמצאה סקיצה עם תזכורת מוקדמת מהכלל שנקבע. התזכורת נעצרה ונדרשת בדיקה.', now);
    for (const draftId of reminderIssues) {
      db.prepare(`UPDATE jobs SET status='cancelled',updated_at=? WHERE status='pending' AND kind LIKE 'approval_%_reminder'
        AND json_extract(payload_json,'$.draftId')=?`).run(nowIso(now), draftId);
    }
    return { status: 'alert', date: local.date, reminderIssues };
  }
  resolveAlert(db, reminderKey, now);
  return { status: 'ok', date: local.date, proposalCount, activeDailyPosts: dailyPosts.length };
}
