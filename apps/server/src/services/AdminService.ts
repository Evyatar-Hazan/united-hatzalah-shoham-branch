import {
  GalleryItem,
  Story,
  StatItem,
  ContactMessage,
  ApiResponse,
  Admin,
  Donation,
  Donor,
} from '../types/index';
import { MediaService } from './MediaService';
import { StatisticsService } from './StatisticsService';
import { ContactService } from './ContactService';
import { AuthService } from './AuthService';
import { DonationService } from './DonationService';
import { DonorsService } from './DonorsService';

export class AdminService {
  // Gallery operations
  static async getGallery(): Promise<ApiResponse<GalleryItem[]>> {
    return MediaService.getGalleryItems();
  }

  static async addGalleryItem(
    item: Omit<GalleryItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<GalleryItem>> {
    return MediaService.addGalleryItem(item);
  }

  static async updateGalleryItem(
    id: string,
    updates: Partial<GalleryItem>
  ): Promise<ApiResponse<GalleryItem>> {
    return MediaService.updateGalleryItem(id, updates);
  }

  static async deleteGalleryItem(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return MediaService.deleteGalleryItem(id);
  }

  // Stories operations
  static async getStories(): Promise<ApiResponse<Story[]>> {
    return MediaService.getStories();
  }

  static async addStory(
    story: Omit<Story, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Story>> {
    return MediaService.addStory(story);
  }

  static async updateStory(id: string, updates: Partial<Story>): Promise<ApiResponse<Story>> {
    return MediaService.updateStory(id, updates);
  }

  static async deleteStory(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return MediaService.deleteStory(id);
  }

  // Statistics operations
  static async getStatItems(): Promise<ApiResponse<StatItem[]>> {
    return StatisticsService.list();
  }

  static async addStatItem(
    item: Omit<StatItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<StatItem>> {
    return StatisticsService.create(item);
  }

  static async updateStatItem(
    id: string,
    updates: Partial<StatItem>
  ): Promise<ApiResponse<StatItem>> {
    return StatisticsService.update(id, updates);
  }

  static async deleteStatItem(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return StatisticsService.remove(id);
  }

  // Contact Info operations
  // Contact Info methods removed in Prisma refactor

  // Contact Messages
  static async getContactMessages(): Promise<ApiResponse<ContactMessage[]>> {
    return ContactService.getContactMessages();
  }
  // Admin Management operations
  static async getAdmins(): Promise<ApiResponse<Admin[]>> {
    return AuthService.getAdmins();
  }

  static async addAdmin(adminData: {
    email: string;
    name: string;
    picture?: string;
  }): Promise<ApiResponse<Admin>> {
    return AuthService.findOrCreateAdmin(adminData.email, adminData.name, adminData.picture);
  }

  static async updateAdmin(id: string, updates: Partial<Admin>): Promise<ApiResponse<Admin>> {
    return AuthService.updateAdmin(id, updates);
  }

  static async deleteAdmin(
    id: string,
    currentUserId?: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    const res = await AuthService.deactivateAdmin(id, currentUserId);
    return res;
  }

  // Donation Management operations
  static async getDonations(): Promise<ApiResponse<Donation[]>> {
    return DonationService.getDonations();
  }

  static async updateDonation(
    id: string,
    updates: Partial<Donation>
  ): Promise<ApiResponse<Donation>> {
    return DonationService.updateDonation(id, updates);
  }

  static async deleteDonation(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return DonationService.deleteDonation(id);
  }

  // Donors (תורמים וחסויות) Management operations
  static async getDonors(): Promise<ApiResponse<Donor[]>> {
    return DonorsService.getDonors();
  }

  static async addDonor(
    name: string,
    category: string,
    logo?: string
  ): Promise<ApiResponse<Donor>> {
    return DonorsService.addDonor(name, category, logo);
  }

  static async updateDonor(id: string, updates: Partial<Donor>): Promise<ApiResponse<Donor>> {
    return DonorsService.updateDonor(id, updates);
  }

  static async deleteDonor(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return DonorsService.deleteDonor(id);
  }
}
