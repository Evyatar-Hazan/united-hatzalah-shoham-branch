import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.mjs';
import { ingestEvent, scheduleDueWork } from '../src/engine.mjs';
import { processJobs } from '../src/jobs.mjs';

const dataDir = mkdtempSync(join(tmpdir(), 'shoham-social-dry-run-'));
const config = { dataDir, dbPath: join(dataDir, 'db.sqlite'), mediaDir: join(dataDir, 'media'), groupId: 'group@g.us', ownerId: 'owner', dryRun: true, signature: 'signature', bridgeUrl: 'http://127.0.0.1:0', metaPublishCommand: '' };
let db = openDatabase(config);
const results = [];
const check = (name, condition, details = {}) => {
  if (!condition) throw new Error(`dry-run failed: ${name}`);
  results.push({ name, status: 'passed', ...details });
};

try {
  const first = ingestEvent(db, config, { id: 'd1', chatId: config.groupId, senderId: 'member-a', text: 'תרגול צוות מקומי', media: [{ path: '/tmp/example.jpg' }] });
  const duplicate = ingestEvent(db, config, { id: 'd1', chatId: config.groupId, senderId: 'member-a', text: 'תרגול צוות מקומי', media: [{ path: '/tmp/example.jpg' }] });
  check('1. יצירת סקיצה ומניעת כפילות', first.type === 'draft_created' && duplicate.type === 'duplicate');

  let draftMessage = db.prepare("SELECT * FROM outbox WHERE entity_type='draft' ORDER BY id DESC").get();
  db.prepare('UPDATE outbox SET platform_message_id=? WHERE id=?').run('draft-1', draftMessage.id);
  const approval = ingestEvent(db, config, { id: 'd2', chatId: config.groupId, senderId: 'member-b', text: 'מאשר', replyToId: 'draft-1' });
  check('2. אישור חבר קבוצה לשני הערוצים', approval.type === 'approved' && approval.channels.length === 2);

  const publicationResults = await processJobs(db, config);
  check('3. פרסום dry-run ללא פעולה חיצונית', publicationResults.length === 2 && publicationResults.every((item) => item.status === 'done') && db.prepare("SELECT COUNT(*) AS count FROM publications WHERE status='dry_run'").get().count === 2);

  db.close();
  db = openDatabase(config);
  check('4. התאוששות מהפעלה מחדש עם checkpoint', db.prepare('SELECT COUNT(*) AS count FROM inbound_messages').get().count === 2 && ingestEvent(db, config, { id: 'd1', chatId: config.groupId, senderId: 'member-a', text: 'כפול' }).type === 'duplicate');

  const morning = new Date('2026-11-08T08:30:00.000Z');
  scheduleDueWork(db, morning);
  scheduleDueWork(db, new Date(morning.getTime() + 8 * 60 * 60 * 1000));
  check('5. השלמת מועד בוקר מוחמץ פעם אחת בלבד', db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE kind='morning_proposal'").get().count === 1);

  console.log(JSON.stringify({ dryRun: 'passed', scenarios: results }, null, 2));
} finally {
  db.close();
  rmSync(dataDir, { recursive: true, force: true });
}
