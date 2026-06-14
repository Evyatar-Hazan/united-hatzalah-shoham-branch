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
        title: 'אברהם חוסה מתאונה קשה',
        description:
          'אברהם פגע בתאונת דרכים בחזקה. מתנדבינו הגיעו תוך 3 דקות וניתנו לו עזרה ראשונה מיידית שחסכה לו חיים.',
        date: '2025-01-20',
        image: null,
      },
      {
        title: 'הצלת פעוט שנחנק',
        description:
          'ילדה בת 2 שנחנקה על פי כלב. מתנדבינו שלנו שהיו קרובים למקום הגיעו ברגעי זהב וחילצו את הילדה בבטחה.',
        date: '2025-01-15',
        image: null,
      },
      {
        title: 'התנדבות סדנת עזרה ראשונה',
        description:
          'סדנה מעשית שבה הכשרנו 50 תושבים חדשים בעזרה ראשונה וטיפול בחירום. כל אחד חוסך חיים!',
        date: '2025-01-10',
        image: null,
      },
    ],
  });
  console.log(`✅ Created ${stories.count} stories`);

  // Add Gallery Items
  const galleryItems = await prisma.galleryItem.createMany({
    data: [
      {
        title: 'סדנת הכשרה מתנדבים',
        category: 'הכשרה',
        imageUrl: 'https://via.placeholder.com/400x300?text=Training+Workshop',
      },
      {
        title: 'רכב צילום מפעם הופעות',
        category: 'מתנדבים',
        imageUrl: 'https://via.placeholder.com/400x300?text=Volunteer+Team',
      },
      {
        title: 'אירוע ערב התנדבות',
        category: 'אירוע',
        imageUrl: 'https://via.placeholder.com/400x300?text=Volunteer+Event',
      },
      {
        title: 'ציוד רפואי של היחידה',
        category: 'ציוד',
        imageUrl: 'https://via.placeholder.com/400x300?text=Medical+Equipment',
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
