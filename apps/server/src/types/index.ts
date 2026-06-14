/* Type definitions for the backend API */

export interface Donation {
  id: string;
  amount: number;
  donorName: string;
  donorEmail: string;
  message: string | null;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface StatItem {
  id: string;
  title: string;
  value: number;
  unit?: string | null;
  order?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface DonationRequest {
  amount: number;
  donorName: string;
  donorEmail: string;
  message?: string;
}

export interface ContactRequest {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Story {
  id: string;
  title: string;
  description: string;
  date: string;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: 'pending' | 'read' | 'replied';
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactInfo {
  phone: string;
  email: string;
  address: string;
  socialLinks: {
    facebook: string;
    instagram: string;
    whatsapp: string;
  };
  emergencyNumber: string;
  businessHours: {
    weekday: string;
    weekend: string;
  };
}

export interface Admin {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Donor {
  id: string;
  name: string;
  category: string;
  logo: string | null;
  createdAt: Date;
  updatedAt: Date;
}
