import { Request, Response } from 'express';
import { MediaService } from '../services/MediaService';

export class MediaController {
  static async getGallery(_req: Request, res: Response): Promise<void> {
    try {
      const result = await MediaService.getGalleryItems();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date(),
      });
    }
  }

  static async getStories(_req: Request, res: Response): Promise<void> {
    try {
      const result = await MediaService.getStories();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date(),
      });
    }
  }

  static async addGalleryItem(req: Request, res: Response): Promise<void> {
    try {
      const result = await MediaService.addGalleryItem(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date(),
      });
    }
  }

  static async addStory(req: Request, res: Response): Promise<void> {
    try {
      const result = await MediaService.addStory(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date(),
      });
    }
  }
}
