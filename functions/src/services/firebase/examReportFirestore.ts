/**
 * Firestore service for managing exam reports
 * Stores exam reports as structured JSON data in the "exam_reports" collection
 * Keyed on exam_id for easy retrieval
 */

import { firestoreService } from './firestore';
import logger from './logger';
import { StructuredExamReport } from '../../types/examReport';

export interface ExamReportDocument extends StructuredExamReport {
  id: string; // Firestore document ID (will be the exam_id)
  user_id: string;
  certification_name: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ExamReportFirestoreService {
  private static readonly COLLECTION_NAME = 'exam_reports';

  /**
   * Store an exam report in Firestore
   * @param examId - The exam ID to use as the document key
   * @param userId - User ID for ownership tracking
   * @param certificationName - Certification name for easy querying
   * @param reportData - The structured exam report data
   * @returns Promise<void>
   */
  static async storeExamReport(
    examId: string,
    userId: string,
    certificationName: string,
    reportData: StructuredExamReport,
  ): Promise<void> {
    try {
      const documentData: Omit<
        ExamReportDocument,
        'id' | 'createdAt' | 'updatedAt'
      > = {
        ...reportData,
        user_id: userId,
        certification_name: certificationName,
      };

      await firestoreService.create(
        this.COLLECTION_NAME,
        documentData,
        examId, // Use exam_id as the document ID
      );

      logger.info(`FIRESTORE_EXAM_REPORT_STORED: exam_id=${examId}`, {
        exam_id: examId,
        user_id: userId,
        certification: certificationName,
        topics_count: reportData.topic_performance.length,
        overall_score: reportData.overall_score,
        structuredData: true,
      });
    } catch (error) {
      logger.error(`FIRESTORE_EXAM_REPORT_STORE_ERROR: exam_id=${examId}`, {
        error,
        exam_id: examId,
        user_id: userId,
      });
      throw new Error(`Failed to store exam report in Firestore: ${error}`);
    }
  }

  /**
   * Retrieve an exam report from Firestore
   * @param examId - The exam ID
   * @returns Promise<ExamReportDocument | null>
   */
  static async getExamReport(
    examId: string,
  ): Promise<ExamReportDocument | null> {
    try {
      const report = await firestoreService.read<ExamReportDocument>(
        this.COLLECTION_NAME,
        examId,
      );

      if (report) {
        logger.info(`FIRESTORE_EXAM_REPORT_RETRIEVED: exam_id=${examId}`, {
          exam_id: examId,
          user_id: report.user_id,
          certification: report.certification_name,
          generated_at: report.generated_at,
        });
      }

      return report;
    } catch (error) {
      logger.error(`FIRESTORE_EXAM_REPORT_RETRIEVE_ERROR: exam_id=${examId}`, {
        error,
        exam_id: examId,
      });
      throw new Error(
        `Failed to retrieve exam report from Firestore: ${error}`,
      );
    }
  }

  /**
   * Update an existing exam report in Firestore
   * @param examId - The exam ID
   * @param reportData - The updated structured exam report data
   * @returns Promise<void>
   */
  static async updateExamReport(
    examId: string,
    reportData: Partial<StructuredExamReport>,
  ): Promise<void> {
    try {
      await firestoreService.update(this.COLLECTION_NAME, examId, reportData);

      logger.info(`FIRESTORE_EXAM_REPORT_UPDATED: exam_id=${examId}`, {
        exam_id: examId,
        updated_fields: Object.keys(reportData),
      });
    } catch (error) {
      logger.error(`FIRESTORE_EXAM_REPORT_UPDATE_ERROR: exam_id=${examId}`, {
        error,
        exam_id: examId,
      });
      throw new Error(`Failed to update exam report in Firestore: ${error}`);
    }
  }

  /**
   * Delete an exam report from Firestore
   * @param examId - The exam ID
   * @returns Promise<void>
   */
  static async deleteExamReport(examId: string): Promise<void> {
    try {
      await firestoreService.delete(this.COLLECTION_NAME, examId);

      logger.info(`FIRESTORE_EXAM_REPORT_DELETED: exam_id=${examId}`, {
        exam_id: examId,
      });
    } catch (error) {
      logger.error(`FIRESTORE_EXAM_REPORT_DELETE_ERROR: exam_id=${examId}`, {
        error,
        exam_id: examId,
      });
      throw new Error(`Failed to delete exam report from Firestore: ${error}`);
    }
  }

  /**
   * Get the most recent exam report for a user and certification
   * Used for adaptive learning to get previous performance data
   * @param userId - User ID
   * @param certificationName - Certification name
   * @returns Promise<ExamReportDocument | null>
   */
  static async getLastExamReportForUser(
    userId: string,
    certificationName: string,
  ): Promise<ExamReportDocument | null> {
    try {
      const reports = await firestoreService.list<ExamReportDocument>(
        this.COLLECTION_NAME,
        {
          where: [
            { field: 'user_id', operator: '==', value: userId },
            {
              field: 'certification_name',
              operator: '==',
              value: certificationName,
            },
          ],
          orderBy: [{ field: 'generated_at', direction: 'desc' }],
          limit: 1,
        },
      );

      const latestReport = reports.length > 0 ? reports[0] : null;

      if (latestReport) {
        logger.info(`FIRESTORE_LAST_EXAM_REPORT_FOUND: user_id=${userId}`, {
          user_id: userId,
          certification: certificationName,
          exam_id: latestReport.exam_id,
          generated_at: latestReport.generated_at,
          structuredData: true,
        });
      } else {
        logger.info(`FIRESTORE_NO_PREVIOUS_EXAM_REPORT: user_id=${userId}`, {
          user_id: userId,
          certification: certificationName,
        });
      }

      return latestReport;
    } catch (error) {
      logger.error(`FIRESTORE_LAST_EXAM_REPORT_ERROR: user_id=${userId}`, {
        error,
        user_id: userId,
        certification: certificationName,
      });
      throw new Error(
        `Failed to get last exam report from Firestore: ${error}`,
      );
    }
  }

  /**
   * Check if an exam report exists in Firestore
   * @param examId - The exam ID
   * @returns Promise<boolean>
   */
  static async examReportExists(examId: string): Promise<boolean> {
    try {
      const report = await this.getExamReport(examId);
      return report !== null;
    } catch (error) {
      logger.error(`FIRESTORE_EXAM_REPORT_EXISTS_ERROR: exam_id=${examId}`, {
        error,
        exam_id: examId,
      });
      return false;
    }
  }

  /**
   * Get all exam reports for a user (for analytics/history)
   * @param userId - User ID
   * @param limit - Optional limit for pagination
   * @returns Promise<ExamReportDocument[]>
   */
  static async getUserExamReports(
    userId: string,
    limit?: number,
  ): Promise<ExamReportDocument[]> {
    try {
      const reports = await firestoreService.list<ExamReportDocument>(
        this.COLLECTION_NAME,
        {
          where: [{ field: 'user_id', operator: '==', value: userId }],
          orderBy: [{ field: 'generated_at', direction: 'desc' }],
          limit,
        },
      );

      logger.info(`FIRESTORE_USER_EXAM_REPORTS_RETRIEVED: user_id=${userId}`, {
        user_id: userId,
        reports_count: reports.length,
      });

      return reports;
    } catch (error) {
      logger.error(`FIRESTORE_USER_EXAM_REPORTS_ERROR: user_id=${userId}`, {
        error,
        user_id: userId,
      });
      throw new Error(
        `Failed to get user exam reports from Firestore: ${error}`,
      );
    }
  }
}

// Export the service instance for easy importing
export const examReportFirestore = ExamReportFirestoreService;
