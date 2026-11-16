import { readFileSync } from 'node:fs';

const library = JSON.parse(readFileSync(new URL('../content/reference-posts.json', import.meta.url), 'utf8'));

const FALLBACK_IDS = [
  'הסברה והיכרות:1',
  'האנשים מאחורי האפוד:3',
  'עשייה מהשטח:1',
  'ערך לציבור:1',
];

const STOP_WORDS = new Set(['של', 'על', 'עם', 'גם', 'כל', 'זה', 'זו', 'כדי', 'לפי', 'כאן', 'פוסט', 'תמונה']);

function terms(value) {
  return new Set(String(value || '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word)));
}

export function selectReferencePosts(brief, limit = 4) {
  const query = terms(brief);
  const ranked = library.posts.map((post) => {
    const title = terms(post.title);
    const text = terms(`${post.category} ${post.text}`);
    let score = 0;
    for (const word of query) {
      if (title.has(word)) score += 4;
      if (text.has(word)) score += 1;
    }
    return { post, score };
  }).sort((a, b) => b.score - a.score || a.post.id.localeCompare(b.post.id, 'he'));
  const matching = ranked.filter((item) => item.score > 0).slice(0, limit).map((item) => item.post);
  if (matching.length >= Math.min(2, limit)) return matching;
  const fallback = FALLBACK_IDS.map((id) => library.posts.find((post) => post.id === id)).filter(Boolean);
  return [...matching, ...fallback.filter((post) => !matching.some((item) => item.id === post.id))].slice(0, limit);
}

export function buildContentPlaybook(brief) {
  const examples = selectReferencePosts(brief).map((post) =>
    `קטגוריה: ${post.category}\nהוק: ${post.title}\nדוגמה: ${post.text}`,
  ).join('\n\n');
  return `אסטרטגיית התוכן המאושרת לעבודה:
- העמוד הוא חלון פתוח לעשייה המקומית: אנשים, מוכנות, ידע שימושי, קהילה ושקיפות.
- התרומה היא חלק מהסיפור, לא כל הסיפור.
- תמהיל היעד: 40% עשייה ואנשים, 25% ערך והסברה, 20% קהילה וחיבורים, 15% בקשות תמיכה.
- אין להמציא אירוע, אדם, תוצאה, צורך, מספר או פרט רפואי. פרטיות קודמת לחשיפה.

שפת המותג:
- פותחים ברגע, פרט, שאלה אמיתית או ניגוד שמייצרים סקרנות. לא פותחים בסיסמה ארגונית.
- עוברים מן הפרט למשמעות. נותנים לקורא סיבה להמשיך אחרי השורה הראשונה.
- משתמשים בעברית מדוברת, מדויקת וחמה. משפטים באורכים משתנים. בלי הצהרות מנופחות ובלי רשימות של ערכים מופשטים.
- קריאה לפעולה חייבת לצמוח מהסיפור. לא מוסיפים שאלה מלאכותית רק כדי לקבל תגובות.
- אם לא ידוע מתי או מדוע צולמה התמונה, אפשר לבחור זווית בטוחה שעוסקת רק במה שנראה בה ובמשמעות הכללית שלו. שואלים בקבוצה רק כאשר כל ניסוח סביר עלול להטעות, או כשהבקשה מחייבת פרט עובדתי שאינו נראה.
- לא משתמשים במקפים ארוכים.

תבנית עריכה מומלצת:
1. הוק קונקרטי שמחזיק בפני עצמו.
2. שניים עד ארבעה משפטים שמפתחים רגע, מתח או תובנה.
3. חיבור ברור לסניף שוהם והמושבים.
4. סיום אנושי או פעולה אחת מדויקת.

דוגמאות השראה מתוך מאגר 80 הטיוטות. אין להעתיק אותן אוטומטית ואין להתייחס אליהן כאל עובדות על התמונה הנוכחית:

${examples}`;
}

export function referenceLibraryStats() {
  return {
    count: library.posts.length,
    categories: [...new Set(library.posts.map((post) => post.category))],
    source: library.source,
  };
}
