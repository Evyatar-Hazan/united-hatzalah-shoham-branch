---
type: architecture-decision-record
status: accepted-on-pr-head-production-blocked
project: United-Hatzalah-Shoham-Branch
task: 46
date: 2026-10-02
decision_source: session-26
decision_session: 01a0f90e-d238-72a7-895e-ed4b1f58c0ec
---

# ADR-0046: מדיניות ענפים, CI ופריסה בפרויקט שוהם

## סטטוס

החלטת הענפים וה־CI **מאושרת ומאומתת על ראש PR #1** ב־`d938459`. היא עדיין אינה ממומשת ב־`main`, שנשאר ב־`8b373a2` עם trigger ה־CI הישן.

מיזוג ל־`main` והפריסה ל־Production **חסומים** עד השלמת שערי המוכנות המפורטים במסמך. אין לפרש ADR זה כאישור ליצור או לשנות secrets, לשנות הרשאות, להריץ migration, למזג את PR #1 או לפרוס.

ענף התיעוד של משימה 46 מבוסס על `main` ומוסיף ADR וקישור מה־runbook בלבד; הוא אינו משנה את `.github/workflows/validate.yml` ואינו הופך את מדיניות ה־CI החדשה לפעילה ב־`main`.

## הקשר

`main` הוא ענף האינטגרציה וענף ה־Production הקנוני. פריסת Production מתבצעת ל־Cloudflare Pages, עם Pages Functions ו־D1; ‏Netlify אינו חלק ממסלול הפריסה.

Draft PR #2 היה PR מדורג מ־`codex/task-26-auth-donation-fix` אל `agent/refresh-shoham-site`, ולא אל `main`. ה־workflow הישן הריץ `Validate` רק על push ל־`main` ועל PR שענף הבסיס שלו `main`. לכן PR #2 לא הפעיל CI, אף שהיו לו בדיקות מקומיות.

בנוסף, `origin/main` נשאר ב־`8b373a2`, בעוד גרסת האתר החיה תאמה קודם ל־`032d6e3`. הפער בין `main`, ענפי ה־refresh והגרסה החיה חייב מסלול מעבר מדורג שאינו מייחס CI או פריסה שלא התרחשו.

## החלטה

### 1. בסיס ברירת מחדל וחריגים

- `main` הוא בסיס ברירת המחדל ל־PR סופי והוא המקור היחיד שמפעיל פריסת Production אוטומטית.
- PR מדורג לענף שאינו `main` מותר כחריג זמני כאשר שינוי תלוי בשינוי אחר שטרם מוזג.
- PR מדורג אינו מועמד לפריסה. לאחר מעבר CI על ה־SHA המדויק שלו, ניתן למזגו לענף הבסיס שלו; לאחר מכן ענף הבסיס חייב להיבדק מחדש בדרכו אל `main`.
- אין להסתמך על CI ירוק של ancestor, של SHA קודם או של PR אחר.

### 2. טריגר ושער CI

המדיניות שנבחרה, כפי שהיא ממומשת ומאומתת ב־`d938459`, מריצה את `Validate` בשני מסלולים:

1. `push` לכל ענף, כדי שגם PR מדורג ושינויים בענף הבסיס יקבלו בדיקה על ה־SHA המדויק.
2. `pull_request` אל `main`, כדי לבדוק את מועמד המיזוג הסופי בהקשר של PR.

שער `Validate` כולל התקנת dependencies, יצירת Prisma client, בדיקות, build ו־lint. מעבר מקומי אינו מחליף GitHub Actions ירוק על אותו SHA.

ב־`main` הנוכחי (`8b373a2`) ה־workflow עדיין רץ רק על push ל־`main` ועל PR אל `main`, ואינו כולל את שלב הבדיקות שנוסף במועמד PR #1. מיזוג מסמך זה לבדו מתעד את ההחלטה אך אינו משנה עובדה זו.

### 3. סמכות merge ו־deploy

- CI רשאי לרוץ אוטומטית בעקבות האירועים לעיל.
- merge של PR מדורג, merge אל `main`, יצירת או שינוי secrets, שינוי הרשאות והרצת deployment או migration דורשים הרשאה מפורשת ובהיקף מתאים.
- merge אל `main` אינו מאושר כאשר שער הפריסה ייכשל או כאשר סביבת היעד אינה מוכנה.
- אין לעקוף שער חסר באמצעות פריסה ידנית. המסלול הידני המתועד אינו חלופה אוטומטית למסלול `main` ואינו מאושר מכוח ADR זה.

### 4. שער Production

לפני merge אל `main` חייבות להיות ראיות טריות לכל התנאים הבאים:

- `Validate` ירוק על ה־SHA המדויק של מועמד `main`, הן ב־push והן ב־PR כאשר שתי הריצות נוצרות.
- ב־GitHub קיימים `CLOUDFLARE_ACCOUNT_ID` ו־`CLOUDFLARE_API_TOKEN`.
- ב־Cloudflare Pages production קיים `SESSION_SECRET` תקין.
- רק לאחר אימות ה־secret ב־Cloudflare מוגדר ב־GitHub המשתנה הלא־סודי `SESSION_SECRET_CONFIGURED=true`.
- כל migration מרוחק שמיועד לרוץ ידוע, נכלל בהיתר הפעולה, וקיימת עבורו תוכנית backup/restore מאומתת. אם תנאי זה אינו מתקיים, אין למזג שינוי שמפעיל את ה־workflow.

ה־workflow חייב להיכשל באופן ברור כאשר תנאי מוכנות חסר; הצלחה שמדלגת על build, migration או deploy אינה ראיית פריסה.

### 5. ראיית Production נדרשת

לאחר merge ופריסה מאושרים, השלמה דורשת לכל הפחות:

- ריצות `Validate` ו־`Deploy to Cloudflare` מוצלחות על SHA ה־`main` שמוזג, ללא steps שדולגו בגלל תצורה חסרה.
- התאמה בין ה־SHA שנפרס לבין artifact חי; כאשר Cloudflare אינו מציג commit metadata, יש לצרף deploy log ובדיקת asset/hash מול build של אותו SHA.
- HTTP 200 בדומיין הקנוני `https://hatzalah-shoham.evyatarhazan.com/` וב־Pages URL `https://united-hatzalah-shoham-branch.pages.dev/`.
- `GET /api/health` מחזיר מצב תקין, נתיבי הציבור הנדרשים נקראים בהצלחה, ו־`/admin` נטען.
- נתיב אדמין מוגן מחזיר 403 ללא הרשאה, ובדיקת כניסה חיובית מתבצעת רק באמצעות אדמין מורשה ו־session חתום.
- אם רץ migration, ראיית תקינות נתונים לאחריו ויכולת restore לפי התוכנית שאושרה מראש.

## מסלול המעבר של Draft PR #2

המסלול שבוצע בפועל:

1. ה־workflow שונה כך ש־`Validate` רץ על כל branch push ובנוסף על PR אל `main`.
2. כשל אמיתי בבדיקת tampered JWT תוקן כך שהבדיקה משנה בייט בחתימה באופן דטרמיניסטי.
3. ‏12/12 בדיקות, build ו־lint עברו מקומית.
4. ריצת `Validate` עברה על `66b933d`.
5. PR #2 מוזג אל `agent/refresh-shoham-site` ב־merge commit ‏`d938459e28aec61151aca92a41da37442e27d0c7`.
6. PR #1 עודכן ל־`d938459`; ריצות `push` ו־`pull_request` עברו על אותו SHA.
7. המסלול נעצר לפני merge של PR #1 אל `main`, ולכן `main` נשאר ב־`8b373a2`, לא הופעלה פריסה חדשה ו־Production לא השתנה.

## Rollback

### לפני merge אל `main`

אין שינוי Production. יש לתקן או לבטל את ה־PR/הענף ולדרוש CI חדש על SHA חדש; אין לקדם SHA שנכשל.

### לאחר merge אל `main` ולפני פריסה תקינה

יש לעצור קידום נוסף וליצור revert reviewable של merge commit אל `main`. ה־revert חייב לעבור את אותם שערי CI. אין להכריז על rollback שהושלם לפני אימות מצב Production.

### לאחר פריסה

- rollback של קוד מתבצע באמצעות commit revert מאושר ל־`main`, ולא באמצעות שינוי ידני לא מתועד ב־Production.
- אם לא בוצע שינוי D1, יש לפרוס את ה־revert ולאמת מחדש את כל ראיות Production.
- אם בוצע migration, אין להניח ש־revert קוד משחזר נתונים. יש לעצור ולבצע restore רק מתוכנית backup/restore שאושרה ונבדקה מראש. בהיעדר ראיה כזו, הפריסה נשארת חסומה.

מסלול rollback זה לא הופעל באירוע הנוכחי; הוא מגדיר את השער המינימלי לאירוע עתידי ואינו מעיד שקיימת כיום ראיית backup/restore.

## חלופות שנבחנו

### להשאיר CI רק ל־PR אל `main`

נדחה. PR מדורג יכול לעבור ללא CI, כפי שקרה ל־PR #2.

### להוסיף את שם ענף ה־refresh לרשימת בסיסי `pull_request`

נדחה. זו מדיניות שבירה התלויה בשם ענף זמני; בנוסף, workflow של אירוע `pull_request` נטען מענף הבסיס, ולכן שינוי שקיים רק ב־head אינו יכול להפעיל את עצמו.

### להריץ CI על כל branch push ולשמור PR validation אל `main`

נבחר. הוא מספק ראיה על ה־SHA של PR מדורג וגם שער נוסף למועמד המיזוג הסופי.

### לרטגרט או לשטח מיד את PR #2 אל `main`

לא נבחר באירוע זה. נשמר מבנה ה־PR המדורג: תחילה CI ומיזוג אל `agent/refresh-shoham-site`, ולאחר מכן CI מחודש של PR #1 אל `main`.

### לפרוס ידנית בגלל שחסרים GitHub secrets

לא נבחר ולא אושר. הוא היה עוקף את שער ה־fail-closed, ובפועל גם `SESSION_SECRET` לא היה קיים ב־Cloudflare Pages production.

## מצב נוכחי וחסמים

נכון ל־readback החי מ־GitHub ולראיות סשן 26 מ־2026-10-02:

- PR #2 מוזג ל־`agent/refresh-shoham-site` ב־`d938459`.
- PR #1 פתוח, Draft ו־`CLEAN`; שתי ריצות `Validate` על `d938459` עברו.
- `main` נשאר ב־`8b373a2`.
- `main` עדיין מכיל את trigger ה־CI הישן; ענף התיעוד של משימה 46 אינו משנה workflow.
- קיים `CLOUDFLARE_ACCOUNT_ID` ב־GitHub.
- חסרים `CLOUDFLARE_API_TOKEN`, ‏`SESSION_SECRET_CONFIGURED` ו־Cloudflare Pages production `SESSION_SECRET`.
- לא בוצעו merge של PR #1, migration או deployment; Production לא השתנה.

הפעולה הבאה אינה חלק ממשימה 46 ללא הרשאה חדשה: להגדיר ולאמת את שלושת תנאי המוכנות, לאשר במפורש כל migration רלוונטי, ואז למזג ולפרוס דרך המסלול הקנוני ולאסוף את ראיות Production.

## מקורות ראיה

- סשן 26: `01a0f90e-d238-72a7-895e-ed4b1f58c0ec`.
- הרשאת משתמש לסשן 26: “26 מאשר גם למזג ולפרוס”, ‏`Sentinel_b50d8c90a24481918ff87a43028941e5`, ‏2026-10-02T13:35:20Z.
- משימה קיימת: Jarvis #46, ‏`shoham-46-branch-ci-deployment-adr`.
- `Validate` על `66b933d`: `https://github.com/Evyatar-Hazan/united-hatzalah-shoham-branch/actions/runs/37015292615`.
- `Validate` push על `d938459`: `https://github.com/Evyatar-Hazan/united-hatzalah-shoham-branch/actions/runs/37015460026`.
- `Validate` PR על `d938459`: `https://github.com/Evyatar-Hazan/united-hatzalah-shoham-branch/actions/runs/37015466137`.
