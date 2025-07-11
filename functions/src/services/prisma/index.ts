import {
  PrismaClient,
  CertificationStatus,
  ExamStatus,
  DifficultyLevel,
} from '../../../src/generated/prisma/client';

// Declare prisma on global to maintain a singleton across hot-reloads in development
declare global {
  var prisma: PrismaClient | undefined;
}

// Optimized logging configuration for Prisma client (reduced for performance)
const loggingLevels: Array<'warn' | 'error'> = ['warn', 'error'];

// Factory to create a new PrismaClient with optimized configuration
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: loggingLevels,
    // Optimize transaction settings for better performance
    transactionOptions: {
      timeout: 5000, // 5 seconds timeout
      maxWait: 3000, // 3 seconds max wait
    },
  });
}

// Use existing client or create a new one (singleton)
export const prisma: PrismaClient = global.prisma ?? createPrismaClient();

// In non-production environments, store the client globally to prevent duplicates
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Re-export enums for consistency
export { CertificationStatus, ExamStatus, DifficultyLevel };

// Default export of the Prisma client
export default prisma;

// import {
//   PrismaClient,
//   CertificationStatus,
//   ExamStatus,
// } from '../../../src/generated/prisma/client';

// const globalWithPrisma = global as typeof globalThis & {
//   prisma?: PrismaClient;
// };

// export const prisma =
//   globalWithPrisma.prisma ??
//   new PrismaClient({
//     log: ['query', 'info', 'warn', 'error'], // Configure logging levels
//   });

// if (process.env.NODE_ENV !== 'production') globalWithPrisma.prisma = prisma;

// export { CertificationStatus, ExamStatus };

// export default prisma;
