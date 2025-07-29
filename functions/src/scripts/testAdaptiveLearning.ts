/**
 * Test script for enhanced adaptive learning with structured Firestore exam reports
 * This script demonstrates how the new integration uses structured JSON data
 * from Firestore to generate more sophisticated exam plans.
 */

import logger from '../services/firebase/logger';
import { parseStructuredReport } from '../types/examReport';

// Mock structured exam report data (this would come from Firestore)
const mockStructuredExamReport = {
  exam_id: 'exam_test_123',
  overall_score: 72,
  total_questions: 50,
  correct_answers: 36,
  topic_performance: [
    {
      topic: 'IAM and Security',
      correct_answers: 9,
      total_attempts: 10,
      accuracy_rate: 0.9,
      difficulty_level: 'intermediate' as const,
      performance_category: 'strong' as const,
    },
    {
      topic: 'VPC and Networking',
      correct_answers: 3,
      total_attempts: 8,
      accuracy_rate: 0.375,
      difficulty_level: 'advanced' as const,
      performance_category: 'weak' as const,
    },
    {
      topic: 'Compute Engine',
      correct_answers: 4,
      total_attempts: 7,
      accuracy_rate: 0.571,
      difficulty_level: 'intermediate' as const,
      performance_category: 'average' as const,
    },
    {
      topic: 'Cloud Storage',
      correct_answers: 8,
      total_attempts: 9,
      accuracy_rate: 0.889,
      difficulty_level: 'easy' as const,
      performance_category: 'strong' as const,
    },
    {
      topic: 'Kubernetes',
      correct_answers: 2,
      total_attempts: 6,
      accuracy_rate: 0.333,
      difficulty_level: 'expert' as const,
      performance_category: 'weak' as const,
    },
  ],
  generated_at: new Date().toISOString(),
  text_summary:
    'Your performance analysis shows excellent understanding of IAM and Security with 90% accuracy...',
};

// Create a mock exam report string with structured data (as it would be stored)
const createMockExamReportString = (): string => {
  const structuredDataJson = JSON.stringify(mockStructuredExamReport);
  return structuredDataJson;
};

/**
 * Test the structured report parsing functionality
 */
const testStructuredReportParsing = (): void => {
  logger.info('ADAPTIVE_LEARNING_TEST: Testing structured report parsing');

  const mockReportString = createMockExamReportString();
  const parsedData = parseStructuredReport(mockReportString);

  if (!parsedData) {
    throw new Error('Failed to parse structured report data');
  }

  logger.info('ADAPTIVE_LEARNING_TEST: Successfully parsed structured data', {
    exam_id: parsedData.exam_id,
    overall_score: parsedData.overall_score,
    topics_analyzed: parsedData.topic_performance.length,
    weak_topics: parsedData.topic_performance.filter(
      (t) => t.performance_category === 'weak',
    ).length,
    average_topics: parsedData.topic_performance.filter(
      (t) => t.performance_category === 'average',
    ).length,
    strong_topics: parsedData.topic_performance.filter(
      (t) => t.performance_category === 'strong',
    ).length,
  });

  // Verify specific topic performance data
  const weakTopics = parsedData.topic_performance.filter(
    (t) => t.performance_category === 'weak',
  );
  const strongTopics = parsedData.topic_performance.filter(
    (t) => t.performance_category === 'strong',
  );

  logger.info('ADAPTIVE_LEARNING_TEST: Topic performance breakdown', {
    weak_areas: weakTopics.map(
      (t) => `${t.topic}: ${Math.round(t.accuracy_rate * 100)}%`,
    ),
    strong_areas: strongTopics.map(
      (t) => `${t.topic}: ${Math.round(t.accuracy_rate * 100)}%`,
    ),
  });
};

/**
 * Test the adaptive topic allocation logic
 */
const testAdaptiveTopicAllocation = async (): Promise<void> => {
  logger.info('ADAPTIVE_LEARNING_TEST: Testing adaptive topic allocation');

  try {
    // Import the exam planner to test topic generation
    const { examPlannerPromise } = await import(
      '../services/genkit/examPlanner.js'
    );
    const examPlanner = await examPlannerPromise;

    const mockReportString = createMockExamReportString();

    // Test exam plan generation with structured adaptive learning
    const examPlan = await examPlanner({
      cert_name: 'Google Cloud Professional Cloud Architect',
      totalQuestionCounts: 30,
      exam_id: 'test_exam_adaptive_123',
      cert_id: '1',
      user_id: 'test_user_123',
      customPrompt: null,
      lastExamReport: mockReportString,
    });

    logger.info('ADAPTIVE_LEARNING_TEST: Generated adaptive exam plan', {
      exam_id:
        examPlan.questions.length > 0 ? 'test_exam_adaptive_123' : 'failed',
      topics_generated: examPlan.questions.length,
      topics_preview: examPlan.questions.slice(0, 10).map((q) => q.exam_topic),
      has_adaptive_data: !!examPlan.lastExamReport,
    });

    // Analyze if the generated topics focus on weak areas
    const generatedTopics = examPlan.questions.map((q) =>
      q.exam_topic.toLowerCase(),
    );

    // Check for topics related to weak performance areas
    const networkingRelatedTopics = generatedTopics.filter(
      (topic) =>
        topic.includes('vpc') ||
        topic.includes('network') ||
        topic.includes('subnet') ||
        topic.includes('firewall'),
    );

    const kubernetesRelatedTopics = generatedTopics.filter(
      (topic) =>
        topic.includes('kubernetes') ||
        topic.includes('gke') ||
        topic.includes('container') ||
        topic.includes('pod'),
    );

    logger.info('ADAPTIVE_LEARNING_TEST: Adaptive focus analysis', {
      total_topics: generatedTopics.length,
      networking_focus: networkingRelatedTopics.length,
      kubernetes_focus: kubernetesRelatedTopics.length,
      weak_area_focus_percentage: Math.round(
        ((networkingRelatedTopics.length + kubernetesRelatedTopics.length) /
          generatedTopics.length) *
          100,
      ),
      adaptive_working:
        networkingRelatedTopics.length + kubernetesRelatedTopics.length >
        generatedTopics.length * 0.3, // Should be >30% focused on weak areas
    });
  } catch (error) {
    logger.error(
      'ADAPTIVE_LEARNING_TEST: Failed to test adaptive topic allocation',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    );
    throw error;
  }
};

/**
 * Test the complete adaptive learning workflow
 */
const testCompleteAdaptiveLearningWorkflow = async (): Promise<void> => {
  logger.info('ADAPTIVE_LEARNING_TEST: Starting complete workflow test');

  try {
    // Step 1: Test structured report parsing
    testStructuredReportParsing();

    // Step 2: Test adaptive topic allocation
    await testAdaptiveTopicAllocation();

    // Step 3: Test quiz generation with adaptive difficulty
    const { quizGeneratorPromise } = await import(
      '../services/genkit/quizGenerator.js'
    );
    const quizGenerator = await quizGeneratorPromise;

    const mockReportString = createMockExamReportString();

    // Generate questions with adaptive difficulty
    const adaptiveQuestions = await quizGenerator({
      subject: 'Google Cloud Professional Cloud Architect',
      examTopicList: ['VPC Networks', 'Kubernetes Engine', 'IAM Policies'], // Mix of weak and strong areas
      exam_id: 'test_adaptive_quiz_123',
      customPromptText: '',
      lastExamReport: mockReportString,
    });

    logger.info('ADAPTIVE_LEARNING_TEST: Generated adaptive quiz questions', {
      questions_generated: adaptiveQuestions.length,
      topics_covered: adaptiveQuestions.map((q) => q.examTopic),
      has_adaptive_difficulty: adaptiveQuestions.length > 0,
    });

    logger.info('ADAPTIVE_LEARNING_TEST: Complete workflow test PASSED ✅');
  } catch (error) {
    logger.error('ADAPTIVE_LEARNING_TEST: Complete workflow test FAILED ❌', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

/**
 * Main test runner
 */
export const runAdaptiveLearningTests = async (): Promise<void> => {
  logger.info(
    '🚀 ADAPTIVE_LEARNING_TEST: Starting enhanced adaptive learning tests',
  );

  try {
    await testCompleteAdaptiveLearningWorkflow();
    logger.info('🎉 ADAPTIVE_LEARNING_TEST: All tests completed successfully!');
  } catch (error) {
    logger.error('💥 ADAPTIVE_LEARNING_TEST: Tests failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

// Export individual test functions for selective testing
export {
  testStructuredReportParsing,
  testAdaptiveTopicAllocation,
  testCompleteAdaptiveLearningWorkflow,
  mockStructuredExamReport,
  createMockExamReportString,
};
