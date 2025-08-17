/**
 * Test script for automatic exam report generation
 * This script verifies that exam reports are automatically generated when exams are submitted
 */

import logger from '../services/firebase/logger';
import prismaInstance from '../services/prisma';
import { examReportFirestore } from '../services/firebase/examReportFirestore';

interface TestExamData {
  exam_id: string;
  user_id: string;
  cert_id: string;
  certification_name: string;
}

/**
 * Test automatic exam report generation for a completed exam
 * @param examId - The exam ID to test
 */
export async function testAutomaticExamReportGeneration(
  examId: string,
): Promise<void> {
  try {
    logger.info(
      'AUTOMATIC_REPORT_TEST: Starting test for automatic exam report generation',
    );

    // 1. Fetch exam details
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
            cert_id: true,
            name: true,
          },
        },
      },
    });

    if (!exam) {
      throw new Error(`Exam not found: ${examId}`);
    }

    if (!exam.submitted_at) {
      throw new Error(`Exam not submitted yet: ${examId}`);
    }

    const testData: TestExamData = {
      exam_id: exam.exam_id,
      user_id: exam.user.user_id,
      cert_id: exam.certification.cert_id.toString(),
      certification_name: exam.certification.name,
    };

    logger.info('AUTOMATIC_REPORT_TEST: Exam details retrieved', {
      exam_id: testData.exam_id,
      user_id: testData.user_id,
      cert_id: testData.cert_id,
      certification: testData.certification_name,
      submitted_at: exam.submitted_at,
      score: exam.score,
    });

    // 2. Check if report already exists in Firestore
    const existingReport = await examReportFirestore.getExamReport(
      testData.exam_id,
      testData.user_id,
      testData.cert_id,
    );

    if (existingReport) {
      logger.info('AUTOMATIC_REPORT_TEST: ✅ Report found in Firestore', {
        exam_id: testData.exam_id,
        report_generated_at: existingReport.generated_at,
        overall_score: existingReport.overall_score,
        topics_analyzed: existingReport.topic_performance.length,
        storage_location: 'firestore',
        test_result: 'PASS',
      });
    } else {
      logger.warn('AUTOMATIC_REPORT_TEST: ❌ No report found in Firestore', {
        exam_id: testData.exam_id,
        test_result: 'FAIL',
        recommendation:
          'Check if automatic report generation is working correctly',
      });
    }

    // 3. Verify report structure if it exists
    if (existingReport) {
      const requiredFields = [
        'exam_id',
        'overall_score',
        'total_questions',
        'correct_answers',
        'topic_performance',
        'generated_at',
        'text_summary',
      ];

      const missingFields = requiredFields.filter(
        (field) => !(field in existingReport),
      );

      if (missingFields.length === 0) {
        logger.info('AUTOMATIC_REPORT_TEST: ✅ Report structure is valid', {
          exam_id: testData.exam_id,
          all_required_fields_present: true,
          test_result: 'PASS',
        });
      } else {
        logger.error('AUTOMATIC_REPORT_TEST: ❌ Report structure is invalid', {
          exam_id: testData.exam_id,
          missing_fields: missingFields,
          test_result: 'FAIL',
        });
      }
    }

    logger.info('AUTOMATIC_REPORT_TEST: Test completed');
  } catch (error) {
    logger.error('AUTOMATIC_REPORT_TEST: Test failed', {
      error: error as any,
      exam_id: examId,
    });
    throw error;
  }
}

/**
 * Test multiple exams for automatic report generation
 * @param examIds - Array of exam IDs to test
 */
export async function testMultipleExamReports(
  examIds: string[],
): Promise<void> {
  logger.info('AUTOMATIC_REPORT_TEST: Testing multiple exams', {
    exam_count: examIds.length,
    exam_ids: examIds,
  });

  const results = {
    total: examIds.length,
    passed: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const examId of examIds) {
    try {
      await testAutomaticExamReportGeneration(examId);
      results.passed++;
    } catch (error) {
      results.failed++;
      results.errors.push(`${examId}: ${(error as Error).message}`);
    }
  }

  logger.info('AUTOMATIC_REPORT_TEST: Batch test results', {
    total_exams: results.total,
    passed: results.passed,
    failed: results.failed,
    success_rate: `${Math.round((results.passed / results.total) * 100)}%`,
    errors: results.errors,
  });
}

/**
 * Find recently submitted exams for testing
 * @param limit - Number of exams to find
 * @returns Array of exam IDs
 */
export async function findRecentlySubmittedExams(
  limit: number = 5,
): Promise<string[]> {
  try {
    const recentExams = await prismaInstance.examAttempt.findMany({
      where: {
        submitted_at: {
          not: null,
        },
        score: {
          not: null,
        },
      },
      select: {
        exam_id: true,
        submitted_at: true,
        user_id: true,
      },
      orderBy: {
        submitted_at: 'desc',
      },
      take: limit,
    });

    const examIds = recentExams.map((exam) => exam.exam_id);

    logger.info('AUTOMATIC_REPORT_TEST: Found recently submitted exams', {
      count: examIds.length,
      exam_ids: examIds,
    });

    return examIds;
  } catch (error) {
    logger.error('AUTOMATIC_REPORT_TEST: Failed to find recent exams', {
      error: error as any,
    });
    throw error;
  }
}

// Example usage - uncomment to run tests
/*
async function runTests() {
  try {
    // Test specific exam
    await testAutomaticExamReportGeneration('your-exam-id-here');

    // Or test recent exams
    const recentExamIds = await findRecentlySubmittedExams(3);
    if (recentExamIds.length > 0) {
      await testMultipleExamReports(recentExamIds);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Uncomment to run
// runTests();
*/
