import { PrismaClient } from '@prisma/client';

const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL;

  if (!url || (!url.startsWith('postgresql://') && !url.startsWith('postgres://'))) {
    throw new Error('[Prisma] DATABASE_URL must be set to a valid PostgreSQL connection string');
  }

  return url;
};

let prismaInstance: PrismaClient | null = null;

export const getPrismaClient = (): PrismaClient => {
  if (!prismaInstance) {
    const url = getDatabaseUrl();

    process.env.DATABASE_URL = url;

    prismaInstance = new PrismaClient({
      log: ['error', 'warn'],
    });
  }

  return prismaInstance;
};

// Initialize immediately
const prisma = getPrismaClient();
export default prisma;
