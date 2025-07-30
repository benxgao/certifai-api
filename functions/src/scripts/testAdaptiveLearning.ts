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
  testDuplicateTopicGeneration,
};

/**
 * Test function specifically for duplicate topic generation in adaptive learning
 */
const testDuplicateTopicGeneration = async () => {
  logger.info(
    '🔄 DUPLICATE_TOPIC_TEST: Testing adaptive learning with duplicate weak topics',
  );

  try {
    // Import exam planner
    const { examPlannerPromise } = await import(
      '../services/genkit/examPlanner.js'
    );
    const examPlanner = await examPlannerPromise;

    // Create a mock report with very weak topics for testing duplication
    const mockReportWithWeakTopics = JSON.stringify({
      exam_id: 'test_duplicate_exam_123',
      overall_score: 45, // Low score to trigger more weak topic focus
      total_questions: 30,
      correct_answers: 14,
      topic_performance: [
        {
          topic: 'VPC Security',
          correct_answers: 1,
          total_attempts: 5,
          accuracy_rate: 0.2, // Very weak - should be duplicated multiple times
          difficulty_level: 'advanced',
          performance_category: 'weak',
        },
        {
          topic: 'IAM Policies',
          correct_answers: 2,
          total_attempts: 6,
          accuracy_rate: 0.33, // Weak - should be duplicated
          difficulty_level: 'intermediate',
          performance_category: 'weak',
        },
        {
          topic: 'Load Balancing',
          correct_answers: 4,
          total_attempts: 5,
          accuracy_rate: 0.8, // Strong - should appear once or not at all
          difficulty_level: 'easy',
          performance_category: 'strong',
        },
      ],
      generated_at: new Date().toISOString(),
    });

    // Test with small exam for clear duplicate analysis
    const examPlan = await examPlanner({
      cert_name: 'Google Cloud Professional Cloud Architect',
      totalQuestionCounts: 20, // Small exam to see duplicates clearly
      exam_id: 'test_duplicate_exam_456',
      cert_id: '1',
      user_id: 'test_user_duplicate',
      customPrompt: null,
      lastExamReport: mockReportWithWeakTopics,
    });

    // Analyze duplicate topics
    const topicCounts = examPlan.questions.reduce((counts, question) => {
      const topic = question.exam_topic;
      counts[topic] = (counts[topic] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const duplicatedTopics = Object.entries(topicCounts).filter(
      ([, count]) => count > 1,
    );
    const topicDistribution = Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a) // Sort by frequency
      .slice(0, 10); // Top 10 most frequent

    logger.info('🎯 DUPLICATE_TOPIC_ANALYSIS: Topic frequency analysis', {
      exam_id:
        examPlan.questions.length > 0 ? 'test_duplicate_exam_456' : 'failed',
      total_topics: examPlan.questions.length,
      unique_topics: Object.keys(topicCounts).length,
      duplicated_topics_count: duplicatedTopics.length,
      duplicated_topics: duplicatedTopics,
      topic_distribution: topicDistribution,
      weak_topics_in_report: ['VPC Security', 'IAM Policies'],
      expected_behavior: 'Weak topics should appear multiple times',
    });

    // Verify that weak topics from the report appear multiple times
    const weakTopicsFromReport = ['VPC Security', 'IAM Policies'];
    const weakTopicDuplicates = weakTopicsFromReport.filter((weakTopic) => {
      const occurrences = examPlan.questions.filter(
        (q) =>
          q.exam_topic.toLowerCase().includes(weakTopic.toLowerCase()) ||
          weakTopic.toLowerCase().includes(q.exam_topic.toLowerCase()),
      ).length;
      return occurrences > 1;
    });

    logger.info('📊 WEAK_TOPIC_DUPLICATION_RESULT:', {
      weak_topics_checked: weakTopicsFromReport,
      topics_with_duplicates: weakTopicDuplicates,
      duplication_success: weakTopicDuplicates.length > 0,
      total_weak_topic_occurrences: weakTopicsFromReport.reduce(
        (total, weakTopic) => {
          return (
            total +
            examPlan.questions.filter(
              (q) =>
                q.exam_topic.toLowerCase().includes(weakTopic.toLowerCase()) ||
                weakTopic.toLowerCase().includes(q.exam_topic.toLowerCase()),
            ).length
          );
        },
        0,
      ),
    });

    return {
      success: true,
      duplicatedTopics,
      topicDistribution,
      weakTopicDuplicates,
    };
  } catch (error) {
    logger.error('💥 DUPLICATE_TOPIC_TEST: Test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};
