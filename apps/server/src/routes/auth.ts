import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { AuthTokenService } from '../services/AuthTokenService';

const router = Router();

router.post('/google-verify', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      res.status(400).json({
        success: false,
        error: 'credential is required',
        timestamp: new Date(),
      });
      return;
    }
    const googleUser = await AuthTokenService.verifyGoogleIdToken(credential);
    const result = await AuthService.authenticateAdmin(
      googleUser.email,
      googleUser.name,
      googleUser.picture
    );

    if (!result.success || !result.data) {
      res.status(403).json(result);
      return;
    }

    const sessionToken = await AuthTokenService.issueAdminSession(result.data);
    res.json({
      ...result,
      data: {
        ...result.data,
        isAdmin: true,
        sessionToken,
      },
    });
  } catch {
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
      timestamp: new Date(),
    });
  }
});

export default router;
