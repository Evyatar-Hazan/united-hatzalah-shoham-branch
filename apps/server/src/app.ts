import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { DonorsService } from './services/DonorsService';
import donationsRouter from './routes/donations';
import statisticsRouter from './routes/statistics';
import mediaRouter from './routes/media';
import contactRouter from './routes/contact';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';

const app = express();

// CORS configuration - must be before other middleware
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
      'https://frontend-five-ruddy-ztsl9rllwx.vercel.app',
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    // Always allow if no origin (simple requests or same-origin)
    // Or allow if origin matches
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Add explicit CORS headers for preflight and all responses
app.use((_req: Request, res: Response, next: NextFunction) => {
  // Set CORS headers explicitly
  const origin = _req.get('origin');
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Allow postMessage from Google OAuth
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

  next();
});

// Handle preflight requests
app.options('*', (_req: Request, res: Response, _next: NextFunction) => {
  const origin = _req.get('origin');
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.sendStatus(200);
});

// Middleware - increase payload size limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// Public endpoint for donors (תורמים וחסויות)
app.get('/api/donors', async (_req: Request, res: Response) => {
  try {
    const result = await DonorsService.getDonors();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date(),
    });
  }
});

// Routes
app.use('/api/donations', donationsRouter);
app.use('/api/statistics', statisticsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/contact', contactRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date(),
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: _req.path,
    timestamp: new Date(),
  });
});

export default app;
