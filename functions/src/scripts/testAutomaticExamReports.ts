/**
 * Test script for automatic exam report generation
 * This script verifies that exam reports are automatically generated when exams are submitted
 */

import logger from '../services/firebase/logger';
import prismaInstance, { ExamStatus } from '../services/prisma';
import { examReportFirestore } from '../services/firebase/examReportFirestore';
import { ExamReportTaskService } from '../services/cloudTasks/examReportTaskService';

interface TestExamData {
  exam_id: string;
  user_id: string;
  cert_id: string;
  certification_name: string;
}

interface MissingExamReportRecord {
  exam_id: string;
  user_id: string;
  cert_id: string;
  certification_name: string;
  submitted_at: string;
}

interface BackfillOptions {
  mode: 'dry-run' | 'execute';
  limit: number;
  batchSize: number;
  batchDelaySeconds: number;
}

interface ParsedCliArgs {
  mode: 'dry-run' | 'execute';
  limit: number;
  batchSize: number;
  batchDelaySeconds: number;
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

/**
 * Find completed exams that do not have a corresponding Firestore exam report.
 * This is Phase 2.1 discovery support for hotfix backfill.
 */
export async function discoverCompletedExamsMissingFirestoreReports(
  limit: number = 500,
): Promise<MissingExamReportRecord[]> {
  logger.info('AUTOMATIC_REPORT_BACKFILL: Starting missing-report discovery', {
    limit,
    target_exam_status: ExamStatus.COMPLETED,
  });

  const completedExams = await prismaInstance.examAttempt.findMany({
    where: {
      exam_status: ExamStatus.COMPLETED,
      submitted_at: { not: null },
    },
    select: {
      exam_id: true,
      user_id: true,
      cert_id: true,
      submitted_at: true,
      certification: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      submitted_at: 'desc',
    },
    take: limit,
  });

  const missingReports: MissingExamReportRecord[] = [];
  const firestoreLookupFailures: string[] = [];

  for (const exam of completedExams) {
    if (!exam.submitted_at) {
      continue;
    }

    const certId = exam.cert_id.toString();
    try {
      const report = await examReportFirestore.getExamReport(
        exam.exam_id,
        exam.user_id,
        certId,
      );

      if (report) {
        continue;
      }

      missingReports.push({
        exam_id: exam.exam_id,
        user_id: exam.user_id,
        cert_id: certId,
        certification_name: exam.certification.name,
        submitted_at: exam.submitted_at.toISOString(),
      });
    } catch (error) {
      firestoreLookupFailures.push(exam.exam_id);
      logger.warn(
        'AUTOMATIC_REPORT_BACKFILL: Firestore lookup failed for exam',
        {
          exam_id: exam.exam_id,
          user_id: exam.user_id,
          cert_id: certId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  logger.info('AUTOMATIC_REPORT_BACKFILL: Discovery completed', {
    total_completed_exam_candidates: completedExams.length,
    missing_report_count: missingReports.length,
    firestore_lookup_failures: firestoreLookupFailures.length,
    firestore_lookup_failure_exam_ids: firestoreLookupFailures,
    covered_exam_status: ExamStatus.COMPLETED,
  });

  return missingReports;
}

/**
 * Backfill missing exam reports by either listing missing records (dry-run)
 * or enqueueing generation tasks through Cloud Tasks (execute).
 */
export async function backfillMissingExamReports(
  options: BackfillOptions,
): Promise<void> {
  const { mode, limit, batchSize, batchDelaySeconds } = options;

  logger.info('AUTOMATIC_REPORT_BACKFILL: Starting backfill workflow', {
    mode,
    limit,
    batch_size: batchSize,
    batch_delay_seconds: batchDelaySeconds,
  });

  const missingReports = await discoverCompletedExamsMissingFirestoreReports(
    limit,
  );

  if (missingReports.length === 0) {
    logger.info('AUTOMATIC_REPORT_BACKFILL: No missing reports found');
    return;
  }

  logger.info('AUTOMATIC_REPORT_BACKFILL: Missing report sample', {
    sample: missingReports.slice(0, 10),
    total_missing_reports: missingReports.length,
  });

  if (mode === 'dry-run') {
    logger.info('AUTOMATIC_REPORT_BACKFILL: Dry-run completed', {
      discovered_missing_reports: missingReports.length,
      next_action: 'Run with --execute to enqueue backfill tasks',
    });
    return;
  }

  const examReportTaskService = ExamReportTaskService.getInstance();
  let enqueuedCount = 0;
  const failedEnqueue: string[] = [];

  for (let index = 0; index < missingReports.length; index++) {
    const record = missingReports[index];
    const batchNumber = Math.floor(index / batchSize);
    const scheduleDelaySeconds = batchNumber * batchDelaySeconds;

    const taskName = await examReportTaskService.createRetryReportTask(
      record.exam_id,
      record.user_id,
      Number(record.cert_id),
      record.certification_name,
      scheduleDelaySeconds,
    );

    if (taskName) {
      enqueuedCount += 1;
    } else {
      failedEnqueue.push(record.exam_id);
    }
  }

  logger.info('AUTOMATIC_REPORT_BACKFILL: Execute mode completed', {
    discovered_missing_reports: missingReports.length,
    successfully_enqueued: enqueuedCount,
    failed_to_enqueue: failedEnqueue.length,
    failed_exam_ids: failedEnqueue,
  });
}

const parsePositiveInt = (
  value: string | undefined,
  fallback: number,
): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const parseBackfillCliArgs = (args: string[]): ParsedCliArgs => {
  const mode: 'dry-run' | 'execute' = args.includes('--execute')
    ? 'execute'
    : 'dry-run';

  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const batchSizeArg = args.find((arg) => arg.startsWith('--batch-size='));
  const batchDelayArg = args.find((arg) => arg.startsWith('--batch-delay='));

  return {
    mode,
    limit: parsePositiveInt(limitArg?.split('=')[1], 500),
    batchSize: parsePositiveInt(batchSizeArg?.split('=')[1], 25),
    batchDelaySeconds: parsePositiveInt(batchDelayArg?.split('=')[1], 3),
  };
};

/**
 * Run backfill flow when this script is executed directly.
 * Defaults to dry-run mode for safety.
 */
export async function runMissingReportBackfillFromCli(): Promise<void> {
  const args = process.argv.slice(2);
  const parsedArgs = parseBackfillCliArgs(args);

  await backfillMissingExamReports({
    mode: parsedArgs.mode,
    limit: parsedArgs.limit,
    batchSize: parsedArgs.batchSize,
    batchDelaySeconds: parsedArgs.batchDelaySeconds,
  });
}

if (require.main === module) {
  runMissingReportBackfillFromCli()
    .then(() => {
      console.log('✅ Missing report backfill script finished.');
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error('❌ Missing report backfill script failed:', error);
      process.exit(1);
    });
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
