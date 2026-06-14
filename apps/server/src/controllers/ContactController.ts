import { Request, Response } from 'express';
import { ContactService } from '../services/ContactService';
import { validateData, ContactSchema } from '../utils/validation';
import { ContactInput } from '../utils/validation';

export class ContactController {
  static async submitContactMessage(req: Request, res: Response): Promise<void> {
    try {
      const validation = validateData<ContactInput>(ContactSchema, req.body);

      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: validation.error,
          timestamp: new Date(),
        });
        return;
      }

      const result = await ContactService.submitContactMessage(validation.data!);

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

  // getContactInfo was removed in Prisma refactor

  static async getContactMessages(_req: Request, res: Response): Promise<void> {
    try {
      const result = await ContactService.getContactMessages();
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
