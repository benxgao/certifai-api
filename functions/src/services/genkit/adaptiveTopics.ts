/**
 * Adaptive Learning Utilities
 *
 * Extracts adaptive learning functions from examPlanner to reduce file size
 * and improve modularity for adaptive exam generation algorithms.
 */

import {
  parseStructuredReport,
  TopicPerformance,
} from '../../types/examReport';

/**
 * Helper function to build adaptive learning instructions from structured Firestore data
 * @param lastExamReport - The exam report string containing structured performance data
 * @returns Adaptive instructions string for topic allocation
 * @throws Error if structured data is invalid or missing
 */
export const buildAdaptiveTopicInstructions = (
  lastExamReport: string,
): string => {
  // Parse structured data from Firestore exam report (required)
  const structuredData = parseStructuredReport(lastExamReport);

  if (!structuredData?.topic_performance) {
    throw new Error(
      'Invalid or missing structured exam report data. Cannot generate adaptive exam plan without structured performance data.',
    );
  }

  // Use structured data for precise topic-based exam planning
  const weakTopics = structuredData.topic_performance
    .filter((topic: TopicPerformance) => topic.performance_category === 'weak')
    .sort(
      (a: TopicPerformance, b: TopicPerformance) =>
        a.accuracy_rate - b.accuracy_rate,
    ); // Prioritize weakest topics

  const averageTopics = structuredData.topic_performance.filter(
    (topic: TopicPerformance) => topic.performance_category === 'average',
  );

  const strongTopics = structuredData.topic_performance
    .filter(
      (topic: TopicPerformance) => topic.performance_category === 'strong',
    )
    .sort(
      (a: TopicPerformance, b: TopicPerformance) =>
        b.accuracy_rate - a.accuracy_rate,
    ); // Prioritize strongest topics

  return buildTopicAllocationInstructions(
    weakTopics,
    averageTopics,
    strongTopics,
    structuredData.overall_score,
    structuredData.correct_answers,
    structuredData.total_questions,
  );
};

/**
 * Builds detailed topic allocation instructions based on performance categories
 * @param weakTopics - Topics with weak performance
 * @param averageTopics - Topics with average performance
 * @param strongTopics - Topics with strong performance
 * @param overallScore - Overall exam score percentage
 * @param correctAnswers - Number of correct answers
 * @param totalQuestions - Total number of questions
 * @returns Formatted adaptive instructions string
 */
const buildTopicAllocationInstructions = (
  weakTopics: TopicPerformance[],
  averageTopics: TopicPerformance[],
  strongTopics: TopicPerformance[],
  overallScore: number,
  correctAnswers: number,
  totalQuestions: number,
): string => {
  // Calculate topic counts for strategy description
  const weakCount = weakTopics.length;
  const averageCount = averageTopics.length;
  const strongCount = strongTopics.length;

  // Build detailed topic allocation instructions
  let adaptiveInstructions = `

    ADAPTIVE TOPIC ALLOCATION (based on structured performance data):
    Generate exam topics using the following performance-based strategy. DUPLICATE weak topics as needed to ensure sufficient coverage and reinforcement. The resulting array may contain repeated topics, especially for weak areas:
    WEAK PERFORMANCE AREAS (${weakCount} topics, prioritize 60% of exam topics):
    Focus heavily on these areas where improvement is needed:`;

  adaptiveInstructions += buildWeakTopicsInstructions(weakTopics);

  if (averageTopics.length > 0) {
    adaptiveInstructions += `

    AVERAGE PERFORMANCE AREAS (${averageCount} topics, allocate 25% of exam topics):
    Include moderate coverage for reinforcement:`;

    adaptiveInstructions += buildAverageTopicsInstructions(averageTopics);
  }

  if (strongTopics.length > 0) {
    adaptiveInstructions += `

    STRONG PERFORMANCE AREAS (${strongCount} topics, allocate 15% of exam topics):
    Include minimal coverage for mastery validation:`;

    adaptiveInstructions += buildStrongTopicsInstructions(strongTopics);
  }

  adaptiveInstructions += buildTopicGenerationStrategy();
  adaptiveInstructions += `

    Previous exam overall score: ${overallScore}% (${correctAnswers}/${totalQuestions} questions)`;

  return adaptiveInstructions;
};

/**
 * Builds instructions for weak performance topics
 * @param weakTopics - Array of weak performance topics
 * @returns Formatted instructions string for weak topics
 */
const buildWeakTopicsInstructions = (
  weakTopics: TopicPerformance[],
): string => {
  let instructions = '';
  weakTopics.forEach((topic: TopicPerformance) => {
    instructions += `\n    - ${topic.topic}: ${Math.round(
      topic.accuracy_rate * 100,
    )}% accuracy (${
      topic.difficulty_level
    } level) - DUPLICATE this topic in the exam plan array (e.g., include it 2-4 times if accuracy <50%) to reinforce learning.`;
  });
  return instructions;
};

/**
 * Builds instructions for average performance topics
 * @param averageTopics - Array of average performance topics
 * @returns Formatted instructions string for average topics
 */
const buildAverageTopicsInstructions = (
  averageTopics: TopicPerformance[],
): string => {
  let instructions = '';
  averageTopics.forEach((topic: TopicPerformance) => {
    instructions += `\n    - ${topic.topic}: ${Math.round(
      topic.accuracy_rate * 100,
    )}% accuracy (${
      topic.difficulty_level
    } level) - Include some related topics`;
  });
  return instructions;
};

/**
 * Builds instructions for strong performance topics
 * @param strongTopics - Array of strong performance topics
 * @returns Formatted instructions string for strong topics
 */
const buildStrongTopicsInstructions = (
  strongTopics: TopicPerformance[],
): string => {
  let instructions = '';
  strongTopics.forEach((topic: TopicPerformance) => {
    instructions += `\n    - ${topic.topic}: ${Math.round(
      topic.accuracy_rate * 100,
    )}% accuracy (${
      topic.difficulty_level
    } level) - Include occasionally for validation`;
  });
  return instructions;
};

/**
 * Builds the topic generation strategy instructions
 * @returns Formatted strategy instructions string
 */
const buildTopicGenerationStrategy = (): string => {
  return `

    TOPIC GENERATION STRATEGY:
    1. Generate topics that are RELATED TO or SUBTOPICS OF the weak performance areas listed above
    2. Use topic names that would help improve understanding in the weak areas
    3. For weak topics with <50% accuracy, DUPLICATE the topic in the array 3-4 times (not just subtopics, but the same topic string can appear multiple times)
    4. For average topics (50-79% accuracy), include 1-2 related subtopics each (can duplicate if needed)
    5. For strong topics (≥80% accuracy), include at most 1 related topic for validation
    6. Fill remaining topics with general certification topics if needed`;
};

/**
 * Validates if exam report contains structured data for adaptive learning
 * @param lastExamReport - The exam report string to validate
 * @returns Boolean indicating if structured data is available
 */
export const hasStructuredAdaptiveData = (
  lastExamReport: string | null | undefined,
): boolean => {
  if (!lastExamReport?.trim()) {
    return false;
  }

  try {
    const structuredData = parseStructuredReport(lastExamReport);
    return !!(
      structuredData?.topic_performance &&
      Array.isArray(structuredData.topic_performance) &&
      structuredData.topic_performance.length > 0
    );
  } catch {
    return false;
  }
};

/**
 * Gets adaptive learning metrics from structured exam report
 * @param lastExamReport - The exam report string containing structured data
 * @returns Object with adaptive learning metrics or null if invalid
 */
export const getAdaptiveLearningMetrics = (
  lastExamReport: string,
): {
  weakTopicsCount: number;
  averageTopicsCount: number;
  strongTopicsCount: number;
  overallScore: number;
  totalQuestions: number;
} | null => {
  try {
    const structuredData = parseStructuredReport(lastExamReport);

    if (!structuredData?.topic_performance) {
      return null;
    }

    const weakTopics = structuredData.topic_performance.filter(
      (topic: TopicPerformance) => topic.performance_category === 'weak',
    );
    const averageTopics = structuredData.topic_performance.filter(
      (topic: TopicPerformance) => topic.performance_category === 'average',
    );
    const strongTopics = structuredData.topic_performance.filter(
      (topic: TopicPerformance) => topic.performance_category === 'strong',
    );

    return {
      weakTopicsCount: weakTopics.length,
      averageTopicsCount: averageTopics.length,
      strongTopicsCount: strongTopics.length,
      overallScore: structuredData.overall_score,
      totalQuestions: structuredData.total_questions,
    };
  } catch {
    return null;
  }
};
