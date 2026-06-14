/* Types for the application */

export interface DonationData {
  amount: number;
  donorName: string;
  donorEmail: string;
  message?: string;
  timestamp: Date;
}

export interface BranchStatistics {
  volunteersCount: number;
  emergencyCalls: number;
  averageResponseTime: string;
}

export interface SurvivalStory {
  id: string;
  title: string;
  description: string;
  image?: string;
  date: Date;
}

export interface Donor {
  id: string;
  name: string;
  logo?: string;
}

export interface PageScrollContext {
  scrollY: number;
  isScrolling: boolean;
}
