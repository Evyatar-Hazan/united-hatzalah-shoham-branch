import { fingerprint, normalize } from './text.mjs';
import { fileURLToPath } from 'node:url';
import { runCodexStructured } from './semantic-router.mjs';
import { buildContentPlaybook } from './content-playbook.mjs';

const COPY_SCHEMA_PATH = fileURLToPath(new URL('./copy-decision.schema.json', import.meta.url));

const FACT_RISK = /(נפצע|פצוע|הרוג|נהרג|מטופל|תאונה|זירה|אירוע רפואי|החייאה|תינוק|ילד|קטין|תרומה|₪|שקלים|מספר נפגעים)/;
const FACT_TERMS = ['נפצע', 'פצוע', 'הרוג', 'נהרג', 'מטופל', 'תאונה', 'זירה', 'אירוע רפואי', 'החייאה', 'תינוק', 'ילד', 'קטין', 'תרומה', '₪', 'שקלים', 'מספר נפגעים'];
const LONG_DASH = /[\u2013\u2014]/u;
const GENERIC_OPENING = /^(?:איחוד הצלה|מתנדב(?:י|ות)? איחוד הצלה|אנחנו כאן|כאן בשביל|הקהילה שלנו|ביחד מצילים)/u;
const GENERIC_CLICHES = [
  /אנחנו כאן,? מוכנים למען הקהילה/u,
  /כאן בשביל הקהילה/u,
  /מרגש לראות את רוח ההתנדבות/u,
  /כל הכבוד לכל העוסקים במלאכה/u,
  /פותחים את הבוקר.*(?:תמונה|מבט)/u,
  /היום אנחנו פותחים את החלון/u,
  /מבט מקרוב על התמונה/u,
];
const WRONG_HEART = /[💚💙]/u;
const SAFE_GENERIC = new Set(['אנחנו', 'כאן', 'מוכנים', 'למען', 'הקהילה', 'קהילה', 'בשביל', 'איחוד', 'הצלה', 'איחודהצלה', 'שוהם', 'המושבים', 'תודה', 'למתנדבים', 'שלנו']);
const STOP_WORDS = new Set(['את', 'של', 'על', 'עם', 'גם', 'כל', 'זה', 'זו', 'הם', 'הן', 'כי', 'אם', 'או', 'לא', 'יש', 'אל', 'מן', 'מה', 'כדי', 'לפי']);

function tokens(value) {
  return String(value).replace(/[#\p{P}\p{S}\d_]+/gu, ' ').split(/\s+/).map((word) => word.trim()).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function assertGrounded(output, source, maxNovelRatio = 0.35) {
  const sourceTokens = new Set(tokens(source));
  const candidates = tokens(output).filter((word) => !SAFE_GENERIC.has(word));
  const novel = candidates.filter((word) => !sourceTokens.has(word) && ![...sourceTokens].some((sourceWord) => word.includes(sourceWord) || sourceWord.includes(word)));
  if (candidates.length && novel.length / candidates.length > maxNovelRatio) throw new Error('codex_copy_not_grounded');
}

function extractJson(value) {
  const text = String(value || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('codex_json_missing');
  return JSON.parse(text.slice(start, end + 1));
}

function sanitizeModelText(value) {
  return String(value || '')
    .split(/\n\s*(?:Vault Activity:|Vault Protocol Violation:)/u)[0]
    .trim();
}

function validateCopy(value, brief, visualFacts = [], imageRequired = false) {
  if (!value || typeof value.facebook !== 'string' || typeof value.instagram !== 'string') throw new Error('codex_copy_invalid');
  const facebook = sanitizeModelText(value.facebook);
  const instagram = sanitizeModelText(value.instagram);
  if (!facebook || !instagram || facebook.length > 1800 || instagram.length > 1200) {
    throw new Error(`codex_copy_out_of_bounds_facebook_${facebook.length}_instagram_${instagram.length}`);
  }
  if (LONG_DASH.test(`${facebook}\n${instagram}`)) throw new Error('codex_long_dash_forbidden');
  if (WRONG_HEART.test(`${facebook}\n${instagram}`)) throw new Error('codex_non_orange_heart_forbidden');
  const firstSentence = facebook.split(/[.!?\n]/u).map((part) => part.trim()).find(Boolean) || '';
  if (GENERIC_OPENING.test(firstSentence) || GENERIC_CLICHES.some((pattern) => pattern.test(`${facebook}\n${instagram}`))) {
    throw new Error('codex_copy_too_generic');
  }
  if (firstSentence.length > 180) throw new Error('codex_hook_too_long');
  const comparisonText = (text) => text.replace(/#[^\s#]+/gu, '').replace(/[\s\p{P}\p{S}]+/gu, '');
  const comparableFacebook = comparisonText(facebook);
  const comparableInstagram = comparisonText(instagram);
  if (comparableFacebook === comparableInstagram) throw new Error('codex_platform_copy_identical');
  const sourceDigits = new Set(String(brief).match(/\d+/g) || []);
  const outputDigits = [...new Set(`${facebook} ${instagram}`.match(/\d+/g) || [])];
  if (outputDigits.some((number) => !sourceDigits.has(number))) throw new Error('codex_invented_number');
  const groundingSource = [brief, ...visualFacts].join('\n');
  const combinedCopy = `${facebook}\n${instagram}`;
  if (imageRequired) {
    const inventedSensitiveTerm = FACT_TERMS.find((term) => combinedCopy.includes(term) && !groundingSource.includes(term));
    if (inventedSensitiveTerm) throw new Error('codex_invented_sensitive_claim');
  } else {
    assertGrounded(combinedCopy, groundingSource, 0.35);
  }
  if (imageRequired) {
    const factTokens = tokens(visualFacts.join(' '));
    const copyTokens = tokens(`${facebook} ${instagram}`);
    const overlap = factTokens.filter((fact) => copyTokens.some((word) => word.includes(fact) || fact.includes(word)));
    if (new Set(overlap).size < 2) throw new Error('codex_copy_not_image_specific');
  }
  return { facebook, instagram };
}

export async function generateCopy(config, brief, { timeoutMs = 45_000, runModel = null, imagePaths = [] } = {}) {
  const clean = normalize(brief);
  if (!clean) throw new Error('codex_copy_source_missing');
  const hasImages = imagePaths.some(Boolean);
  const playbook = buildContentPlaybook(clean);
  const basePrompt = `אתה Codex, שכבת החשיבה והעריכה של מערכת הסושיאל של איחוד הצלה שוהם והמושבים. Hermes הוא גשר תעבורה בלבד. החזר JSON בלבד עם המפתחות facebook, instagram, clarification, visualFacts. אל תמציא עובדות, שמות, מספרים, אבחנות, תוצאות, קישורים או קרדיטים. שמור על משמעות המקור. אם צורפה תמונה, כתוב ב-visualFacts בין 2 ל-5 פרטים חזותיים שנראים בה בבירור בלבד, בלי לזהות אנשים ובלי להסיק אירוע שלא הוכח. התחל את הטקסט בפרט מוחשי מהתמונה וקשר אליו את המסר. אל תכתוב פוסט גנרי על התנדבות או מתנדבים. תיאור של חפצים בתמונה אינו פוסט: הטקסט חייב לתת לקורא לפחות אחד מאלה, תובנה אנושית, מתח מסקרן, מידע שימושי או שאלה שבאמת שווה לענות עליה. אל תשתמש במילוי כמו "פותחים את הבוקר", "מבט מקרוב" או "התמונה הזאת מזכירה". חוסר בשם האירוע או בתאריך אינו סיבה לבקש הבהרה אם אפשר לבנות זווית בעלת ערך מן הנראה בלבד. כתוב clarification רק אם כל ניסוח בעל ערך עלול להטעות או אם חסר פרט שהבקשה דורשת במפורש. אין להוסיף לתוכן דו"חות מערכת, Vault Activity, הסברים על תהליך העבודה או טקסט טכני. פייסבוק ואינסטגרם צריכים להרגיש כמו שתי עריכות לאותו סיפור, לא העתקה עם האשטגים. אין להשתמש במקף ארוך. לבבות, אם משתמשים בהם, יהיו כתומים בלבד. פייסבוק עד 1,400 תווים. אינסטגרם עד 900 תווים, כולל 1-4 אימוג'ים ו-3-6 האשטגים רלוונטיים.\n\n${playbook}\n\nמקור מאושר לפוסט הנוכחי:\n${clean}`;
  let parsed;
  let visualFacts;
  let copy;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const prompt = attempt === 0 ? basePrompt : `${basePrompt}\n\nהטיוטה הקודמת נפסלה בשער האיכות בגלל: ${lastError.message}. כתוב מחדש מן היסוד. קיצור הוא חובה: פייסבוק לכל היותר 1,000 תווים ואינסטגרם לכל היותר 650 תווים. שמור על הוק קונקרטי ואל תשתמש בקלישאות.`;
    const raw = runModel
      ? await runModel(prompt)
      : await runCodexStructured(config, prompt, COPY_SCHEMA_PATH, timeoutMs, imagePaths);
    try {
      parsed = extractJson(raw);
      parsed = {
        ...parsed,
        facebook: sanitizeModelText(parsed.facebook),
        instagram: sanitizeModelText(parsed.instagram),
        clarification: sanitizeModelText(parsed.clarification),
      };
      visualFacts = Array.isArray(parsed.visualFacts)
        ? parsed.visualFacts.map((fact) => normalize(sanitizeModelText(fact))).filter(Boolean).slice(0, 5)
        : [];
      const clarificationOnly = parsed.clarification
        && !String(parsed.facebook || '').trim() && !String(parsed.instagram || '').trim();
      if (clarificationOnly) {
        return {
          facebook: null,
          instagram: null,
          clarification: parsed.clarification,
          visualFacts,
          generator: 'codex',
        };
      }
      if (hasImages && visualFacts.length < 2) throw new Error('codex_visual_context_missing');
      copy = validateCopy(parsed, clean, visualFacts, hasImages);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!copy) throw lastError;
  const clarification = typeof parsed.clarification === 'string' && parsed.clarification.trim()
    ? parsed.clarification.trim()
    : FACT_RISK.test(clean) ? 'הטקסט כולל מידע רגיש או עובדתי. יש לאמת אותו בקבוצה לפני פרסום.' : null;
  return { ...copy, clarification, visualFacts, generator: 'codex' };
}

export async function enhanceDraft(db, config, draftId, options = {}) {
  const row = db.prepare(`SELECT d.*, p.brief FROM drafts d JOIN posts p ON p.id=d.post_id WHERE d.id=?`).get(draftId);
  if (!row || row.status !== 'pending') return null;
  const copy = await generateCopy(config, row.brief, options);
  if (!copy.facebook || !copy.instagram) {
    db.prepare("UPDATE outbox SET body=? WHERE entity_type='draft' AND entity_id=? AND status='pending'")
      .run(`חסר לי פרט כדי להכין נוסח מדויק: ${copy.clarification}`, draftId);
    return { draftId, generator: copy.generator, clarification: copy.clarification, awaitingClarification: true };
  }
  const media = JSON.parse(row.media_json || '[]');
  const hash = fingerprint({ facebook: copy.facebook, instagram: copy.instagram, media });
  db.prepare('UPDATE drafts SET facebook_text=?, instagram_text=?, fingerprint=? WHERE id=?')
    .run(copy.facebook, copy.instagram, hash, draftId);
  const body = `סקיצה ${db.prepare('SELECT public_id FROM posts WHERE id=?').get(row.post_id).public_id} · גרסה ${row.version}\n\nפייסבוק:\n${copy.facebook}\n\nאינסטגרם:\n${copy.instagram}${media.length ? `\n\nמדיה: ${media.length} קבצים מצורפים` : '\n\nמדיה: טרם צורפה'}${copy.clarification ? `\n\n⚠️ שאלה לפני אישור: ${copy.clarification}` : ''}\n\nלאישור השיבו ישירות: מאשר / מאשר לפייסבוק / מאשר לאינסטגרם`;
  db.prepare("UPDATE outbox SET body=? WHERE entity_type='draft' AND entity_id=? AND status='pending'").run(body, draftId);
  return { draftId, generator: copy.generator, clarification: copy.clarification };
}
