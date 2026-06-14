import { Donor, ApiResponse } from '../types/index';
import prisma from '../db/prisma';

export class DonorsService {
  static async getDonors(): Promise<ApiResponse<Donor[]>> {
    try {
      const donors = await prisma.donor.findMany();
      return {
        success: true,
        data: donors,
        message: 'Donors fetched successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch donors',
        timestamp: new Date(),
      };
    }
  }

  static async addDonor(
    name: string,
    category: string,
    logo?: string
  ): Promise<ApiResponse<Donor>> {
    try {
      if (!name || !category) {
        return {
          success: false,
          error: 'Name and category are required',
          timestamp: new Date(),
        };
      }

      const newDonor = await prisma.donor.create({
        data: {
          name,
          category,
          logo: logo || '',
        },
      });

      return {
        success: true,
        data: newDonor,
        message: 'Donor added successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add donor',
        timestamp: new Date(),
      };
    }
  }

  static async updateDonor(id: string, updates: Partial<Donor>): Promise<ApiResponse<Donor>> {
    try {
      const updatedDonor = await prisma.donor.update({
        where: { id },
        data: updates,
      });

      return {
        success: true,
        data: updatedDonor,
        message: 'Donor updated successfully',
        timestamp: new Date(),
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return {
          success: false,
          error: 'Donor not found',
          timestamp: new Date(),
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update donor',
        timestamp: new Date(),
      };
    }
  }

  static async deleteDonor(id: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      await prisma.donor.delete({
        where: { id },
      });

      return {
        success: true,
        data: { success: true },
        message: 'Donor deleted successfully',
        timestamp: new Date(),
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return {
          success: false,
          error: 'Donor not found',
          timestamp: new Date(),
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete donor',
        timestamp: new Date(),
      };
    }
  }
}
