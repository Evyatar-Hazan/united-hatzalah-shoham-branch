import dotenv from 'dotenv';
import path from 'path';

// Set the working directory to the backend root before loading .env
const backendDir = path.resolve(__dirname, '..');
process.chdir(backendDir);

// Load environment variables BEFORE importing PrismaClient
dotenv.config({ path: path.resolve(backendDir, '.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data
  await prisma.galleryItem.deleteMany({});
  await prisma.story.deleteMany({});
  await prisma.donor.deleteMany({});
  await prisma.donation.deleteMany({});
  await prisma.contactMessage.deleteMany({});
  await prisma.statItem.deleteMany({});
  await prisma.admin.deleteMany({});

  // Add Statistics (each metric as its own record)
  const statItems = await prisma.statItem.createMany({
    data: [
      { title: 'מתנדבים פעילים', value: 247, unit: null, order: 1 },
      { title: 'קריאות חירום בשנה', value: 3847, unit: null, order: 2 },
      { title: 'זמן תגובה ממוצע', value: 4.2, unit: 'דקות', order: 3 },
      { title: 'זמינות מערכת', value: 99.8, unit: '%', order: 4 },
    ],
  });
  console.log(`✅ Created ${statItems.count} statistic items`);

  // Add Donors (תורמים וחסויות)
  const donors = await prisma.donor.createMany({
    data: [
      { name: 'רד מגן דוד ישראל', category: 'שותף קבוע' },
      { name: 'פוקר פדרציה', category: 'תורם' },
      { name: 'פרייס וטר - בית חיות', category: 'תורם' },
      { name: 'סופרמרקט שומרון', category: 'תורם' },
      { name: 'בנק הפועלים', category: 'שותף קבוע' },
      { name: 'דן תחבורה', category: 'תורם' },
    ],
  });
  console.log(`✅ Created ${donors.count} donors`);

  // Add Stories
  const stories = await prisma.story.createMany({
    data: [
      {
        title: 'שומרים על כשירות בכל רגע',
        description:
          'הסניף משקיע באופן שוטף באימוני החייאה, ציוד ותרחישי אמת כדי שכל מתנדב יגיע מוכן לדקות הקריטיות ביותר.',
        date: '2026-07-14',
        image: '/images/shoham/hero-training.jpg',
      },
      {
        title: 'נוכחות קהילתית שמחזקת ביטחון',
        description:
          'בין קריאה לקריאה, מתנדבי הסניף נמצאים בשטח, באירועים ובמפגשי קהילה כדי להיות קרובים לתושבים גם בשגרה.',
        date: '2026-07-14',
        image: '/images/shoham/volunteers-standby.jpg',
      },
      {
        title: 'ציוד, שותפים ואנשים טובים',
        description:
          'תרומות ושותפויות מקומיות מאפשרות לסניף להרחיב ציוד, לייעל תגובה ולשמור על רמת מוכנות מבצעית גבוהה.',
        date: '2026-07-14',
        image: '/images/shoham/equipment-donation.jpg',
      },
    ],
  });
  console.log(`✅ Created ${stories.count} stories`);

  // Add Gallery Items
  const galleryItems = await prisma.galleryItem.createMany({
    data: [
      {
        title: 'תרגול רפואת חירום והחייאה',
        category: 'הכשרה',
        imageUrl: '/images/shoham/hero-training.jpg',
      },
      {
        title: 'נוכחות מתנדבים באירועי קהילה',
        category: 'קהילה',
        imageUrl: '/images/shoham/volunteers-standby.jpg',
      },
      {
        title: 'ערב הוקרה לפעילי הסניף',
        category: 'קהילה',
        imageUrl: '/images/shoham/community-evening.jpg',
      },
      {
        title: 'מפגש צוות והיערכות מבצעית',
        category: 'מתנדבים',
        imageUrl: '/images/shoham/community-table.jpg',
      },
      {
        title: 'ציוד שנתרם לפעילות הסניף',
        category: 'ציוד',
        imageUrl: '/images/shoham/equipment-donation.jpg',
      },
      {
        title: 'אמבולנס הקהילה בפעילות חינוכית',
        category: 'הסברה',
        imageUrl: '/images/shoham/ambulance-mascot.jpg',
      },
    ],
  });
  console.log(`✅ Created ${galleryItems.count} gallery items`);

  // Add Admin
  const admin = await prisma.admin.create({
    data: {
      email: 'admin@shoham.united-hatzalah.org.il',
      name: 'מנהל ענף שומרון',
      picture: null,
      isActive: true,
      lastLogin: new Date(),
    },
  });
  console.log('✅ Created admin:', admin);

  console.log('✨ Seed completed successfully!');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
