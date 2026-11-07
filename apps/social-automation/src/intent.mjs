import { normalize } from './text.mjs';

const REVISION = /(תחליף|החלף|שנה|תקן|תוסיף|הוסף|תסיר|הסר|שלח\s+(?:אותה|אותו|את\s+הסקיצה)|תמונה|אימוג['׳]?י|לב\s+כתום|🧡)/i;
const LATEST_DRAFT_QUERY = /(?:מה(?:י|י)?|איזו|איזה|תראה|שלח).{0,24}סקיצה.{0,20}(?:אחרונה|עדכנית|פעילה|יש\s+לנו)|סקיצה.{0,20}(?:אחרונה|עדכנית|פעילה)/i;

export function isRevisionText(text) {
  return REVISION.test(normalize(text));
}

export function isLatestDraftQuery(text) {
  return LATEST_DRAFT_QUERY.test(normalize(text));
}
