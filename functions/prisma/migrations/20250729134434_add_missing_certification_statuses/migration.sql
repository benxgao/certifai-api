-- Add missing CertificationStatus enum values that were in schema but never added to database
-- These values exist in the Prisma schema but were missing from the actual database enum

-- Add DELETING status
ALTER TYPE "CertificationStatus" ADD VALUE 'DELETING';

-- Add NOT_STARTED status
ALTER TYPE "CertificationStatus" ADD VALUE 'NOT_STARTED';

-- Add EXPIRED status
ALTER TYPE "CertificationStatus" ADD VALUE 'EXPIRED';

-- Note: PostgreSQL enum values are added at the end by default
-- The order will be: PASSED, IN_PROGRESS, INTERESTED, SUSPENDED, DELETING, NOT_STARTED, EXPIRED
-- This order doesn't affect functionality as enum values are compared by name, not position
