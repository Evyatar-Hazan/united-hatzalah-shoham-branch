import { fingerprint, normalize } from './text.mjs';
import { fileURLToPath } from 'node:url';
import { runCodexStructured } from './semantic-router.mjs';

const COPY_SCHEMA_PATH = fileURLToPath(new URL('./copy-decision.schema.json', import.meta.url));

const FACT_RISK = /(נפצע|פצוע|הרוג|נהרג|מטופל|תאונה|זירה|אירוע רפואי|החייאה|תינוק|ילד|קטין|תרומה|₪|שקלים|מספר נפגעים)/;
const SAFE_GENERIC = new Set(['אנחנו', 'כאן', 'מוכנים', 'למען', 'הקהילה', 'קהילה', 'בשביל', 'איחוד', 'הצלה', 'איחודהצלה', 'שוהם', 'המושבים', 'תודה', 'למתנדבים', 'שלנו']);
const STOP_WORDS = new Set(['את', 'של', 'על', 'עם', 'גם', 'כל', 'זה', 'זו', 'הם', 'הן', 'כי', 'אם', 'או', 'לא', 'יש', 'אל', 'מן', 'מה', 'כדי', 'לפי']);

function tokens(value) {
  return String(value).replace(/[#\p{P}\p{S}\d_]+/gu, ' ').split(/\s+/).map((word) => word.trim()).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function assertGrounded(output, source) {
  const sourceTokens = new Set(tokens(source));
  const candidates = tokens(output).filter((word) => !SAFE_GENERIC.has(word));
  const novel = candidates.filter((word) => !sourceTokens.has(word) && ![...sourceTokens].some((sourceWord) => word.includes(sourceWord) || sourceWord.includes(word)));
  if (candidates.length && novel.length / candidates.length > 0.35) throw new Error('codex_copy_not_grounded');
}

function extractJson(value) {
  const text = String(value || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('codex_json_missing');
  return JSON.parse(text.slice(start, end + 1));
}

function validateCopy(value, brief) {
  if (!value || typeof value.facebook !== 'string' || typeof value.instagram !== 'string') throw new Error('codex_copy_invalid');
  const facebook = value.facebook.trim();
  const instagram = value.instagram.trim();
  if (!facebook || !instagram || facebook.length > 1800 || instagram.length > 1200) throw new Error('codex_copy_out_of_bounds');
  const sourceDigits = new Set(String(brief).match(/\d+/g) || []);
  const outputDigits = [...new Set(`${facebook} ${instagram}`.match(/\d+/g) || [])];
  if (outputDigits.some((number) => !sourceDigits.has(number))) throw new Error('codex_invented_number');
  assertGrounded(`${facebook}\n${instagram}`, brief);
  return { facebook, instagram };
}

export async function generateCopy(config, brief, { timeoutMs = 45_000, runModel = null } = {}) {
  const clean = normalize(brief);
  if (!clean) throw new Error('codex_copy_source_missing');
  const prompt = `אתה Codex, שכבת החשיבה והעריכה של מערכת הסושיאל של איחוד הצלה שוהם והמושבים. Hermes הוא גשר תעבורה בלבד. החזר JSON בלבד עם המפתחות facebook, instagram, clarification. אל תמציא עובדות, שמות, מספרים, אבחנות, תוצאות, קישורים או קרדיטים. שמור על משמעות המקור. אם חסר פרט מהותי או שהמקור כולל מידע רגיש, כתוב שאלה קצרה ב-clarification ואל תשלים את הפרט. נסח בעברית חמה, אנושית, קהילתית ומקצועית, בלי סנסציוניות ובלי מראה של טקסט AI. פייסבוק עד 180 מילים. אינסטגרם עד 120 מילים, 1-4 אימוג'ים ו-3-6 האשטגים רלוונטיים.\nמקור מאושר:\n${clean}`;
  const raw = runModel
    ? await runModel(prompt)
    : await runCodexStructured(config, prompt, COPY_SCHEMA_PATH, timeoutMs);
  const parsed = extractJson(raw);
  const copy = validateCopy(parsed, clean);
  const clarification = typeof parsed.clarification === 'string' && parsed.clarification.trim()
    ? parsed.clarification.trim()
    : FACT_RISK.test(clean) ? 'הטקסט כולל מידע רגיש או עובדתי. יש לאמת אותו בקבוצה לפני פרסום.' : null;
  return { ...copy, clarification, generator: 'codex' };
}

export async function enhanceDraft(db, config, draftId, options = {}) {
  const row = db.prepare(`SELECT d.*, p.brief FROM drafts d JOIN posts p ON p.id=d.post_id WHERE d.id=?`).get(draftId);
  if (!row || row.status !== 'pending') return null;
  const copy = await generateCopy(config, row.brief, options);
  const media = JSON.parse(row.media_json || '[]');
  const hash = fingerprint({ facebook: copy.facebook, instagram: copy.instagram, media });
  db.prepare('UPDATE drafts SET facebook_text=?, instagram_text=?, fingerprint=? WHERE id=?')
    .run(copy.facebook, copy.instagram, hash, draftId);
  const body = `סקיצה ${db.prepare('SELECT public_id FROM posts WHERE id=?').get(row.post_id).public_id} · גרסה ${row.version}\n\nפייסבוק:\n${copy.facebook}\n\nאינסטגרם:\n${copy.instagram}${media.length ? `\n\nמדיה: ${media.length} קבצים מצורפים` : '\n\nמדיה: טרם צורפה'}${copy.clarification ? `\n\n⚠️ שאלה לפני אישור: ${copy.clarification}` : ''}\n\nלאישור השיבו ישירות: מאשר / מאשר לפייסבוק / מאשר לאינסטגרם`;
  db.prepare("UPDATE outbox SET body=? WHERE entity_type='draft' AND entity_id=? AND status='pending'").run(body, draftId);
  return { draftId, generator: copy.generator, clarification: copy.clarification };
}
