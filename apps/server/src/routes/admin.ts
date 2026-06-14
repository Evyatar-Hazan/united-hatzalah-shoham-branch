import { Router, Response } from 'express';
import multer from 'multer';
import { AdminService } from '../services/AdminService';
import { CloudinaryService } from '../services/CloudinaryService';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    // Only accept image files
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
    } else {
      cb(null, true);
    }
  },
});

// Apply auth middleware to all admin routes
router.use(authMiddleware);

// Image Upload Endpoint
router.post('/upload-image', upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No image file provided',
        timestamp: new Date(),
      });
      return;
    }

    const folder = req.body.folder || 'general';

    // Try Cloudinary first, if configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      const result = await CloudinaryService.uploadImage(req.file.buffer, folder);
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.status(200).json(result);
    } else {
      // Fallback: Generate a mock URL for development
      const mockUrl = `data:image/${req.file.mimetype.split('/')[1]};base64,${req.file.buffer.toString('base64')}`;
      res.status(200).json({
        success: true,
        data: {
          url: mockUrl,
          publicId: `mock-${Date.now()}`,
        },
        timestamp: new Date(),
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
      timestamp: new Date(),
    });
  }
});

// Gallery Management
router.get('/gallery', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await AdminService.getGallery();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.post('/gallery', async (req: AuthRequest, res: Response) => {
  try {
    const result = await AdminService.addGalleryItem(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.put('/gallery/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await AdminService.updateGalleryItem(id, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.delete('/gallery/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await AdminService.deleteGalleryItem(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

// Stories Management
router.get('/stories', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await AdminService.getStories();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.post('/stories', async (req: AuthRequest, res: Response) => {
  try {
    const result = await AdminService.addStory(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.put('/stories/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await AdminService.updateStory(id, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.delete('/stories/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await AdminService.deleteStory(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

// Statistics Management (per item)
router.get('/stat-items', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await AdminService.getStatItems();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.post('/stat-items', async (req: AuthRequest, res: Response) => {
  try {
    const result = await AdminService.addStatItem(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.put('/stat-items/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await AdminService.updateStatItem(id, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.delete('/stat-items/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await AdminService.deleteStatItem(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

// Contact Info routes removed in Prisma refactor

// Contact Messages
router.get('/contact-messages', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await AdminService.getContactMessages();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

// Admin Management
router.get('/admins', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await AdminService.getAdmins();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.post('/admins', async (req: AuthRequest, res: Response) => {
  try {
    const adminData = {
      email: req.body.email,
      name: req.body.name,
      picture: req.body.picture,
      addedBy: req.user?.email,
    };
    const result = await AdminService.addAdmin(adminData);
    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.put('/admins/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await AdminService.updateAdmin(id, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.delete('/admins/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const currentUserId = req.user?.id;
    const result = await AdminService.deleteAdmin(id, currentUserId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

// Donations Management
router.get('/donations', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await AdminService.getDonations();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.put('/donations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await AdminService.updateDonation(id, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.delete('/donations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await AdminService.deleteDonation(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

// Donors (תורמים וחסויות) Management
router.get('/donors', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await AdminService.getDonors();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.post('/donors', async (req: AuthRequest, res: Response) => {
  try {
    const { name, category, logo } = req.body;
    const result = await AdminService.addDonor(name, category, logo);
    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.put('/donors/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await AdminService.updateDonor(id, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

router.delete('/donors/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await AdminService.deleteDonor(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

export default router;
