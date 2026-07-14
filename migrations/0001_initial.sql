CREATE TABLE IF NOT EXISTS donors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  logo TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  amount REAL NOT NULL,
  donorName TEXT NOT NULL,
  donorEmail TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  picture TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  lastLogin TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gallery_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  imageUrl TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  date TEXT NOT NULL,
  image TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stat_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_info (
  id TEXT PRIMARY KEY DEFAULT 'main',
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  emergencyNumber TEXT NOT NULL,
  facebook TEXT NOT NULL DEFAULT '#',
  instagram TEXT NOT NULL DEFAULT '#',
  whatsapp TEXT NOT NULL DEFAULT '#',
  weekday TEXT NOT NULL DEFAULT '08:00 - 18:00',
  weekend TEXT NOT NULL DEFAULT '09:00 - 17:00',
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO admins (id, email, name, isActive)
VALUES ('admin-default', 'admin@shoham.united-hatzalah.org.il', 'מנהל סניף שוהם', 1);

INSERT OR IGNORE INTO stat_items (id, title, value, unit, sortOrder) VALUES
  ('stat-volunteers', 'מתנדבים פעילים', 247, NULL, 1),
  ('stat-calls', 'קריאות חירום בשנה', 3847, NULL, 2),
  ('stat-response', 'זמן תגובה ממוצע', 4.2, 'דקות', 3),
  ('stat-availability', 'זמינות מערכת', 99.8, '%', 4);

INSERT OR IGNORE INTO donors (id, name, category, logo) VALUES
  ('donor-1', 'בנק הפועלים', 'שותף קבוע', NULL),
  ('donor-2', 'דן תחבורה', 'תורם', NULL),
  ('donor-3', 'סופרמרקט שומרון', 'תורם', NULL);

INSERT OR IGNORE INTO stories (id, title, description, date, image) VALUES
  ('story-1', 'שומרים על כשירות בכל רגע', 'הסניף משקיע באופן שוטף באימוני החייאה, ציוד ותרחישי אמת כדי שכל מתנדב יגיע מוכן לדקות הקריטיות ביותר.', '2026-07-14', '/images/shoham/hero-training.jpg'),
  ('story-2', 'נוכחות קהילתית שמחזקת ביטחון', 'בין קריאה לקריאה, מתנדבי הסניף נמצאים בשטח, באירועים ובמפגשי קהילה כדי להיות קרובים לתושבים גם בשגרה.', '2026-07-14', '/images/shoham/volunteers-standby.jpg'),
  ('story-3', 'ציוד, שותפים ואנשים טובים', 'תרומות ושותפויות מקומיות מאפשרות לסניף להרחיב ציוד, לייעל תגובה ולשמור על רמת מוכנות מבצעית גבוהה.', '2026-07-14', '/images/shoham/equipment-donation.jpg');

INSERT OR IGNORE INTO gallery_items (id, title, category, imageUrl) VALUES
  ('gallery-1', 'תרגול רפואת חירום והחייאה', 'הכשרה', '/images/shoham/hero-training.jpg'),
  ('gallery-2', 'נוכחות מתנדבים באירועי קהילה', 'קהילה', '/images/shoham/volunteers-standby.jpg'),
  ('gallery-3', 'ערב הוקרה לפעילי הסניף', 'קהילה', '/images/shoham/community-evening.jpg'),
  ('gallery-4', 'מפגש צוות והיערכות מבצעית', 'מתנדבים', '/images/shoham/community-table.jpg'),
  ('gallery-5', 'ציוד שנתרם לפעילות הסניף', 'ציוד', '/images/shoham/equipment-donation.jpg'),
  ('gallery-6', 'אמבולנס הקהילה בפעילות חינוכית', 'הסברה', '/images/shoham/ambulance-mascot.jpg');

INSERT OR IGNORE INTO contact_info (
  id,
  phone,
  email,
  address,
  emergencyNumber,
  facebook,
  instagram,
  whatsapp
) VALUES (
  'main',
  '+972-XX-XXX-XXXX',
  'contact@shoham.united-hatzalah.org.il',
  'איחוד הצלה סניף שוהם',
  '101',
  'https://facebook.com/your-page',
  'https://instagram.com/your-page',
  'https://wa.me/your-number'
);
