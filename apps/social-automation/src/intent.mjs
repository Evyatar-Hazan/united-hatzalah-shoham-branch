import { extractCommand, normalize } from './text.mjs';

const REVISION = /(תחליף|החלף|שנה|תקן|תוסיף|הוסף|תסיר|הסר|שלח\s+(?:אותה|אותו|את\s+הסקיצה)|תמונה|אימוג['׳]?י|לב\s+כתום|🧡)/i;
const EXPLICIT_POST = /(?:תכין|הכן|צור|תיצור|נסח|תנסח|תעלה|העלה|פרסם|לפרסום|פוסט|סקיצה)/i;
const DIRECT_BOT_ADDRESS = /(?:ג['׳]?רוויס|בוט\s+אביתר|הבוט)/i;
const PARTICIPANT_MENTION = /@\d{5,}/;
const LATEST_DRAFT_QUERY = /(?:מה(?:י|י)?|איזו|איזה|תראה|שלח).{0,24}סקיצה.{0,20}(?:אחרונה|עדכנית|פעילה|יש\s+לנו)|סקיצה.{0,20}(?:אחרונה|עדכנית|פעילה)/i;

export function isRevisionText(text) {
  return REVISION.test(normalize(text));
}

export function isLatestDraftQuery(text) {
  return LATEST_DRAFT_QUERY.test(normalize(text));
}

export function classifySocialIntent({ text = '', media = [], replyToIsOwn = false } = {}) {
  const clean = normalize(text);
  const command = extractCommand(clean);
  if (replyToIsOwn) return { action: 'handle', reason: 'reply_to_bot' };
  if (PARTICIPANT_MENTION.test(clean) && !DIRECT_BOT_ADDRESS.test(clean)) {
    return { action: 'silence', reason: 'participant_conversation' };
  }
  if (['stop', 'start', 'cancel', 'retry'].includes(command.type)) return { action: 'handle', reason: command.type };
  if (command.type === 'approve') return { action: 'silence', reason: 'approval_without_draft_reply' };
  if (isLatestDraftQuery(clean)) return { action: 'handle', reason: 'latest_draft_query' };
  if (isRevisionText(clean)) return { action: 'handle', reason: 'revision' };
  if (Array.isArray(media) && media.length) return { action: 'handle', reason: 'media_submission' };
  if (DIRECT_BOT_ADDRESS.test(clean) || EXPLICIT_POST.test(clean)) return { action: 'handle', reason: 'explicit_post_request' };
  return { action: 'silence', reason: 'ordinary_group_conversation' };
}
