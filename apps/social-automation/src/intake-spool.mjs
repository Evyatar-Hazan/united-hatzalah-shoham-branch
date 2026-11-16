import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

function runHook(config, payload, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      callback();
    };
    const child = spawn(config.intakeHookRunner, [], { stdio: ['pipe', 'ignore', 'pipe'], env: process.env });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(() => reject(new Error('intake_hook_timeout')));
    }, timeoutMs);
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 4_000) stderr += chunk;
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      finish(() => reject(error));
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) finish(resolve);
      else finish(() => reject(new Error(stderr.trim() || `intake_hook_exit_${code}`)));
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

function retryPayload(spoolDir, claimedPath, originalName, payload, error, now) {
  const attempts = Number(payload._spool?.attempts || 0) + 1;
  const delayMs = Math.min(5 * 60_000, 10_000 * (2 ** Math.min(attempts - 1, 5)));
  const retry = {
    ...payload,
    _spool: {
      attempts,
      nextAttemptAt: new Date(now.getTime() + delayMs).toISOString(),
      lastError: String(error.message || error).slice(0, 500),
    },
  };
  const pendingPath = join(spoolDir, originalName);
  const temporaryPath = `${pendingPath}.tmp-${process.pid}`;
  writeFileSync(temporaryPath, JSON.stringify(retry), { mode: 0o600 });
  renameSync(temporaryPath, pendingPath);
  rmSync(claimedPath, { force: true });
}

function receiptFields(payload, now) {
  const extra = payload?.extra || {};
  return {
    sourceId: String(extra.turn_id || ''),
    chatId: String(extra.chat_id || ''),
    senderId: String(extra.sender_id || 'unknown'),
    receivedAt: String(extra.received_at || now.toISOString()),
    payloadHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
  };
}

export function recordIntakeReceipt(db, payload, now = new Date()) {
  if (!db) return null;
  const receipt = receiptFields(payload, now);
  if (!receipt.sourceId || !receipt.chatId) throw new Error('intake_receipt_missing_identity');
  db.prepare(`INSERT OR IGNORE INTO intake_receipts
    (source_id,chat_id,sender_id,payload_hash,received_at,reconciliation_status)
    VALUES(?,?,?,?,?,'received')`)
    .run(receipt.sourceId, receipt.chatId, receipt.senderId, receipt.payloadHash, receipt.receivedAt);
  return receipt;
}

export function reconcileIntakeReceipt(db, config, sourceId, now = new Date()) {
  if (!db || !sourceId) return { status: 'skipped' };
  const inbound = db.prepare('SELECT id FROM inbound_messages WHERE source_id=?').get(sourceId);
  if (inbound) {
    db.prepare(`UPDATE intake_receipts SET hook_completed_at=?,reconciled_at=?,reconciliation_status='matched'
      WHERE source_id=?`).run(now.toISOString(), now.toISOString(), sourceId);
    db.prepare("UPDATE intake_integrity_alerts SET status='resolved',resolved_at=? WHERE alert_key=? AND status='open'")
      .run(now.toISOString(), `missing-inbound:${sourceId}`);
    return { status: 'matched' };
  }
  const details = JSON.stringify({ sourceId, detectedAt: now.toISOString() });
  db.prepare(`INSERT OR IGNORE INTO intake_integrity_alerts(alert_key,kind,details_json,status,created_at)
    VALUES(?,'missing_inbound',?,'open',?)`).run(`missing-inbound:${sourceId}`, details, now.toISOString());
  if (/^\d{5,}@(lid|s\.whatsapp\.net)$/.test(String(config?.ownerId || ''))) {
    db.prepare(`INSERT OR IGNORE INTO outbox
      (dedupe_key,kind,body,target_chat_id,status,created_at)
      VALUES(?,'text',?,?,'pending',?)`)
      .run(`intake-integrity:${sourceId}`, 'התראת מערכת: התקבלה הודעה בהרמס אך היא עדיין לא נשמרה ביומן הסושיאל. המערכת תמשיך לנסות אוטומטית ולא תבצע פעולה על תוכן חסר.', config.ownerId, now.toISOString());
  }
  return { status: 'missing' };
}

export async function processIntakeSpool(config, now = new Date(), options = {}) {
  const spoolDir = config.intakeSpoolDir;
  mkdirSync(spoolDir, { recursive: true, mode: 0o700 });
  for (const orphanName of readdirSync(spoolDir).filter((name) => name.includes('.json.processing-'))) {
    const originalName = orphanName.slice(0, orphanName.indexOf('.processing-'));
    try {
      renameSync(join(spoolDir, orphanName), join(spoolDir, originalName));
    } catch {
      // A pending copy already exists or another worker recovered it first.
    }
  }
  const execute = options.runHook || ((payload) => runHook(config, payload));
  const results = [];
  for (const originalName of readdirSync(spoolDir).filter((name) => name.endsWith('.json')).sort()) {
    const pendingPath = join(spoolDir, originalName);
    const claimedPath = `${pendingPath}.processing-${process.pid}`;
    try {
      renameSync(pendingPath, claimedPath);
    } catch {
      continue;
    }
    let payload;
    try {
      payload = JSON.parse(readFileSync(claimedPath, 'utf8'));
      const nextAttemptAt = payload._spool?.nextAttemptAt ? new Date(payload._spool.nextAttemptAt) : null;
      if (nextAttemptAt && nextAttemptAt > now) {
        renameSync(claimedPath, pendingPath);
        continue;
      }
      const receipt = recordIntakeReceipt(options.db, payload, now);
      await execute(payload);
      const reconciliation = reconcileIntakeReceipt(options.db, config, receipt?.sourceId, now);
      if (reconciliation.status === 'missing') throw new Error('intake_reconciliation_missing_inbound');
      rmSync(claimedPath, { force: true });
      results.push({ file: basename(originalName), status: 'processed' });
    } catch (error) {
      retryPayload(spoolDir, claimedPath, originalName, payload || {}, error, now);
      results.push({ file: basename(originalName), status: 'retry', error: String(error.message || error) });
    }
  }
  return results;
}
