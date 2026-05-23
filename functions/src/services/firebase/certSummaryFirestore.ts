/**
 * Firestore service for managing certification summaries
 * Stores cert summaries as structured JSON data in the Firestore collection
 * Path: users/[user_id]/certs/[cert_id]/summaries/cert_summary
 */

import { firestoreService } from './firestore';
import logger from './logger';
import prismaInstance from '../prisma';
import { examReportFirestore } from './examReportFirestore';

/**
 * Interface for Certification Summary structure
 */
export interface CertificationSummary {
  cert_id: string;
  user_id: string;
  certification_name: string;
  total_exams_taken: number;
  average_score: number;
  best_score: number;
  worst_score: number;
  total_questions_answered: number;
  total_correct_answers: number;
  overall_accuracy_rate: number;
  topic_mastery: TopicMastery[];
  performance_trend: 'improving' | 'declining' | 'stable';
  strengths: string[];
  areas_for_improvement: string[];
  generated_at: string;
  ai_summary: string;
}

export interface TopicMastery {
  topic: string;
  exams_covered: number;
  average_accuracy: number;
  mastery_level: 'novice' | 'developing' | 'proficient' | 'advanced' | 'expert';
  total_questions: number;
  total_correct: number;
}

export interface CertSummaryDocument extends CertificationSummary {
  id: string; // Firestore document ID
  createdAt: Date;
  updatedAt: Date;
}

export class CertSummaryPrerequisiteError extends Error {
  public readonly code = 'INSUFFICIENT_EXAM_REPORTS';
  public readonly status = 400;
  public readonly retriable = false;
  public readonly details: {
    required_reports: number;
    available_reports: number;
    cert_id: string;
  };

  constructor(details: {
    required_reports: number;
    available_reports: number;
    cert_id: string;
  }) {
    super('Certification summary requires at least 2 completed exam reports');
    this.name = 'CertSummaryPrerequisiteError';
    this.details = details;
    Object.setPrototypeOf(this, CertSummaryPrerequisiteError.prototype);
  }
}

/**
 * Core service function for generating certification summaries
 * Can be used both by API endpoint and internal service calls
 * Always regenerates based on latest exam reports, updating existing summaries
 */
export const generateCertSummary = async (
  user_id: string,
  cert_id: string,
  firebaseUserIdFromToken?: string,
  skipAuthCheck: boolean = false,
) => {
  try {
    logger.info(
      `CERT_SUMMARY_INIT: Starting cert summary generation for user_id=${user_id}, cert_id=${cert_id}`,
    );

    // 1. Fetch user and certification info for validation
    const [user, certification] = await Promise.all([
      prismaInstance.user.findUnique({
        where: { user_id },
        select: {
          user_id: true,
          firebase_user_id: true,
        },
      }),
      prismaInstance.certification.findUnique({
        where: { cert_id: parseInt(cert_id) },
        select: {
          cert_id: true,
          name: true,
        },
      }),
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    if (!certification) {
      throw new Error('Certification not found');
    }

    // 2. Verify user ownership (skip if internal service call)
    if (!skipAuthCheck && user.firebase_user_id !== firebaseUserIdFromToken) {
      throw new Error(
        'Access denied: You can only generate cert summaries for your own certifications',
      );
    }

    // 3. Get all exam reports for this user and certification from Firestore
    const examReports = await examReportFirestore.getUserExamReports(
      user_id,
      cert_id,
    );

    if (examReports.length < 2) {
      throw new CertSummaryPrerequisiteError({
        required_reports: 2,
        available_reports: examReports.length,
        cert_id,
      });
    }

    logger.info(
      `CERT_SUMMARY_REPORTS_FOUND: Found ${examReports.length} exam reports for user_id=${user_id}, cert_id=${cert_id}`,
    );

    // 4. Check if cert summary already exists in Firestore (for metadata only)
    let existingSummary = null;
    try {
      existingSummary = await CertSummaryFirestoreService.getCertSummary(
        user_id,
        cert_id,
      );
    } catch (error) {
      logger.warn(
        `CERT_SUMMARY_CHECK_EXISTING_FAILED: user_id=${user_id}, cert_id=${cert_id}`,
        { error },
      );
      // Continue with generation even if we can't check existing summary
    }

    // Always regenerate with latest exam reports - no early return
    logger.info(
      existingSummary
        ? `CERT_SUMMARY_UPDATE: Updating existing summary for user_id=${user_id}, cert_id=${cert_id}`
        : `CERT_SUMMARY_CREATE: Creating new summary for user_id=${user_id}, cert_id=${cert_id}`,
    );

    // 5. Analyze exam reports to generate summary data with validation
    if (!examReports || examReports.length === 0) {
      throw new Error('No exam reports found for analysis');
    }

    const scores = examReports
      .map((report) => report.overall_score)
      .filter((score) => typeof score === 'number' && !isNaN(score));

    if (scores.length === 0) {
      throw new Error('No valid scores found in exam reports');
    }

    const averageScore =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const bestScore = Math.max(...scores);
    const worstScore = Math.min(...scores);

    const totalQuestionsAnswered = examReports.reduce(
      (sum, report) => sum + (report.total_questions || 0),
      0,
    );
    const totalCorrectAnswers = examReports.reduce(
      (sum, report) => sum + (report.correct_answers || 0),
      0,
    );
    const overallAccuracyRate =
      totalQuestionsAnswered > 0
        ? totalCorrectAnswers / totalQuestionsAnswered
        : 0;

    // 6. Analyze topic mastery across all exam reports with error handling
    let topicMastery: TopicMastery[] = [];
    try {
      const topicMap = new Map<
        string,
        {
          examsCovered: number;
          totalQuestions: number;
          totalCorrect: number;
          accuracies: number[];
        }
      >();

      examReports.forEach((report) => {
        if (
          !report.topic_performance ||
          !Array.isArray(report.topic_performance)
        ) {
          logger.warn(
            `CERT_SUMMARY_INVALID_TOPIC_PERFORMANCE: user_id=${user_id}, cert_id=${cert_id}, exam_id=${report.exam_id}`,
          );
          return;
        }

        report.topic_performance.forEach((topic) => {
          if (!topic.topic || typeof topic.accuracy_rate !== 'number') {
            logger.warn(
              `CERT_SUMMARY_INVALID_TOPIC_DATA: user_id=${user_id}, cert_id=${cert_id}, topic=${topic.topic}`,
            );
            return;
          }

          const existing = topicMap.get(topic.topic) || {
            examsCovered: 0,
            totalQuestions: 0,
            totalCorrect: 0,
            accuracies: [],
          };

          existing.examsCovered += 1;
          existing.totalQuestions += topic.total_attempts || 0;
          existing.totalCorrect += topic.correct_answers || 0;
          existing.accuracies.push(topic.accuracy_rate);

          topicMap.set(topic.topic, existing);
        });
      });

      topicMastery = Array.from(topicMap.entries()).map(([topic, data]) => {
        const averageAccuracy =
          data.accuracies.length > 0
            ? data.accuracies.reduce((sum, acc) => sum + acc, 0) /
              data.accuracies.length
            : 0;

        let masteryLevel: TopicMastery['mastery_level'] = 'novice';
        if (averageAccuracy >= 0.9) masteryLevel = 'expert';
        else if (averageAccuracy >= 0.8) masteryLevel = 'advanced';
        else if (averageAccuracy >= 0.7) masteryLevel = 'proficient';
        else if (averageAccuracy >= 0.6) masteryLevel = 'developing';

        return {
          topic,
          exams_covered: data.examsCovered,
          average_accuracy: averageAccuracy,
          mastery_level: masteryLevel,
          total_questions: data.totalQuestions,
          total_correct: data.totalCorrect,
        };
      });

      logger.info(
        `CERT_SUMMARY_TOPIC_MASTERY_CALCULATED: user_id=${user_id}, cert_id=${cert_id}`,
        { topicsAnalyzed: topicMastery.length },
      );
    } catch (error) {
      logger.error(
        `CERT_SUMMARY_TOPIC_MASTERY_ERROR: user_id=${user_id}, cert_id=${cert_id}`,
        { error },
      );

      // Fallback to empty topic mastery if calculation fails
      topicMastery = [];
    }

    // 7. Determine performance trend with error handling
    let performanceTrend: CertificationSummary['performance_trend'] = 'stable';
    try {
      if (scores.length >= 2) {
        const firstHalfAvg =
          scores
            .slice(0, Math.ceil(scores.length / 2))
            .reduce((sum, score) => sum + score, 0) /
          Math.ceil(scores.length / 2);
        const secondHalfAvg =
          scores
            .slice(Math.floor(scores.length / 2))
            .reduce((sum, score) => sum + score, 0) /
          Math.ceil(scores.length / 2);

        const trendDifference = secondHalfAvg - firstHalfAvg;
        if (trendDifference > 5) performanceTrend = 'improving';
        else if (trendDifference < -5) performanceTrend = 'declining';
      }
    } catch (error) {
      logger.warn(
        `CERT_SUMMARY_TREND_CALCULATION_ERROR: user_id=${user_id}, cert_id=${cert_id}`,
        { error },
      );
      // performanceTrend remains 'stable' as fallback
    }

    // 8. Identify strengths and areas for improvement with error handling
    let strongTopics: string[] = [];
    let weakTopics: string[] = [];
    try {
      strongTopics = topicMastery
        .filter(
          (topic) =>
            topic.mastery_level === 'expert' ||
            topic.mastery_level === 'advanced',
        )
        .map((topic) => topic.topic);

      weakTopics = topicMastery
        .filter(
          (topic) =>
            topic.mastery_level === 'novice' ||
            topic.mastery_level === 'developing',
        )
        .map((topic) => topic.topic);
    } catch (error) {
      logger.warn(
        `CERT_SUMMARY_STRENGTHS_WEAKNESSES_ERROR: user_id=${user_id}, cert_id=${cert_id}`,
        { error },
      );
      // Arrays remain empty as fallback
    }

    // 9. Generate AI summary with error handling
    let generatedSummary = '';
    try {
      const { getCertSummaryGeneratorFlow } = await import(
        '../genkit/certSummaryGenerator.js'
      );
      const certSummaryGenerator = await getCertSummaryGeneratorFlow();

      const summaryInput = {
        user_id,
        cert_id,
        certification_name: certification.name,
        total_exams_taken: examReports.length,
        average_score: Math.round(averageScore),
        best_score: bestScore,
        worst_score: worstScore,
        performance_trend: performanceTrend,
        topic_mastery: topicMastery,
        strong_topics: strongTopics.slice(0, 5), // Top 5 strengths
        weak_topics: weakTopics.slice(0, 5), // Top 5 areas for improvement
        overall_accuracy_rate: overallAccuracyRate,
      };

      logger.info(
        `CERT_SUMMARY_AI_GENERATION_START: user_id=${user_id}, cert_id=${cert_id}`,
        { summaryInput },
      );

      const summaryResult = await certSummaryGenerator(summaryInput);

      if (!summaryResult || typeof summaryResult.summary !== 'string') {
        throw new Error(
          'AI generator returned invalid or empty summary result',
        );
      }

      generatedSummary = summaryResult.summary;

      logger.info(
        `CERT_SUMMARY_AI_GENERATION_SUCCESS: user_id=${user_id}, cert_id=${cert_id}`,
        { summaryLength: generatedSummary.length },
      );
    } catch (error) {
      logger.error(
        `CERT_SUMMARY_AI_GENERATION_ERROR: user_id=${user_id}, cert_id=${cert_id}`,
        { error },
      );

      // Fallback to a basic summary if AI generation fails
      generatedSummary = `Based on ${examReports.length} practice exams for ${
        certification.name
      }, you achieved an average score of ${Math.round(
        averageScore,
      )}% with a best score of ${bestScore}%. Your performance trend is ${performanceTrend}. Strong areas include: ${strongTopics
        .slice(0, 3)
        .join(', ')}. Areas for improvement: ${weakTopics
        .slice(0, 3)
        .join(', ')}.`;

      logger.info(
        `CERT_SUMMARY_FALLBACK_USED: user_id=${user_id}, cert_id=${cert_id}`,
        { fallbackSummaryLength: generatedSummary.length },
      );
    }

    // 10. Create structured cert summary
    const structuredSummary: CertificationSummary = {
      cert_id,
      user_id,
      certification_name: certification.name,
      total_exams_taken: examReports.length,
      average_score: Math.round(averageScore),
      best_score: bestScore,
      worst_score: worstScore,
      total_questions_answered: totalQuestionsAnswered,
      total_correct_answers: totalCorrectAnswers,
      overall_accuracy_rate: overallAccuracyRate,
      topic_mastery: topicMastery,
      performance_trend: performanceTrend,
      strengths: strongTopics,
      areas_for_improvement: weakTopics,
      generated_at: new Date().toISOString(),
      ai_summary: generatedSummary,
    };

    // 11. Store structured summary in Firestore with error handling
    try {
      await CertSummaryFirestoreService.storeCertSummary(
        user_id,
        cert_id,
        certification.name,
        structuredSummary,
      );

      logger.info(
        `CERT_SUMMARY_FIRESTORE_STORED: user_id=${user_id}, cert_id=${cert_id}`,
      );
    } catch (error) {
      logger.error(
        `CERT_SUMMARY_FIRESTORE_STORE_ERROR: user_id=${user_id}, cert_id=${cert_id}`,
        { error },
      );
      throw new Error(`Failed to store cert summary in Firestore: ${error}`);
    }

    logger.info(
      `CERT_SUMMARY_SUCCESS: Generated and saved cert summary for user_id=${user_id}, cert_id=${cert_id}`,
      {
        user_id,
        cert_id,
        certification: certification.name,
        total_exams: examReports.length,
        average_score: Math.round(averageScore),
        topics_analyzed: topicMastery.length,
        structuredData: true,
        storage: 'firestore',
      },
    );

    // 12. Return the generated summary data
    return {
      cert_id,
      user_id,
      summary: generatedSummary,
      structured_data: structuredSummary,
      already_existed: false,
      generated_at: structuredSummary.generated_at,
      summary_stats: {
        total_exams: examReports.length,
        average_score: Math.round(averageScore),
        best_score: bestScore,
        topics_mastered: topicMastery.length,
        performance_trend: performanceTrend,
        strengths_count: strongTopics.length,
        improvement_areas_count: weakTopics.length,
      },
    };
  } catch (error) {
    logger.error(
      `CERT_SUMMARY_SERVICE_ERROR: Error in cert summary generation for user_id=${user_id}, cert_id=${cert_id}`,
      {
        error,
        user_id,
        cert_id,
        errorMessage: (error as Error).message,
        errorStack: (error as Error).stack,
      },
    );

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Cert summary generation failed: Unknown error occurred');
  }
};

export class CertSummaryFirestoreService {
  /**
   * Build the collection path for cert summary storage
   * @param userId - User ID
   * @param certId - Certification ID
   * @returns Collection path for cert summary storage
   */
  private static buildCertSummaryPath(userId: string, certId: string): string {
    return `users/${userId}/certs/${certId}/summaries`;
  }

  /**
   * Store a cert summary in Firestore
   * @param userId - User ID for ownership tracking
   * @param certId - Certification ID for nested structure
   * @param certificationName - Certification name for easy querying
   * @param summaryData - The structured cert summary data
   * @returns Promise<void>
   */
  static async storeCertSummary(
    userId: string,
    certId: string,
    certificationName: string,
    summaryData: CertificationSummary,
  ): Promise<void> {
    try {
      const documentData: Omit<
        CertSummaryDocument,
        'id' | 'createdAt' | 'updatedAt'
      > = {
        ...summaryData,
      };

      const documentPath = this.buildCertSummaryPath(userId, certId);
      await firestoreService.create(
        documentPath,
        documentData,
        'cert_summary', // Use fixed document ID
      );

      logger.info(
        `FIRESTORE_CERT_SUMMARY_STORED: user_id=${userId}, cert_id=${certId}`,
        {
          user_id: userId,
          cert_id: certId,
          certification: certificationName,
          total_exams: summaryData.total_exams_taken,
          average_score: summaryData.average_score,
          topics_analyzed: summaryData.topic_mastery.length,
          structuredData: true,
          storage: 'firestore',
        },
      );
    } catch (error) {
      logger.error(
        `FIRESTORE_CERT_SUMMARY_STORE_ERROR: user_id=${userId}, cert_id=${certId}`,
        {
          error,
          user_id: userId,
          cert_id: certId,
        },
      );
      throw new Error(`Failed to store cert summary in Firestore: ${error}`);
    }
  }

  /**
   * Retrieve a cert summary from Firestore
   * @param userId - User ID
   * @param certId - Certification ID
   * @returns Promise<CertSummaryDocument | null>
   */
  static async getCertSummary(
    userId: string,
    certId: string,
  ): Promise<CertSummaryDocument | null> {
    try {
      const documentPath = this.buildCertSummaryPath(userId, certId);
      const summary = await firestoreService.read<CertSummaryDocument>(
        documentPath,
        'cert_summary',
      );

      if (summary) {
        logger.info(
          `FIRESTORE_CERT_SUMMARY_RETRIEVED: user_id=${userId}, cert_id=${certId}`,
          {
            user_id: userId,
            cert_id: certId,
            certification: summary.certification_name,
            generated_at: summary.generated_at,
          },
        );
      } else {
        logger.info(
          `FIRESTORE_CERT_SUMMARY_NOT_FOUND: user_id=${userId}, cert_id=${certId}`,
          {
            user_id: userId,
            cert_id: certId,
          },
        );
      }

      return summary;
    } catch (error) {
      logger.warn(
        `FIRESTORE_CERT_SUMMARY_RETRIEVE_ERROR: user_id=${userId}, cert_id=${certId}`,
        {
          error,
          user_id: userId,
          cert_id: certId,
        },
      );

      // Return null instead of throwing error to allow generation to continue
      // This handles cases where the document doesn't exist or there are permission issues
      return null;
    }
  }

  /**
   * Update an existing cert summary in Firestore
   * @param userId - User ID
   * @param certId - Certification ID
   * @param summaryData - The updated structured cert summary data
   * @returns Promise<void>
   */
  static async updateCertSummary(
    userId: string,
    certId: string,
    summaryData: Partial<CertificationSummary>,
  ): Promise<void> {
    try {
      const documentPath = this.buildCertSummaryPath(userId, certId);
      await firestoreService.update(documentPath, 'cert_summary', summaryData);

      logger.info(
        `FIRESTORE_CERT_SUMMARY_UPDATED: user_id=${userId}, cert_id=${certId}`,
        {
          user_id: userId,
          cert_id: certId,
          updated_fields: Object.keys(summaryData),
        },
      );
    } catch (error) {
      logger.error(
        `FIRESTORE_CERT_SUMMARY_UPDATE_ERROR: user_id=${userId}, cert_id=${certId}`,
        {
          error,
          user_id: userId,
          cert_id: certId,
        },
      );
      throw new Error(`Failed to update cert summary in Firestore: ${error}`);
    }
  }

  /**
   * Delete a cert summary from Firestore
   * @param userId - User ID
   * @param certId - Certification ID
   * @returns Promise<void>
   */
  static async deleteCertSummary(
    userId: string,
    certId: string,
  ): Promise<void> {
    try {
      const documentPath = this.buildCertSummaryPath(userId, certId);
      await firestoreService.delete(documentPath, 'cert_summary');

      logger.info(
        `FIRESTORE_CERT_SUMMARY_DELETED: user_id=${userId}, cert_id=${certId}`,
        {
          user_id: userId,
          cert_id: certId,
        },
      );
    } catch (error) {
      logger.error(
        `FIRESTORE_CERT_SUMMARY_DELETE_ERROR: user_id=${userId}, cert_id=${certId}`,
        {
          error,
          user_id: userId,
          cert_id: certId,
        },
      );
      throw new Error(`Failed to delete cert summary from Firestore: ${error}`);
    }
  }

  /**
   * Check if a cert summary exists in Firestore
   * @param userId - User ID
   * @param certId - Certification ID
   * @returns Promise<boolean>
   */
  static async certSummaryExists(
    userId: string,
    certId: string,
  ): Promise<boolean> {
    try {
      const summary = await this.getCertSummary(userId, certId);
      return summary !== null;
    } catch (error) {
      logger.error(
        `FIRESTORE_CERT_SUMMARY_EXISTS_ERROR: user_id=${userId}, cert_id=${certId}`,
        {
          error,
          user_id: userId,
          cert_id: certId,
        },
      );
      return false;
    }
  }
}

// Export the service instance for easy importing
export const certSummaryFirestore = CertSummaryFirestoreService;
