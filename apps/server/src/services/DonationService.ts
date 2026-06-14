import { Donation, DonationRequest, ApiResponse } from '../types/index';
import prisma from '../db/prisma';

export class DonationService {
  static async createDonation(donationData: DonationRequest): Promise<ApiResponse<Donation>> {
    try {
      const donation = await prisma.donation.create({
        data: {
          amount: donationData.amount,
          donorName: donationData.donorName,
          donorEmail: donationData.donorEmail,
          message: donationData.message,
          status: 'completed',
        },
      });

      return {
        success: true,
        data: donation as Donation,
        message: 'Donation received successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process donation',
        timestamp: new Date(),
      };
    }
  }

  static async getDonations(): Promise<ApiResponse<Donation[]>> {
    try {
      const donations = await prisma.donation.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return {
        success: true,
        data: donations as Donation[],
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch donations',
        timestamp: new Date(),
      };
    }
  }

  static async getDonationStats(): Promise<
    ApiResponse<{ totalDonations: number; totalAmount: number }>
  > {
    try {
      const donations = await prisma.donation.findMany();
      const totalDonations = donations.length;
      const totalAmount = donations.reduce((sum, donation) => {
        return sum + donation.amount;
      }, 0);

      return {
        success: true,
        data: {
          totalDonations,
          totalAmount,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch donation stats',
        timestamp: new Date(),
      };
    }
  }

  static async updateDonation(
    id: string,
    updates: Partial<Donation>
  ): Promise<ApiResponse<Donation>> {
    try {
      const updatedDonation = await prisma.donation.update({
        where: { id },
        data: updates,
      });

      return {
        success: true,
        data: updatedDonation as Donation,
        message: 'Donation updated successfully',
        timestamp: new Date(),
      };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        return {
          success: false,
          error: 'Donation not found',
          timestamp: new Date(),
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update donation',
        timestamp: new Date(),
      };
    }
  }

  static async deleteDonation(id: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      await prisma.donation.delete({
        where: { id },
      });

      return {
        success: true,
        data: { success: true },
        message: 'Donation deleted successfully',
        timestamp: new Date(),
      };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        return {
          success: false,
          error: 'Donation not found',
          timestamp: new Date(),
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete donation',
        timestamp: new Date(),
      };
    }
  }
}
