import { Router, Response, Request } from 'express';
import { ContactController } from '../controllers/ContactController';
import prisma from '../db/prisma';

const router = Router();

router.post('/', ContactController.submitContactMessage);
router.get('/messages', ContactController.getContactMessages);

// Contact info endpoint
router.get('/info', (_req, res: Response) => {
  res.json({
    success: true,
    data: {
      email: 'contact@shoham.united-hatzalah.org.il',
      phone: '+972-XX-XXX-XXXX',
      address: 'איחוד הצלה סניף שוהם',
      emergencyNumber: '101',
      businessHours: {
        weekday: '08:00 - 18:00',
        weekend: '09:00 - 17:00',
      },
      socialLinks: {
        facebook: 'https://facebook.com/your-page',
        instagram: 'https://instagram.com/your-page',
        whatsapp: 'https://wa.me/your-number',
      },
    },
  });
});

// Initialize admin seed (helper endpoint)
router.post('/init-admin', async (_req: Request, res: Response) => {
  try {
    const admin = await prisma.admin.upsert({
      where: { email: 'evyatarhazan3.14@gmail.com' },
      update: {},
      create: {
        email: 'evyatarhazan3.14@gmail.com',
        name: 'Evyatar Hazan',
        isActive: true,
      },
    });
    res.json({ success: true, data: admin });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: error instanceof Error ? error.message : 'Error' });
  }
});

export default router;
