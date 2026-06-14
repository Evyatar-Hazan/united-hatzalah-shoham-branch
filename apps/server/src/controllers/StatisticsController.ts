import { Request, Response } from 'express';
import { StatisticsService } from '../services/StatisticsService';

export class StatisticsController {
  static async getStatistics(_req: Request, res: Response): Promise<void> {
    try {
      const result = await StatisticsService.list();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date(),
      });
    }
  }

  static async updateStatistics(_req: Request, res: Response): Promise<void> {
    try {
      res.status(400).json({
        success: false,
        error: 'Statistics are now managed per item via /api/admin/stat-items',
        timestamp: new Date(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date(),
      });
    }
  }
}
