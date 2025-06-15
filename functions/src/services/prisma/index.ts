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

// Logging configuration for Prisma client
const loggingLevels: Array<'query' | 'info' | 'warn' | 'error'> = [
  'query',
  'info',
  'warn',
  'error',
];

// Factory to create a new PrismaClient with predefined logging
function createPrismaClient(): PrismaClient {
  return new PrismaClient({ log: loggingLevels });
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
