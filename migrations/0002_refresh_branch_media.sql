UPDATE stories
SET
  title = CASE id
    WHEN 'story-1' THEN 'שומרים על כשירות בכל רגע'
    WHEN 'story-2' THEN 'נוכחות קהילתית שמחזקת ביטחון'
    WHEN 'story-3' THEN 'ציוד, שותפים ואנשים טובים'
    ELSE title
  END,
  description = CASE id
    WHEN 'story-1' THEN 'הסניף משקיע באופן שוטף באימוני החייאה, ציוד ותרחישי אמת כדי שכל מתנדב יגיע מוכן לדקות הקריטיות ביותר.'
    WHEN 'story-2' THEN 'בין קריאה לקריאה, מתנדבי הסניף נמצאים בשטח, באירועים ובמפגשי קהילה כדי להיות קרובים לתושבים גם בשגרה.'
    WHEN 'story-3' THEN 'תרומות ושותפויות מקומיות מאפשרות לסניף להרחיב ציוד, לייעל תגובה ולשמור על רמת מוכנות מבצעית גבוהה.'
    ELSE description
  END,
  date = CASE id
    WHEN 'story-1' THEN '2026-07-14'
    WHEN 'story-2' THEN '2026-07-14'
    WHEN 'story-3' THEN '2026-07-14'
    ELSE date
  END,
  image = CASE id
    WHEN 'story-1' THEN '/images/shoham/hero-training.jpg'
    WHEN 'story-2' THEN '/images/shoham/volunteers-standby.jpg'
    WHEN 'story-3' THEN '/images/shoham/equipment-donation.jpg'
    ELSE image
  END,
  updatedAt = CURRENT_TIMESTAMP
WHERE id IN ('story-1', 'story-2', 'story-3');

INSERT OR IGNORE INTO stories (id, title, description, date, image)
VALUES
  ('story-1', 'שומרים על כשירות בכל רגע', 'הסניף משקיע באופן שוטף באימוני החייאה, ציוד ותרחישי אמת כדי שכל מתנדב יגיע מוכן לדקות הקריטיות ביותר.', '2026-07-14', '/images/shoham/hero-training.jpg'),
  ('story-2', 'נוכחות קהילתית שמחזקת ביטחון', 'בין קריאה לקריאה, מתנדבי הסניף נמצאים בשטח, באירועים ובמפגשי קהילה כדי להיות קרובים לתושבים גם בשגרה.', '2026-07-14', '/images/shoham/volunteers-standby.jpg'),
  ('story-3', 'ציוד, שותפים ואנשים טובים', 'תרומות ושותפויות מקומיות מאפשרות לסניף להרחיב ציוד, לייעל תגובה ולשמור על רמת מוכנות מבצעית גבוהה.', '2026-07-14', '/images/shoham/equipment-donation.jpg');

DELETE FROM gallery_items
WHERE id IN ('gallery-1', 'gallery-2', 'gallery-3', 'gallery-4', 'gallery-5', 'gallery-6');

INSERT INTO gallery_items (id, title, category, imageUrl, createdAt, updatedAt)
VALUES
  ('gallery-1', 'תרגול רפואת חירום והחייאה', 'הכשרה', '/images/shoham/hero-training.jpg', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gallery-2', 'נוכחות מתנדבים באירועי קהילה', 'קהילה', '/images/shoham/volunteers-standby.jpg', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gallery-3', 'ערב הוקרה לפעילי הסניף', 'קהילה', '/images/shoham/community-evening.jpg', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gallery-4', 'מפגש צוות והיערכות מבצעית', 'מתנדבים', '/images/shoham/community-table.jpg', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gallery-5', 'ציוד שנתרם לפעילות הסניף', 'ציוד', '/images/shoham/equipment-donation.jpg', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gallery-6', 'אמבולנס הקהילה בפעילות חינוכית', 'הסברה', '/images/shoham/ambulance-mascot.jpg', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
