import { createHash } from 'node:crypto';

export const APPROVALS = new Map([
  ['מאשר', ['facebook', 'instagram']],
  ['מאשר לפרסום', ['facebook', 'instagram']],
  ['מאשר לפייסבוק', ['facebook']],
  ['מאשר לאינסטגרם', ['instagram']],
]);

export const normalize = (value = '') => value.normalize('NFKC').trim().replace(/\s+/g, ' ');
export const fingerprint = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function appendSignature(body, signature) {
  const clean = body.trim();
  return clean.endsWith(signature) ? clean : `${clean}\n\n${signature}`;
}

export function extractCommand(text) {
  const value = normalize(text);
  if (APPROVALS.has(value)) return { type: 'approve', channels: APPROVALS.get(value) };
  if (value === 'בטל') return { type: 'cancel' };
  if (value === 'נסה שוב') return { type: 'retry' };
  if (value === 'עצור מערכת') return { type: 'stop' };
  if (value === 'הפעל מערכת') return { type: 'start' };
  return { type: 'content' };
}

export function draftFromBrief(brief) {
  const clean = normalize(brief);
  const base = clean || 'פעילות חדשה של מתנדבי איחוד הצלה סניף שוהם והמושבים.';
  return {
    facebook: `${base}\n\nאנחנו כאן, מוכנים למען הקהילה. 💚`,
    instagram: `${base}\n\nכאן בשביל הקהילה 💚\n\n#איחודהצלה #שוהם #קהילה`,
  };
}
