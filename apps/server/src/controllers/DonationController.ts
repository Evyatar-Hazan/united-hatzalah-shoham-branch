import { Request, Response } from 'express';
import { DonationService } from '../services/DonationService';
import { validateData, DonationSchema } from '../utils/validation';
import { DonationInput } from '../utils/validation';

export class DonationController {
  static async createDonation(req: Request, res: Response): Promise<void> {
    try {
      const validation = validateData<DonationInput>(DonationSchema, req.body);

      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: validation.error,
          timestamp: new Date(),
        });
        return;
      }

      const result = await DonationService.createDonation(validation.data!);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date(),
      });
    }
  }

  static async getDonations(_req: Request, res: Response): Promise<void> {
    try {
      const result = await DonationService.getDonations();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date(),
      });
    }
  }

  static async getDonationStats(_req: Request, res: Response): Promise<void> {
    try {
      const result = await DonationService.getDonationStats();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date(),
      });
    }
  }
}
