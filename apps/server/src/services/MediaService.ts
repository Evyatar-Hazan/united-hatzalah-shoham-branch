import { GalleryItem, Story, ApiResponse } from '../types/index';
import prisma from '../db/prisma';

export class MediaService {
  // Gallery methods
  static async getGalleryItems(): Promise<ApiResponse<GalleryItem[]>> {
    try {
      const items = await prisma.galleryItem.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return {
        success: true,
        data: items,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch gallery items',
        timestamp: new Date(),
      };
    }
  }

  static async addGalleryItem(
    item: Omit<GalleryItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<GalleryItem>> {
    try {
      const newItem = await prisma.galleryItem.create({
        data: item,
      });

      return {
        success: true,
        data: newItem,
        message: 'Gallery item added successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add gallery item',
        timestamp: new Date(),
      };
    }
  }

  static async updateGalleryItem(
    id: string,
    updates: Partial<GalleryItem>
  ): Promise<ApiResponse<GalleryItem>> {
    try {
      const item = await prisma.galleryItem.update({
        where: { id },
        data: updates,
      });

      return {
        success: true,
        data: item,
        message: 'Gallery item updated successfully',
        timestamp: new Date(),
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return {
          success: false,
          error: 'Gallery item not found',
          timestamp: new Date(),
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update gallery item',
        timestamp: new Date(),
      };
    }
  }

  static async deleteGalleryItem(id: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      await prisma.galleryItem.delete({
        where: { id },
      });

      return {
        success: true,
        data: { success: true },
        message: 'Gallery item deleted successfully',
        timestamp: new Date(),
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return {
          success: false,
          error: 'Gallery item not found',
          timestamp: new Date(),
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete gallery item',
        timestamp: new Date(),
      };
    }
  }

  // Story methods
  static async getStories(): Promise<ApiResponse<Story[]>> {
    try {
      const stories = await prisma.story.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return {
        success: true,
        data: stories,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch stories',
        timestamp: new Date(),
      };
    }
  }

  static async addStory(
    story: Omit<Story, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Story>> {
    try {
      const newStory = await prisma.story.create({
        data: story,
      });

      return {
        success: true,
        data: newStory,
        message: 'Story added successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add story',
        timestamp: new Date(),
      };
    }
  }

  static async updateStory(id: string, updates: Partial<Story>): Promise<ApiResponse<Story>> {
    try {
      const story = await prisma.story.update({
        where: { id },
        data: updates,
      });

      return {
        success: true,
        data: story,
        message: 'Story updated successfully',
        timestamp: new Date(),
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return {
          success: false,
          error: 'Story not found',
          timestamp: new Date(),
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update story',
        timestamp: new Date(),
      };
    }
  }

  static async deleteStory(id: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      await prisma.story.delete({
        where: { id },
      });

      return {
        success: true,
        data: { success: true },
        message: 'Story deleted successfully',
        timestamp: new Date(),
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return {
          success: false,
          error: 'Story not found',
          timestamp: new Date(),
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete story',
        timestamp: new Date(),
      };
    }
  }
}
