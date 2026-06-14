import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';

const router = Router();

// Google OAuth verification (refactored: expect email/name/picture)
router.post('/google-verify', async (req: Request, res: Response) => {
  try {
    const { email, name, picture } = req.body;
    if (!email || !name) {
      res.status(400).json({
        success: false,
        error: 'email and name are required',
        timestamp: new Date(),
      });
      return;
    }
    const result = await AuthService.findOrCreateAdmin(email, name, picture);

    // Add isAdmin flag to the response data
    if (result.success && result.data) {
      res.json({
        ...result,
        data: {
          ...result.data,
          isAdmin: true,
        },
      });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

// Check if user is admin (refactored)
router.post('/check-admin', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({
        success: false,
        error: 'email is required',
        timestamp: new Date(),
      });
      return;
    }
    const adminsRes = await AuthService.getAdmins();
    if (!adminsRes.success || !adminsRes.data) {
      res.status(500).json(adminsRes);
      return;
    }
    const isAdmin = adminsRes.data.some(a => a.email === email);
    res.json({ success: true, data: { isAdmin }, timestamp: new Date() });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

export default router;
