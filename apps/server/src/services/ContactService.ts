import { ContactMessage, ContactRequest, ApiResponse } from '../types/index';
import prisma from '../db/prisma';

export class ContactService {
  static async submitContactMessage(
    contactData: ContactRequest
  ): Promise<ApiResponse<ContactMessage>> {
    try {
      const message = await prisma.contactMessage.create({
        data: {
          name: contactData.name,
          email: contactData.email,
          phone: contactData.phone,
          subject: contactData.subject,
          message: contactData.message,
          status: 'pending',
        },
      });

      return {
        success: true,
        data: message as unknown as ContactMessage,
        message: 'Contact message received successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit contact message',
        timestamp: new Date(),
      };
    }
  }

  static async getContactMessages(): Promise<ApiResponse<ContactMessage[]>> {
    try {
      const messages = await prisma.contactMessage.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return {
        success: true,
        data: messages as unknown as ContactMessage[],
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch contact messages',
        timestamp: new Date(),
      };
    }
  }

  static async updateMessageStatus(
    id: string,
    status: 'pending' | 'read' | 'replied'
  ): Promise<ApiResponse<ContactMessage>> {
    try {
      const message = await prisma.contactMessage.update({
        where: { id },
        data: { status },
      });

      return {
        success: true,
        data: message as unknown as ContactMessage,
        message: 'Message status updated successfully',
        timestamp: new Date(),
      };
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as any).code === 'P2025'
      ) {
        return {
          success: false,
          error: 'Contact message not found',
          timestamp: new Date(),
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update message status',
        timestamp: new Date(),
      };
    }
  }

  static async deleteContactMessage(id: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      await prisma.contactMessage.delete({
        where: { id },
      });

      return {
        success: true,
        data: { success: true },
        message: 'Contact message deleted successfully',
        timestamp: new Date(),
      };
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as any).code === 'P2025'
      ) {
        return {
          success: false,
          error: 'Contact message not found',
          timestamp: new Date(),
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete contact message',
        timestamp: new Date(),
      };
    }
  }
}
