/**
 * Migration utility to move existing exam reports from Prisma to Firestore
 * This script helps migrate existing exam_report data from the ExamAttempt table
 * to the new Firestore collection structure.
 */

import logger from '../services/firebase/logger';
import prismaInstance from '../services/prisma';
import { examReportFirestore } from '../services/firebase/examReportFirestore';
import { parseStructuredReport } from '../types/examReport';

export class ExamReportMigration {
  /**
   * Migrate a single exam report from Prisma to Firestore
   * @param examId - The exam ID to migrate
   * @returns Promise<boolean> - Success status
   */
  static async migrateExamReport(examId: string): Promise<boolean> {
    try {
      // 1. Fetch exam with report from Prisma
      const exam = await prismaInstance.examAttempt.findUnique({
        where: { exam_id: examId },
        include: {
          user: {
            select: {
              user_id: true,
              firebase_user_id: true,
            },
          },
          certification: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!exam) {
        logger.warn(`MIGRATION_SKIP: Exam ${examId} not found`);
        return false;
      }

      if (!exam.exam_report) {
        logger.warn(`MIGRATION_SKIP: Exam ${examId} has no report to migrate`);
        return false;
      }

      if (!exam.submitted_at || exam.score === null) {
        logger.warn(`MIGRATION_SKIP: Exam ${examId} is not completed`);
        return false;
      }

      // 2. Check if report already exists in Firestore
      const existingFirestoreReport =
        await examReportFirestore.examReportExists(examId);
      if (existingFirestoreReport) {
        logger.info(
          `MIGRATION_SKIP: Report for exam ${examId} already exists in Firestore`,
        );
        return true;
      }

      // 3. Parse the existing report to extract structured data
      const structuredReport = parseStructuredReport(exam.exam_report);

      if (!structuredReport) {
        // If we can't parse structured data, create a basic structure
        logger.warn(
          `MIGRATION_BASIC: Creating basic structure for exam ${examId}`,
        );

        const basicStructuredReport = {
          exam_id: examId,
          overall_score: exam.score,
          total_questions: 0, // We'll need to count from answers if needed
          correct_answers: 0, // We'll need to count from answers if needed
          topic_performance: [], // Empty array for now
          generated_at: exam.submitted_at.toISOString(),
          text_summary: exam.exam_report, // Use the full report as text summary
        };

        await examReportFirestore.storeExamReport(
          examId,
          exam.user.user_id,
          exam.certification.name,
          basicStructuredReport,
        );
      } else {
        // Store the parsed structured report
        await examReportFirestore.storeExamReport(
          examId,
          exam.user.user_id,
          exam.certification.name,
          structuredReport,
        );
      }

      logger.info(`MIGRATION_SUCCESS: Migrated exam report for exam ${examId}`);
      return true;
    } catch (error) {
      logger.error(`MIGRATION_ERROR: Failed to migrate exam ${examId}:`, {
        error: error as any,
      });
      return false;
    }
  }

  /**
   * Migrate all exam reports from Prisma to Firestore
   * @param batchSize - Number of reports to process in each batch
   * @param dryRun - If true, only log what would be migrated without actually migrating
   * @returns Promise<{migrated: number, skipped: number, errors: number}>
   */
  static async migrateAllExamReports(
    batchSize: number = 50,
    dryRun: boolean = false,
  ): Promise<{ migrated: number; skipped: number; errors: number }> {
    logger.info(
      `MIGRATION_START: Starting exam report migration (dryRun: ${dryRun})`,
    );

    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    let offset = 0;

    try {
      while (true) {
        // Fetch a batch of exams with reports
        const exams = await prismaInstance.examAttempt.findMany({
          where: {
            exam_report: {
              not: null,
            },
            submitted_at: {
              not: null,
            },
            score: {
              not: null,
            },
          },
          select: {
            exam_id: true,
            user: {
              select: {
                user_id: true,
              },
            },
            certification: {
              select: {
                name: true,
              },
            },
            submitted_at: true,
            score: true,
          },
          skip: offset,
          take: batchSize,
          orderBy: {
            submitted_at: 'desc',
          },
        });

        if (exams.length === 0) {
          break; // No more exams to process
        }

        logger.info(
          `MIGRATION_BATCH: Processing batch of ${exams.length} exams (offset: ${offset})`,
        );

        // Process each exam in the batch
        for (const exam of exams) {
          if (dryRun) {
            logger.info(
              `MIGRATION_DRY_RUN: Would migrate exam ${exam.exam_id}`,
            );
            migrated++;
          } else {
            const success = await this.migrateExamReport(exam.exam_id);
            if (success) {
              migrated++;
            } else {
              const exists = await examReportFirestore.examReportExists(
                exam.exam_id,
              );
              if (exists) {
                skipped++;
              } else {
                errors++;
              }
            }
          }
        }

        offset += batchSize;

        // Add a small delay between batches to avoid overwhelming the services
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      logger.info(
        `MIGRATION_COMPLETE: Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`,
      );
      return { migrated, skipped, errors };
    } catch (error) {
      logger.error('MIGRATION_FATAL_ERROR:', { error: error as any });
      throw error;
    }
  }

  /**
   * Get migration status - compare reports in Prisma vs Firestore
   * @returns Promise<{prismaReports: number, firestoreReports: number, needMigration: number}>
   */
  static async getMigrationStatus(): Promise<{
    prismaReports: number;
    firestoreReports: number;
    needMigration: number;
  }> {
    try {
      // Count reports in Prisma
      const prismaReports = await prismaInstance.examAttempt.count({
        where: {
          exam_report: {
            not: null,
          },
          submitted_at: {
            not: null,
          },
          score: {
            not: null,
          },
        },
      });

      // Count reports in Firestore (this is an approximation since we don't have a direct count method)
      const firestoreReports = await this.countFirestoreReports();

      const needMigration = Math.max(0, prismaReports - firestoreReports);

      logger.info('MIGRATION_STATUS:', {
        prismaReports,
        firestoreReports,
        needMigration,
      });

      return {
        prismaReports,
        firestoreReports,
        needMigration,
      };
    } catch (error) {
      logger.error('MIGRATION_STATUS_ERROR:', { error: error as any });
      throw error;
    }
  }

  /**
   * Helper method to count Firestore reports
   * Note: This is a simplified implementation. In production, you might want to
   * maintain a counter in a separate document.
   */
  private static async countFirestoreReports(): Promise<number> {
    try {
      // For now, we'll return 0 as an estimate since counting all documents
      // in Firestore can be expensive. In a real implementation, you might:
      // 1. Maintain a counter document
      // 2. Use Firestore's count() aggregation query (when available)
      // 3. Sample and estimate based on time ranges

      logger.info(
        'FIRESTORE_COUNT: Using estimated count of 0 (implement proper counting if needed)',
      );
      return 0;
    } catch (error) {
      logger.warn(
        'FIRESTORE_COUNT_ERROR: Could not count Firestore reports, returning 0',
        { error },
      );
      return 0;
    }
  }
}

// Export for use in scripts or API endpoints
export const examReportMigration = ExamReportMigration;
