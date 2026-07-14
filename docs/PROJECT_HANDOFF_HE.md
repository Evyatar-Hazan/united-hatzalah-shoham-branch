# סניף איחוד הצלה שוהם והמושבים

## מצב נוכחי

האתר חי בפרודקשן על Cloudflare Pages ונטען גם דרך תת הדומיין:

- `https://hatzalah-shoham.evyatarhazan.com`
- דיפלוי Pages מאומת: `https://5f246eea.united-hatzalah-shoham-branch.pages.dev`

הפרויקט רץ ללא שרת בתשלום:

- Frontend: Cloudflare Pages
- API: Cloudflare Pages Functions
- Database: Cloudflare D1

## חזון מוצר

לבנות נכס דיגיטלי אמין, קהילתי ומכובד עבור סניף שוהם והמושבים של איחוד הצלה, שמשרת שלוש מטרות:

1. להציג את פעילות הסניף והאנשים שמפעילים אותו.
2. לחזק אמון ציבורי, מעורבות קהילתית ותרומות.
3. לאפשר ניהול תוכן ועדכונים בלי תלות במפתח בכל שינוי קטן.

## קהלי יעד

- תושבי שוהם והמושבים
- תורמים ושותפים פוטנציאליים
- מתנדבים פוטנציאליים
- הנהלת הסניף ואחראי הדיגיטל

## מה יש היום באתר

### צד ציבורי

- Hero מעודכן עם תמונת פעילות אמיתית מהסניף
- אזור "על הסניף"
- סטטיסטיקות פעילות
- אזור "מאחורי הפעילות"
- גלריה עם תמונות אמיתיות מהאלבום שנשלח
- אזור תורמים וחסויות
- טופס תרומה
- טופס יצירת קשר
- Footer עם ניווט פנימי תקין

### צד ניהולי

- התחברות מנהלים
- פאנל ניהול
- CRUD לתוכן בסיסי דרך API
- ניהול גלריה, סיפורים, תורמים, סטטיסטיקות ופרטי קשר

## מקור המדיה

תמונות הסניף נשלפו מתוך האלבום:

- `https://photos.app.goo.gl/XhE5sR5ZhvqAKH7d7`

המדיה הוטמעה כקבצים סטטיים בתוך הפרויקט תחת:

- `/Users/evyatarhazan/Desktop/project/united-hatzalah-shoham-branch/apps/client/public/images/shoham`

## אפיון טכני

### מבנה ריפו

- `apps/client` - React + Vite + TypeScript
- `apps/server` - Express + Prisma, נשאר כריפו תואם פיתוח אך לא משמש את פרודקשן Cloudflare
- `functions/api/[[path]].js` - ה־API האמיתי של פרודקשן
- `migrations/` - מיגרציות D1 ל־Cloudflare

### תצורת פרודקשן

- Cloudflare Pages מגיש את ה־frontend
- Pages Functions מגיש את ה־API תחת `/api/*`
- D1 מחזיק נתוני גלריה, סיפורים, תורמים, תרומות, אנשי קשר ומנהלים

### דיפלוי

#### ידני

```bash
npm run d1:migrate:remote
npm run pages:deploy
```

#### אוטומטי

קיים workflow:

- `.github/workflows/deploy-cloudflare.yml`

הוא נבנה על `push` ל־`main` ומבצע:

1. `npm ci`
2. `npm run build:cloudflare`
3. `wrangler d1 migrations apply ... --remote`
4. `wrangler pages deploy ...`

## מה שבוצע בסבב הזה

- חיבור אלבום התמונות האמיתי של הסניף
- הטמעת תמונות סטטיות בפרויקט
- החלפת placeholderים בגלריה ובסיפורים
- עדכון Hero, About ו־Footer
- תיקון ניווט פנימי
- הוספת fallbackי תוכן אמיתיים בצד הלקוח
- עדכון seedים ו־Functions כדי להגיש מדיה אמיתית
- יצירת מיגרציית D1:
  - `migrations/0002_refresh_branch_media.sql`
- דיפלוי לפרודקשן
- אימות Pages URL
- אימות תת הדומיין המותאם

## רמת גימור נוכחית

האתר במצב טוב לפרודקשן ראשון:

- נראה אמין יותר מדמו
- משתמש במדיה אמיתית
- עובר build ולינט
- מגיש API אמיתי בפרודקשן
- זמין על דומיין מותאם

## באגים / חוסרים ידועים

1. אזור התרומה עדיין מדמה קליטת תרומה, ולא מחובר לסליקה אמיתית.
2. פרטי קשר מסוימים עדיין placeholder:
   - טלפון
   - מייל איש קשר כללי
   - קישורי רשתות חברתיות
3. תורמים מוצגים ללא לוגואים אמיתיים.
4. קיימים נתונים ישנים בפרודקשן שנוצרו קודם ידנית דרך הממשק, ולכן ייתכן שתראה פריט מדיה נוסף מעבר לשישה שהוטמעו.
5. צד ה־`apps/server` נשאר ישן בחלקו, והוא לא מקור האמת של פרודקשן.

## פיצ'רים מומלצים להמשך

1. חיבור תרומות לספק סליקה אמיתי.
2. הוספת WhatsApp ישיר לסניף.
3. עמוד ייעודי לגיוס מתנדבים.
4. טופס הצטרפות מתנדב.
5. SEO מלא:
   - Open Graph
   - sitemap
   - robots
   - favicon ומיתוג אמיתי
6. Analytics בסיסי.
7. העלאת לוגואים אמיתיים של תורמים.
8. הקשחת חוויית האדמין והשלמת flow ההתחברות.

## אבטחה

המצב טוב יותר מבעבר, אך עדיין יש מקום לחיזוק:

- פרודקשן Cloudflare פעיל
- אימות Google קיים ב־Pages Functions
- כדאי לבצע סבב hardening נוסף על פאנל הניהול, session handling, והרשאות

## קבצים מרכזיים ששונו

- `apps/client/src/components/Hero.tsx`
- `apps/client/src/components/Hero.module.css`
- `apps/client/src/components/About.tsx`
- `apps/client/src/components/Gallery.tsx`
- `apps/client/src/components/Stories.tsx`
- `apps/client/src/components/Footer.tsx`
- `apps/client/src/components/DonationSection.tsx`
- `apps/client/src/components/Contact.tsx`
- `apps/client/src/hooks/useScrollTrigger.ts`
- `apps/client/src/content/branchContent.ts`
- `functions/api/[[path]].js`
- `migrations/0001_initial.sql`
- `migrations/0002_refresh_branch_media.sql`
- `apps/server/prisma/seed.ts`

## איך להריץ מקומית

```bash
npm install
npm run pages:dev
```

URL מקומי:

- `http://localhost:8788`

## סיכום

הפרויקט כבר לא נראה כמו תבנית או דמו. הוא עלה לפרודקשן, רץ על תשתית ללא עלות שרת חודשית, משתמש בתמונות אמיתיות של הסניף, ומוכן לסבב הבא של ליטוש, תוכן ואוטומציה.
