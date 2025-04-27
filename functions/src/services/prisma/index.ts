// import { PrismaClient } from '@prisma/client';
import { PrismaClient } from '../../../src/generated/prisma/client';

// Extend the NodeJS global type to allow for the prisma instance
// This prevents multiple instances during development with hot-reloading.
const globalWithPrisma = global as typeof globalThis & {
  prisma?: PrismaClient;
};

// Initialize Prisma Client - use existing instance if available (singleton pattern)
export const prisma =
  globalWithPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'info', 'warn', 'error'], // Configure logging levels
  });

// In development, store the prisma instance globally to prevent creating new instances on hot reloads.
if (process.env.NODE_ENV !== 'production') globalWithPrisma.prisma = prisma;

export default prisma;
