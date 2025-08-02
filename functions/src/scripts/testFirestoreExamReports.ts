/**
 * Test script for Firestore exam report service
 * This script can be run to test the Firestore integration
 */

import { examReportFirestore } from '../services/firebase/examReportFirestore';
import logger from '../services/firebase/logger';

// Mock exam report data for testing
const mockExamReport = {
  exam_id: 'test_exam_123',
  overall_score: 85,
  total_questions: 20,
  correct_answers: 17,
  topic_performance: [
    {
      topic: 'IAM and Security',
      correct_answers: 5,
      total_attempts: 5,
      accuracy_rate: 1.0,
      difficulty_level: 'advanced' as const,
      performance_category: 'strong' as const,
    },
    {
      topic: 'Compute Engine',
      correct_answers: 3,
      total_attempts: 5,
      accuracy_rate: 0.6,
      difficulty_level: 'advanced' as const,
      performance_category: 'average' as const,
    },
  ],
  generated_at: new Date().toISOString(),
  text_summary: 'This is a test exam report for testing Firestore integration.',
};

const TEST_USER_ID = 'test_user_123';
const TEST_CERTIFICATION = 'AWS Cloud Practitioner';
const TEST_EXAM_ID = 'test_exam_123';

/**
 * Test the Firestore exam report service
 */
export async function testFirestoreExamReports(): Promise<void> {
  try {
    logger.info('FIRESTORE_TEST: Starting exam report service tests');

    // Test 1: Store exam report
    logger.info('FIRESTORE_TEST: Test 1 - Storing exam report');
    await examReportFirestore.storeExamReport(
      TEST_EXAM_ID,
      TEST_USER_ID,
      TEST_CERTIFICATION,
      mockExamReport,
    );
    logger.info('FIRESTORE_TEST: Test 1 - PASSED');

    // Test 2: Retrieve exam report
    logger.info('FIRESTORE_TEST: Test 2 - Retrieving exam report');
    const retrievedReport = await examReportFirestore.getExamReport(
      TEST_EXAM_ID,
    );

    if (!retrievedReport) {
      throw new Error('Report not found after storing');
    }

    if (retrievedReport.exam_id !== TEST_EXAM_ID) {
      throw new Error('Retrieved report has incorrect exam_id');
    }

    logger.info('FIRESTORE_TEST: Test 2 - PASSED');

    // Test 3: Check if report exists
    logger.info('FIRESTORE_TEST: Test 3 - Checking if report exists');
    const exists = await examReportFirestore.examReportExists(TEST_EXAM_ID);

    if (!exists) {
      throw new Error('Report existence check failed');
    }

    logger.info('FIRESTORE_TEST: Test 3 - PASSED');

    // Test 4: Get last exam report for user
    logger.info('FIRESTORE_TEST: Test 4 - Getting last exam report for user');
    const lastReport = await examReportFirestore.getLastExamReportForUser(
      TEST_USER_ID,
      TEST_CERTIFICATION,
    );

    if (!lastReport || lastReport.exam_id !== TEST_EXAM_ID) {
      throw new Error('Last exam report retrieval failed');
    }

    logger.info('FIRESTORE_TEST: Test 4 - PASSED');

    // Test 5: Update exam report
    logger.info('FIRESTORE_TEST: Test 5 - Updating exam report');
    await examReportFirestore.updateExamReport(TEST_EXAM_ID, {
      overall_score: 90,
      text_summary: 'Updated test summary',
    });

    const updatedReport = await examReportFirestore.getExamReport(TEST_EXAM_ID);
    if (!updatedReport || updatedReport.overall_score !== 90) {
      throw new Error('Report update failed');
    }

    logger.info('FIRESTORE_TEST: Test 5 - PASSED');

    // Test 6: Clean up - Delete exam report
    logger.info('FIRESTORE_TEST: Test 6 - Deleting exam report');
    await examReportFirestore.deleteExamReport(TEST_EXAM_ID);

    const deletedReport = await examReportFirestore.getExamReport(TEST_EXAM_ID);
    if (deletedReport) {
      throw new Error('Report deletion failed');
    }

    logger.info('FIRESTORE_TEST: Test 6 - PASSED');

    logger.info('FIRESTORE_TEST: All tests PASSED! ✅');
  } catch (error) {
    logger.error('FIRESTORE_TEST: Test FAILED! ❌', { error: error as any });

    // Clean up on error
    try {
      await examReportFirestore.deleteExamReport(TEST_EXAM_ID);
    } catch (cleanupError) {
      logger.warn('FIRESTORE_TEST: Cleanup failed', {
        error: cleanupError as any,
      });
    }

    throw error;
  }
}

/**
 * Run tests if this script is executed directly
 */
if (require.main === module) {
  testFirestoreExamReports()
    .then(() => {
      console.log('✅ All Firestore tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Tests failed:', error);
      process.exit(1);
    });
}
