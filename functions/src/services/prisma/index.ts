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

// Factory to create a new PrismaClient with optimized configuration for write performance
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: loggingLevels,
    // Optimized transaction settings for high-concurrency writes
    transactionOptions: {
      timeout: 15000, // 15 seconds for complex operations with batches
      maxWait: 8000, // 8 seconds max wait to handle concurrent load
      isolationLevel: 'ReadCommitted', // Optimal for concurrent writes, reduces locking
    },
    // Optimize connection pooling for write performance
    datasources: {
      db: {
        url:
          process.env.DATABASE_URL +
          '?connection_limit=20' + // Limit connections per instance
          '&pool_timeout=20' + // Pool timeout in seconds
          '&statement_timeout=30s' + // Statement timeout
          '&idle_timeout=300s' + // Idle connection timeout
          '&connect_timeout=10s', // Connection timeout
      },
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
