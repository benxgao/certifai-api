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
        url: getOptimizedConnectionUrl(),
      },
    },
  });
}

// Helper function to build optimized connection URL for Supabase
function getOptimizedConnectionUrl(): string {
  const baseUrl = process.env.DATABASE_URL;

  if (!baseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Parse the existing URL to check if it already has parameters
  const url = new URL(baseUrl);

  // Supabase-optimized connection parameters
  const supabaseParams: Record<string, string> = {
    // Connection pooling settings for Supabase
    connection_limit: '10', // Lower limit for Supabase pooling
    pool_timeout: '20', // Pool timeout in seconds
    statement_timeout: '30000', // 30 seconds in milliseconds (Supabase format)
    idle_timeout: '300', // 5 minutes idle timeout
    connect_timeout: '10', // 10 seconds connection timeout
    application_name: 'certifai-api',
  };

  // Check if this is a Supabase pooled connection
  const isSupabasePooled = baseUrl.includes('pooler.supabase.com');

  if (isSupabasePooled) {
    // For Supabase pooled connections, ensure pgbouncer is enabled
    supabaseParams['pgbouncer'] = 'true';
    // Reduce connection limit for pooled connections
    supabaseParams['connection_limit'] = '5';
  }

  // Add parameters to the URL
  Object.entries(supabaseParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
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
