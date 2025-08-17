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
  /**
   * Build the path for exam reports collection
   * @param userId - User ID
   * @param certId - Certification ID
   * @returns Collection path for exam reports
   */
  private static buildExamReportsPath(userId: string, certId: string): string {
    return `users/${userId}/certs/${certId}/exam_reports`;
  }

  /**
   * Store an exam report in Firestore
   * @param examId - The exam ID to use as the document key
   * @param userId - User ID for ownership tracking
   * @param certId - Certification ID for nested structure
   * @param certificationName - Certification name for easy querying
   * @param reportData - The structured exam report data
   * @returns Promise<void>
   */
  static async storeExamReport(
    examId: string,
    userId: string,
    certId: string,
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

      const collectionPath = this.buildExamReportsPath(userId, certId);
      await firestoreService.create(
        collectionPath,
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
   * @param userId - User ID for the nested path
   * @param certId - Certification ID for the nested path
   * @returns Promise<ExamReportDocument | null>
   */
  static async getExamReport(
    examId: string,
    userId: string,
    certId: string,
  ): Promise<ExamReportDocument | null> {
    try {
      const collectionPath = this.buildExamReportsPath(userId, certId);
      const report = await firestoreService.read<ExamReportDocument>(
        collectionPath,
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
   * @param userId - User ID for the nested path
   * @param certId - Certification ID for the nested path
   * @param reportData - The updated structured exam report data
   * @returns Promise<void>
   */
  static async updateExamReport(
    examId: string,
    userId: string,
    certId: string,
    reportData: Partial<StructuredExamReport>,
  ): Promise<void> {
    try {
      const collectionPath = this.buildExamReportsPath(userId, certId);
      await firestoreService.update(collectionPath, examId, reportData);

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
   * @param userId - User ID for the nested path
   * @param certId - Certification ID for the nested path
   * @returns Promise<void>
   */
  static async deleteExamReport(
    examId: string,
    userId: string,
    certId: string,
  ): Promise<void> {
    try {
      const collectionPath = this.buildExamReportsPath(userId, certId);
      await firestoreService.delete(collectionPath, examId);

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
   * @param certId - Certification ID for the nested path
   * @param certificationName - Certification name (optional, for filtering)
   * @returns Promise<ExamReportDocument | null>
   */
  static async getLastExamReportForUser(
    userId: string,
    certId: string,
    certificationName?: string,
  ): Promise<ExamReportDocument | null> {
    try {
      const collectionPath = this.buildExamReportsPath(userId, certId);

      // Since documents are nested under users/{userId}/certs/{certId}/exam_reports,
      // we don't need to filter by user_id - it's already scoped to the user
      const whereFilters: Array<{ field: string; operator: any; value: any }> =
        [];

      // Add certification name filter if provided
      if (certificationName) {
        whereFilters.push({
          field: 'certification_name',
          operator: '==',
          value: certificationName,
        });
      }

      const queryOptions: any = {
        orderBy: [{ field: 'generated_at', direction: 'desc' }],
        limit: 1,
      };

      // Only add where clause if there are filters
      if (whereFilters.length > 0) {
        queryOptions.where = whereFilters;
      }

      const reports = await firestoreService.list<ExamReportDocument>(
        collectionPath,
        queryOptions,
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
      // Try a simpler query without ordering if the complex one fails (index error)
      if (
        (error as any).code === 9 ||
        (error as any).message?.includes('index')
      ) {
        logger.warn(
          `FIRESTORE_LAST_EXAM_REPORT_INDEX_ERROR: user_id=${userId}, certification=${certificationName}, trying simple query`,
          { error },
        );

        try {
          const collectionPath = this.buildExamReportsPath(userId, certId);

          // Query without ordering to avoid index requirements
          const queryOptions: any = {
            limit: 50, // Get more documents to sort manually
          };

          // Add certification name filter if provided
          if (certificationName) {
            queryOptions.where = [
              {
                field: 'certification_name',
                operator: '==',
                value: certificationName,
              },
            ];
          }

          const reports = await firestoreService.list<ExamReportDocument>(
            collectionPath,
            queryOptions,
          );

          // Sort manually by generated_at and get the latest one
          const sortedReports = reports.sort(
            (a, b) =>
              new Date(b.generated_at).getTime() -
              new Date(a.generated_at).getTime(),
          );

          const latestReport =
            sortedReports.length > 0 ? sortedReports[0] : null;

          if (latestReport) {
            logger.info(
              `FIRESTORE_LAST_EXAM_REPORT_SIMPLE_QUERY_SUCCESS: user_id=${userId}`,
              {
                user_id: userId,
                certification: certificationName,
                exam_id: latestReport.exam_id,
                generated_at: latestReport.generated_at,
                structuredData: true,
                fallback_query: true,
              },
            );
          } else {
            logger.info(
              `FIRESTORE_NO_PREVIOUS_EXAM_REPORT_SIMPLE_QUERY: user_id=${userId}`,
              {
                user_id: userId,
                certification: certificationName,
                fallback_query: true,
              },
            );
          }

          return latestReport;
        } catch (fallbackError) {
          logger.error(
            `FIRESTORE_LAST_EXAM_REPORT_FALLBACK_ERROR: user_id=${userId}`,
            {
              originalError: error,
              fallbackError,
              user_id: userId,
              certification: certificationName,
            },
          );
          throw new Error(
            `Failed to get last exam report from Firestore: ${fallbackError}`,
          );
        }
      }

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
   * @param userId - User ID for the nested path
   * @param certId - Certification ID for the nested path
   * @returns Promise<boolean>
   */
  static async examReportExists(
    examId: string,
    userId: string,
    certId: string,
  ): Promise<boolean> {
    try {
      const report = await this.getExamReport(examId, userId, certId);
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
   * Get all exam reports for a user and specific certification (for analytics/history)
   * @param userId - User ID
   * @param certId - Certification ID for the nested path
   * @param limit - Optional limit for pagination
   * @returns Promise<ExamReportDocument[]>
   */
  static async getUserExamReports(
    userId: string,
    certId: string,
    limit?: number,
  ): Promise<ExamReportDocument[]> {
    try {
      const collectionPath = this.buildExamReportsPath(userId, certId);

      logger.info(
        `FIRESTORE_USER_EXAM_REPORTS_REQUEST: user_id=${userId}, cert_id=${certId}`,
        { collectionPath, limit },
      );

      // Since documents are nested under users/{userId}/certs/{certId}/exam_reports,
      // we don't need to filter by user_id - it's already scoped to the user
      const reports = await firestoreService.list<ExamReportDocument>(
        collectionPath,
        {
          orderBy: [{ field: 'generated_at', direction: 'desc' }],
          limit,
        },
      );

      logger.info(
        `FIRESTORE_USER_EXAM_REPORTS_RETRIEVED: user_id=${userId}, cert_id=${certId}`,
        {
          user_id: userId,
          cert_id: certId,
          reports_count: reports.length,
        },
      );

      return reports;
    } catch (error) {
      // Try a simpler query without ordering if the complex one fails
      if (
        (error as any).code === 9 ||
        (error as any).message?.includes('index')
      ) {
        logger.warn(
          `FIRESTORE_USER_EXAM_REPORTS_INDEX_ERROR: user_id=${userId}, cert_id=${certId}, trying simple query`,
          { error },
        );

        try {
          const collectionPath = this.buildExamReportsPath(userId, certId);
          const reports = await firestoreService.list<ExamReportDocument>(
            collectionPath,
            {
              limit,
            },
          );

          logger.info(
            `FIRESTORE_USER_EXAM_REPORTS_SIMPLE_QUERY_SUCCESS: user_id=${userId}, cert_id=${certId}`,
            {
              user_id: userId,
              cert_id: certId,
              reports_count: reports.length,
            },
          );

          // Sort manually since we couldn't do it in the query
          return reports.sort(
            (a, b) =>
              new Date(b.generated_at).getTime() -
              new Date(a.generated_at).getTime(),
          );
        } catch (fallbackError) {
          logger.error(
            `FIRESTORE_USER_EXAM_REPORTS_FALLBACK_ERROR: user_id=${userId}, cert_id=${certId}`,
            {
              originalError: error,
              fallbackError,
              user_id: userId,
              cert_id: certId,
            },
          );
          throw new Error(
            `Failed to get user exam reports from Firestore: ${fallbackError}`,
          );
        }
      }

      logger.error(
        `FIRESTORE_USER_EXAM_REPORTS_ERROR: user_id=${userId}, cert_id=${certId}`,
        {
          error,
          user_id: userId,
          cert_id: certId,
        },
      );
      throw new Error(
        `Failed to get user exam reports from Firestore: ${error}`,
      );
    }
  }
}

// Export the service instance for easy importing
export const examReportFirestore = ExamReportFirestoreService;
