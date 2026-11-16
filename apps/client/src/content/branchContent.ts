export interface BranchGalleryItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
}

export interface BranchStoryItem {
  id: string;
  title: string;
  description: string;
  date: string;
  image: string;
}

export interface BranchHighlightItem {
  id: string;
  title: string;
  description: string;
}

export interface BranchOperationItem {
  id: string;
  title: string;
  description: string;
  meta: string;
  image: string;
}

export const branchGalleryFallback: BranchGalleryItem[] = [
  {
    id: 'gallery-1',
    title: 'תרגול רפואת חירום והחייאה',
    category: 'הכשרה',
    imageUrl: '/images/shoham/hero-training.jpg',
  },
  {
    id: 'gallery-2',
    title: 'נוכחות מתנדבים באירועי קהילה',
    category: 'קהילה',
    imageUrl: '/images/shoham/volunteers-standby.jpg',
  },
  {
    id: 'gallery-3',
    title: 'ערב הוקרה לפעילי הסניף',
    category: 'קהילה',
    imageUrl: '/images/shoham/community-evening.jpg',
  },
  {
    id: 'gallery-4',
    title: 'מפגש צוות והיערכות מבצעית',
    category: 'מתנדבים',
    imageUrl: '/images/shoham/community-table.jpg',
  },
  {
    id: 'gallery-5',
    title: 'ציוד שנתרם לפעילות הסניף',
    category: 'ציוד',
    imageUrl: '/images/shoham/equipment-donation.jpg',
  },
  {
    id: 'gallery-6',
    title: 'אמבולנס הקהילה בפעילות חינוכית',
    category: 'הסברה',
    imageUrl: '/images/shoham/ambulance-mascot.jpg',
  },
  {
    id: 'gallery-7',
    title: 'ציוד רפואי וערכות תגובה מוכנות לשטח',
    category: 'מוכנות',
    imageUrl: '/images/shoham/album/album-08.jpg',
  },
  {
    id: 'gallery-8',
    title: 'פריסה קהילתית באירועי הסברה וליווי',
    category: 'קהילה',
    imageUrl: '/images/shoham/album/album-09.jpg',
  },
  {
    id: 'gallery-9',
    title: 'מפגש שטח עם המתנדבים והקהילה המקומית',
    category: 'שגרה מבצעית',
    imageUrl: '/images/shoham/album/album-12.jpg',
  },
];

export const branchStoriesFallback: BranchStoryItem[] = [
  {
    id: 'story-1',
    title: 'שומרים על כשירות בכל רגע',
    description:
      'הסניף משקיע באופן שוטף באימוני החייאה, ציוד ותרחישי אמת כדי שכל מתנדב יגיע מוכן לדקות הקריטיות ביותר.',
    date: '2026-07-14',
    image: '/images/shoham/hero-training.jpg',
  },
  {
    id: 'story-2',
    title: 'נוכחות קהילתית שמחזקת ביטחון',
    description:
      'בין קריאה לקריאה, מתנדבי הסניף נמצאים בשטח, באירועים ובמפגשי קהילה כדי להיות קרובים לתושבים גם בשגרה.',
    date: '2026-07-14',
    image: '/images/shoham/volunteers-standby.jpg',
  },
  {
    id: 'story-3',
    title: 'ציוד, שותפים ואנשים טובים',
    description:
      'תרומות ושותפויות מקומיות מאפשרות לסניף להרחיב ציוד, לייעל תגובה ולשמור על רמת מוכנות מבצעית גבוהה.',
    date: '2026-07-14',
    image: '/images/shoham/equipment-donation.jpg',
  },
  {
    id: 'story-4',
    title: 'תיאום שקט שמייצר תגובה חדה',
    description:
      'מאחורי כל יציאה מהירה יש עבודת תיאום מדויקת: בדיקות ציוד, חלוקת אזורי כוננות, קשר רציף בין המתנדבים והיערכות שמאפשרת לצוותים לפעול מהר גם ברגעים עמוסים.',
    date: '2026-07-14',
    image: '/images/shoham/album/album-08.jpg',
  },
  {
    id: 'story-5',
    title: 'הקהילה רואה את האנשים שמאחורי האפוד',
    description:
      'הסניף לא פוגש את התושבים רק ברגעי חירום. נוכחות באירועים, הסברה, מפגשים עם משפחות ושותפות עם תורמים מקומיים בונים אמון עמוק שמחזק את כל מערך ההצלה.',
    date: '2026-07-14',
    image: '/images/shoham/album/album-09.jpg',
  },
];

export const branchHighlights: BranchHighlightItem[] = [
  {
    id: 'highlight-1',
    title: 'כוננות מקומית רציפה',
    description:
      'מתנדבים מהאזור שמכירים את הרחובות, את מוסדות הציבור ואת צרכי הקהילה ופועלים בזמינות גבוהה לאורך היממה.',
  },
  {
    id: 'highlight-2',
    title: 'מוכנות רפואית ותפעולית',
    description:
      'אימונים, ציוד, תחקור ושיפור מתמיד כדי להגיע לרגע האמת ברמת מקצועיות גבוהה ועם תגובה בטוחה יותר.',
  },
  {
    id: 'highlight-3',
    title: 'קשר ישיר עם התושבים',
    description:
      'שיתוף פעולה עם תושבים, שותפים מקומיים ותורמים שמאפשר לחזק את המענה גם בשגרה וגם בזמני עומס.',
  },
  {
    id: 'highlight-4',
    title: 'נראות שמייצרת אמון',
    description:
      'הסניף מקפיד להיות נוכח, מסודר ונגיש כדי שכל משפחה תדע שיש לה מענה קרוב, אנושי ומקצועי כשצריך אותו.',
  },
];

export const branchOperations: BranchOperationItem[] = [
  {
    id: 'operation-1',
    title: 'שגרה מבצעית',
    description:
      'בדיקות ציוד, רענוני נהלים ותיאום בין הכוננים המקומיים שומרים את המענה חד גם בימים שקטים.',
    meta: 'היערכות יומיומית',
    image: '/images/shoham/community-table.jpg',
  },
  {
    id: 'operation-2',
    title: 'אירועי קהילה והסברה',
    description:
      'נוכחות בשטח, היכרות עם התושבים וחיבור לבתי ספר, קהילות ויוזמות מקומיות מחזקים את האמון והזמינות.',
    meta: 'חיבור לתושבים',
    image: '/images/shoham/album/album-09.jpg',
  },
  {
    id: 'operation-3',
    title: 'ציוד ותרומות בתנועה',
    description:
      'תרומות ושותפויות עוזרות להרחיב ציוד, לשפר תנאי תגובה ולשמור על רצף תפעולי איכותי לסניף.',
    meta: 'שותפויות מקומיות',
    image: '/images/shoham/album/album-12.jpg',
  },
];
