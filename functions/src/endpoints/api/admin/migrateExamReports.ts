/**
 * Administrative endpoint for migrating exam reports from Prisma to Firestore
 * GET /api/admin/migrate-exam-reports
 * POST /api/admin/migrate-exam-reports (starts migration)
 */

import { Request, Response } from 'express';
import logger from '../../../services/firebase/logger';
import { CustomRequest } from '../../../types';
import { examReportMigration } from '../../../utils/examReportMigration';

/**
 * GET /api/admin/migrate-exam-reports
 * Get migration status
 */
export const getMigrationStatus = async (
  req: Request | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    // Basic admin check - you may want to implement proper admin authentication
    const firebaseUserIdFromToken = (req as CustomRequest).firebase_user_info
      ?.uid;

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    logger.info('ADMIN_MIGRATION_STATUS: Getting migration status', {
      admin_user: firebaseUserIdFromToken,
    });

    const status = await examReportMigration.getMigrationStatus();

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    logger.error('ADMIN_MIGRATION_STATUS_ERROR:', { error: error as any });
    res.status(500).json({
      success: false,
      error: 'Failed to get migration status',
    });
  }
};

/**
 * POST /api/admin/migrate-exam-reports
 * Start migration process
 */
export const startMigration = async (
  req: Request | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const { batch_size = 50, dry_run = false } = req.body;

    // Basic admin check - you may want to implement proper admin authentication
    const firebaseUserIdFromToken = (req as CustomRequest).firebase_user_info
      ?.uid;

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    logger.info('ADMIN_MIGRATION_START: Starting exam report migration', {
      admin_user: firebaseUserIdFromToken,
      batch_size,
      dry_run,
    });

    // Run migration
    const result = await examReportMigration.migrateAllExamReports(
      batch_size,
      dry_run,
    );

    logger.info('ADMIN_MIGRATION_COMPLETE:', {
      admin_user: firebaseUserIdFromToken,
      result,
      dry_run,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: dry_run
        ? `Dry run complete. Would migrate ${result.migrated} reports`
        : `Migration complete. Migrated ${result.migrated} reports`,
    });
  } catch (error: any) {
    logger.error('ADMIN_MIGRATION_ERROR:', { error: error as any });
    res.status(500).json({
      success: false,
      error: 'Migration failed',
    });
  }
};

// Default export for endpoint routing
export default getMigrationStatus;
