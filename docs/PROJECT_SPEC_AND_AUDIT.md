# אפיון מוצר וטכני - United Hatzalah Shoham Branch

עודכן: 2026-07-08

## תקציר מנהלים

הפרויקט הוא אתר Full Stack לסניף איחוד הצלה שוהם: אתר ציבורי בעברית להצגת פעילות הסניף, סיפורי הצלה, גלריה, תורמים, תרומות ויצירת קשר, לצד פאנל ניהול לתפעול תוכן, מדיה, סטטיסטיקות, תורמים, תרומות ומנהלים.

הפרויקט נמצא בשלב MVP מתקדם מבחינת מבנה קוד ויכולת build, אך עדיין לא בשל לפרודקשן מלא בלי חיבור תשתיות: PostgreSQL, משתני סביבה, Google OAuth תקין, Cloudinary, ומימוש/סגירת פערי API. לאחר תיקונים שבוצעו בבדיקה הנוכחית, `build`, `lint` ו־`npm audit` עוברים בהצלחה.

## חזון

להפוך את אתר סניף איחוד הצלה שוהם לנכס דיגיטלי אמין ומכובד שמחבר בין הקהילה המקומית לבין פעילות ההצלה: הצגת אימפקט, גיוס תרומות, שימור אמון ציבורי, ושיפור היכולת של מנהלי הסניף לעדכן תוכן בלי תלות בפיתוח.

## מטרות מוצר

- להציג את סניף שוהם באופן מקצועי, רגשי ואמין.
- להמחיש פעילות באמצעות נתונים, סיפורים וגלריית מדיה.
- לאפשר תרומה מהירה ופשוטה.
- לאפשר יצירת קשר עם הסניף.
- לתת למנהלים פאנל תפעולי לניהול תוכן ודאטה.
- לייצר בסיס טכני שניתן לפריסה ב־frontend host וב־Node backend host.

## לקוחות ומשתמשים

### קהל ציבורי

- תושבי שוהם והסביבה.
- תורמים פרטיים.
- עסקים מקומיים שרוצים לתמוך או לתת חסות.
- מתנדבים פוטנציאליים.
- בני משפחה/קהילה שרוצים להבין את פעילות הסניף.

### משתמשים פנימיים

- מנהל סניף או אחראי דיגיטל.
- אחראי קשרי תורמים.
- אחראי מדיה/תוכן.
- מנהל טכני או מפתח שמתחזק את המערכת.

## חוויית משתמש ציבורית

האתר בנוי כעמוד נחיתה ארוך בעברית ו־RTL:

- Hero עם מסר מרכזי ו־CTA לתרומה.
- אזור אודות הסניף וערכים.
- אזור סטטיסטיקות דינמי.
- סיפורי הצלה מהשטח.
- גלריית מדיה.
- תורמים וחסויות.
- רכיב תרומה עם סכומים מוכנים וסכום מותאם.
- טופס יצירת קשר.
- Footer עם קישורי מידע, קהילה וניהול.

בבדיקת דפדפן מקומית, האתר הציבורי נטען ומציג תוכן סטטי מרכזי, אך רכיבי הדאטה נשארים ריקים או במצב טעינה כאשר ה־backend אינו רץ.

## חוויית מנהל

פאנל הניהול זמין בנתיב `/admin` וכולל:

- מסך התחברות עם Google Sign-In.
- Mock login במצב פיתוח.
- ניהול מנהלים.
- ניהול סטטיסטיקות.
- ניהול סיפורים.
- ניהול גלריה.
- ניהול הודעות יצירת קשר.
- ניהול תרומות.
- ניהול תורמים/חסויות.
- העלאת תמונות דרך endpoint ייעודי.

בבדיקת דפדפן מקומית, מסך ההתחברות נטען. Mock login נכשל כאשר ה־backend אינו רץ, כמצופה.

## אפיון פונקציונלי

### תוכן ציבורי

- הצגת טקסטים קבועים על הסניף.
- הצגת סטטיסטיקות מ־API.
- הצגת סיפורי הצלה מ־API.
- הצגת גלריית מדיה מ־API.
- הצגת תורמים מ־API.
- שליחת טופס יצירת קשר ל־API.

### תרומות

- בחירת סכומי תרומה קבועים: 50, 100, 250, 500 ש"ח.
- הזנת סכום מותאם.
- שליחת תרומה ל־`POST /api/donations`.
- במצב הנוכחי אין אינטגרציית סליקה אמיתית; התרומה נשמרת כ־`completed` במסד הנתונים.

### ניהול תוכן

- CRUD לגלריה.
- CRUD לסיפורים.
- CRUD לסטטיסטיקות.
- CRUD לתורמים.
- CRUD לתרומות.
- CRUD/השבתה למנהלים.
- צפייה בהודעות יצירת קשר.

### מדיה

- העלאת תמונה דרך `multer`.
- אם Cloudinary מוגדר, העלאה לענן.
- אם Cloudinary לא מוגדר, fallback ל־data URL לפיתוח.

## אפיון טכני

### מבנה ריפו

- `apps/client` - React, TypeScript, Vite.
- `apps/server` - Express, TypeScript, Prisma.
- `package.json` ראשי עם npm workspaces.

### Frontend

- React 19.
- React Router.
- Framer Motion לאנימציות.
- CSS Modules לרכיבים.
- RTL גלובלי.
- `VITE_API_URL` כברירת מחדל ל־`http://localhost:5000`.
- Vite proxy ל־`/api`, אך בפועל הקוד משתמש ב־URL מוחלט ולכן proxy לא מנוצל ברוב הקריאות.

### Backend

- Express 5.
- Prisma Client.
- PostgreSQL בלבד לפי `schema.prisma`.
- Zod לוולידציית תרומות ויצירת קשר.
- CORS עם רשימת origins מקומית ו־`FRONTEND_URL`.
- Cloudinary להעלאות תמונה.
- Auth מבוסס email כ־Bearer token פשוט.

### Database

מודלים קיימים:

- `Donor`
- `Donation`
- `Admin`
- `GalleryItem`
- `Story`
- `StatItem`
- `ContactMessage`

### API ציבורי

- `GET /api/health`
- `GET /api/donors`
- `POST /api/donations`
- `GET /api/donations`
- `GET /api/donations/stats`
- `GET /api/statistics`
- `GET /api/media/gallery`
- `GET /api/media/stories`
- `POST /api/media/gallery`
- `POST /api/media/stories`
- `POST /api/contact`
- `GET /api/contact/messages`
- `GET /api/contact/info`
- `POST /api/auth/google-verify`
- `POST /api/auth/check-admin`

### API ניהול

כל נתיבי `/api/admin/*` מוגנים ב־`authMiddleware`:

- `POST /api/admin/upload-image`
- CRUD: `/api/admin/gallery`
- CRUD: `/api/admin/stories`
- CRUD: `/api/admin/stat-items`
- `GET /api/admin/contact-messages`
- CRUD: `/api/admin/admins`
- CRUD: `/api/admin/donations`
- CRUD: `/api/admin/donors`

## תשתיות ופריסה

### Frontend

הלקוח מתאים לפריסה ב־Netlify/Vercel/Cloudflare Pages. קיים `apps/client/netlify.toml`.

### Backend

השרת מתאים ל־Node host כגון Render. קיים `apps/server/render.yaml`.

### Secrets נדרשים

- `DATABASE_URL`
- `FRONTEND_URL`
- `VITE_API_URL`
- `VITE_GOOGLE_CLIENT_ID`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- בעתיד: Stripe/סליקה, Email provider.

## רמת גימור

ציון נוכחי: 6.5/10.

### חזק

- מבנה מונוריפו נקי וברור.
- הפרדה טובה בין client/server.
- build ו־lint עוברים אחרי התיקונים.
- בסיס UI עברי/RTL קיים.
- מודלים ו־API מכסים את רוב צרכי MVP.
- פאנל ניהול רחב יחסית לשלב הפרויקט.
- אין חולשות ידועות ב־`npm audit` לאחר עדכון `multer`.

### דורש השלמה

- אין סביבת פיתוח מקומית מלאה בלי Postgres.
- אין בדיקות אוטומטיות אמיתיות.
- אין סליקה אמיתית.
- אין אימות Google מלא בצד השרת; יש פענוח JWT בצד לקוח ואמון ב־email.
- חוויית fallback כאשר API לא זמין חלקית בלבד.
- חלק מהטקסטים נראים כטיוטה או מכילים שגיאות ניסוח.
- README של הלקוח עדיין גנרי מ־Vite ולא מתאר את המוצר.

## בדיקות שבוצעו

### התקנה

- `npm install` הסתיים בהצלחה.

### איכות

- `npm run build` עבר בהצלחה לאחר תיקון TypeScript ותצורת server package.
- `npm run lint` עבר בהצלחה לאחר שינוי `apps/server/eslint.config.js` ל־`apps/server/eslint.config.mjs`.
- `npm audit --audit-level=moderate` עבר עם `0 vulnerabilities` לאחר `npm audit fix`.

### הרצה

- `npm run dev:server` נכשל ללא `.env` מקומי בגלל חסר `DATABASE_URL` תקף ל־PostgreSQL.
- `npm run dev` מתוך `apps/client` עלה בהצלחה ב־`http://127.0.0.1:5173/`.
- בדיקת דפדפן ל־`/` הציגה את דף הבית, אך רכיבי API נכשלו כי backend לא רץ.
- בדיקת דפדפן ל־`/admin` הציגה את מסך ההתחברות.
- Mock login נכשל כי backend לא רץ.

## תיקונים שבוצעו בבדיקה הנוכחית

- תוקן כשל TypeScript ב־`DonationService.getDonationStats` באמצעות `reduce<number>`.
- עודכן `multer` ב־`package-lock.json` מ־`2.1.1` ל־`2.2.0` דרך `npm audit fix`.
- תוקנה אי־התאמת מודולים בשרת: `apps/server/package.json` עבר ל־`type: commonjs`.
- קובץ ESLint של השרת שונה ל־`eslint.config.mjs` כדי להמשיך להשתמש בתחביר ESM בקונפיג.

## באגים ופערים פתוחים

### קריטי

- אין `.env` מקומי ואין `DATABASE_URL`, לכן backend לא יכול לרוץ בסביבה הנוכחית.
- אימות הניהול אינו מאובטח לפרודקשן: הלקוח שולח email/name ל־`/api/auth/google-verify`, והשרת יוצר/מזהה Admin לפי email בלי אימות Google token אמיתי.
- נתיבי תרומה מסמנים תרומה כ־`completed` ללא סליקה אמיתית.

### גבוה

- ה־Admin UI קורא ל־`GET/PUT /api/admin/contact-info`, אך בשרת אין routes כאלה.
- הקוד משתמש ב־`VITE_API_URL` מוחלט ולכן Vite proxy ל־`/api` כמעט לא עוזר בפיתוח.
- `FRONTEND_URL` בדוגמה הוא `http://localhost:5173`, אבל בדיקה על `127.0.0.1:5173` יוצרת CORS errors אם השרת ירוץ רק עם localhost.
- Google Sign-In נטען בלי `VITE_GOOGLE_CLIENT_ID` אמיתי ומדווח `Parameter client_id is not set correctly`.

### בינוני

- אין בדיקות יחידה/אינטגרציה/אינד־טו־אינד.
- חסרים דפי privacy/terms/cookies למרות שיש קישורים אליהם ב־Footer.
- קישורי anchor כמו `#team`, `#testimonials`, `#volunteer` אינם תואמים בהכרח sections קיימים.
- טקסטי seed מכילים ניסוחים לא מקצועיים או שגיאות בעברית.
- Contact form שולח רק `name`, `email`, `message`, בעוד סכמת השרת דורשת גם `subject`.
- CTA ב־Hero אינו מקשר בפועל לאזור התרומה.

### נמוך

- יש שימוש ב־emoji בתוך UI מקצועי, שיכול לפגוע ברמת גימור של אתר ארגון חירום.
- יש console logs בפלואו auth.
- README של הלקוח אינו מותאם לפרויקט.

## פיצ׳רים קיימים

- אתר ציבורי בעברית.
- דף ניהול.
- אנימציות כניסה וגלילה.
- ניהול מדיה, סיפורים, סטטיסטיקות, מנהלים, תרומות ותורמים.
- העלאת תמונות.
- שמירת הודעות קשר.
- שמירת תרומות.
- Seed בסיסי למסד הנתונים.
- Health endpoint.

## פיצ׳רים מומלצים להמשך

### לקראת MVP אמיתי

- להוסיף Postgres מקומי או Docker Compose לפיתוח.
- להשלים `contact-info` ב־admin API או להסיר מה־UI.
- להוסיף אימות Google אמיתי בצד השרת.
- להוסיף הרשאות לפי admin פעיל בלבד.
- לחבר סליקה אמיתית או לשנות copy כך שלא יוצג כאילו התרומה נסלקת.
- להוסיף fallback ציבורי איכותי כאשר API לא זמין.

### לקראת פרודקשן

- לחבר Cloudinary אמיתי.
- לחבר Email provider להודעות יצירת קשר.
- להוסיף rate limiting ל־contact/donation/auth.
- להוסיף logging ו־error monitoring.
- להוסיף בדיקות smoke לפריסה.
- להוסיף CI שמריץ build, lint, audit ובדיקות.

### שיפור מוצר וחוויית משתמש

- לשפר טקסטים עבריים לרמת ארגון ציבורי/חירום.
- להוסיף תמונות אמיתיות מהסניף במקום placeholders.
- להוסיף דפי מדיניות פרטיות ותנאי שימוש.
- להפוך CTA לתרומה לגלילה או ניווט אמיתי.
- להציג מסר ברור כאשר אין סיפורים/גלריה/תורמים.
- לשפר נגישות: aria labels עקביים, בדיקת contrast, ניווט מקלדת.

## סיכום מצב

הפרויקט הוא בסיס טוב ומשמעותי למוצר קהילתי אמיתי, עם כיסוי פונקציונלי רחב יותר מאתר תדמית פשוט. ברמת קוד, הוא עבר ממצב שבו build ו־audit נכשלים למצב שבו שערי האיכות הבסיסיים עוברים. ברמת מוצר, הוא עדיין MVP לא שלם: חסרה תשתית runtime, חסרה אבטחת auth אמיתית, חסרה סליקה, ויש פערים בין UI ל־API.

השלב הבא המומלץ הוא הקמת סביבת backend מלאה עם Postgres, seed והרצת API end-to-end. רק אחרי זה כדאי לטפל בעיצוב, copy ותוכן אמיתי, כי כרגע חלק גדול מהחוויה תלוי בדאטה שאינו נטען בסביבה המקומית.
