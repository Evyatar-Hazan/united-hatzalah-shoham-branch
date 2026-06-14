import { ApiResponse, StatItem } from '../types/index';
import prisma from '../db/prisma';

export class StatisticsService {
  static async list(): Promise<ApiResponse<StatItem[]>> {
    try {
      const items = await prisma.statItem.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      });

      return {
        success: true,
        data: items,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch statistics',
        timestamp: new Date(),
      };
    }
  }

  static async create(
    payload: Omit<StatItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<StatItem>> {
    try {
      const created = await prisma.statItem.create({
        data: {
          title: payload.title,
          value: payload.value,
          unit: payload.unit || null,
          order: payload.order ?? 0,
        },
      });

      return {
        success: true,
        data: created,
        message: 'Statistic created successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create statistic',
        timestamp: new Date(),
      };
    }
  }

  static async update(id: string, payload: Partial<StatItem>): Promise<ApiResponse<StatItem>> {
    try {
      const updated = await prisma.statItem.update({
        where: { id },
        data: {
          title: payload.title,
          value: payload.value,
          unit: payload.unit,
          order: payload.order,
        },
      });

      return {
        success: true,
        data: updated,
        message: 'Statistic updated successfully',
        timestamp: new Date(),
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return {
          success: false,
          error: 'Statistic not found',
          timestamp: new Date(),
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update statistic',
        timestamp: new Date(),
      };
    }
  }

  static async remove(id: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      await prisma.statItem.delete({ where: { id } });

      return {
        success: true,
        data: { success: true },
        message: 'Statistic deleted successfully',
        timestamp: new Date(),
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return {
          success: false,
          error: 'Statistic not found',
          timestamp: new Date(),
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete statistic',
        timestamp: new Date(),
      };
    }
  }
}
