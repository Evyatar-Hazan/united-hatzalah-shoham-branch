import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { AuthTokenService } from '../services/AuthTokenService';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    picture: string;
    isAdmin: boolean;
  };
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
        timestamp: new Date(),
      });
      return;
    }

    const session = await AuthTokenService.verifyAdminSession(authHeader.substring(7).trim());
    if (!session) {
      res.status(403).json({
        success: false,
        error: 'Unauthorized or not an admin',
        timestamp: new Date(),
      });
      return;
    }

    const adminRes = await AuthService.getAdminById(session.adminId);

    if (!adminRes.success || !adminRes.data) {
      res.status(403).json({
        success: false,
        error: 'Unauthorized or not an admin',
        timestamp: new Date(),
      });
      return;
    }

    const admin = adminRes.data;
    if (!admin.isActive || admin.email.toLowerCase() !== session.email) {
      res.status(403).json({
        success: false,
        error: 'Unauthorized or not an admin',
        timestamp: new Date(),
      });
      return;
    }

    req.user = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      picture: admin.picture || '',
      isAdmin: true,
    };
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication error',
      timestamp: new Date(),
    });
  }
};
