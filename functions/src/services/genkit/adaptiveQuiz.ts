/**
 * Adaptive Quiz Generation Utilities
 *
 * Extracts adaptive quiz generation functions from quizGenerator to reduce file size
 * and improve modularity for adaptive difficulty adjustment algorithms.
 */

import {
  parseStructuredReport,
  TopicPerformance,
} from '../../types/examReport';
import { AdaptiveQuizMetrics } from '../../types/genkit';

/**
 * Builds adaptive difficulty instructions from structured Firestore exam report data.
 *
 * @param lastExamReport - Structured JSON exam report from Firestore
 * @returns Formatted difficulty instructions for AI quiz generation
 *
 * Example output with structured data:
 * ```
 * ADAPTIVE DIFFICULTY ADJUSTMENT (precise topic-based difficulty mapping):
 * Generate questions with the following difficulty levels for each topic:
 *     - IAM and Security: ADVANCED to EXPERT level (100% accuracy)
 *     - Compute Engine: EASY to ADVANCED level (40% accuracy)
 *     - VPC and Networking: ADVANCED level (67% accuracy)
 *
 * For topics not mentioned above: Generate ADVANCED level questions.
 * Previous exam performance: 75% overall score
 * ```
 */
export const buildAdaptiveDifficultyInstructions = (
  lastExamReport: string,
): string => {
  // Parse structured data from Firestore exam report (required)
  const structuredData = parseStructuredReport(lastExamReport);

  if (!structuredData?.topic_performance) {
    throw new Error(
      'Invalid or missing structured exam report data. Cannot generate adaptive quiz without structured performance data.',
    );
  }

  // Use structured data for precise difficulty mapping
  const topicInstructions = structuredData.topic_performance
    .map((topic) => {
      const difficultyLevel = mapPerformanceToDifficulty(
        topic.performance_category,
      );

      return `    - ${topic.topic}: ${difficultyLevel} level (${Math.round(
        topic.accuracy_rate * 100,
      )}% accuracy)`;
    })
    .join('\n');

  return `

    ADAPTIVE DIFFICULTY ADJUSTMENT (precise topic-based difficulty mapping):
    Generate questions with the following difficulty levels for each topic:
${topicInstructions}

    For topics not mentioned above: Generate ADVANCED level questions.
    Previous exam performance: ${structuredData.overall_score}% overall score`;
};

/**
 * Maps performance category to difficulty level for quiz generation
 * @param performanceCategory - The performance category from exam report
 * @returns Difficulty level string for AI instructions
 */
const mapPerformanceToDifficulty = (
  performanceCategory: TopicPerformance['performance_category'],
): string => {
  switch (performanceCategory) {
    case 'strong':
      return 'ADVANCED to EXPERT';
    case 'weak':
      return 'EASY to ADVANCED';
    default: // average
      return 'ADVANCED';
  }
};

/**
 * Builds the complete quiz generation prompt with adaptive difficulty
 * @param subject - The certification subject
 * @param examTopicList - List of exam topics
 * @param customPromptText - Optional custom prompt text
 * @param lastExamReport - Optional exam report for adaptive difficulty
 * @returns Complete prompt string for quiz generation
 */
export const buildQuizPrompt = (
  subject: string,
  examTopicList: string[],
  customPromptText?: string,
  lastExamReport?: string,
): string => {
  const count = examTopicList.length;
  const topicsSection = examTopicList
    .map((topic, index) => `${index + 1}. ${topic}`)
    .join('\n    ');

  const basePrompt = buildBaseQuizPrompt(subject, count, topicsSection);
  const customSection = buildCustomPromptSection(customPromptText);
  const adaptiveDifficultySection =
    buildAdaptiveDifficultySection(lastExamReport);
  const formatSection = buildFormatSection(count);

  return basePrompt + customSection + adaptiveDifficultySection + formatSection;
};

/**
 * Builds the base quiz prompt section
 * @param subject - The certification subject
 * @param count - Number of questions to generate
 * @param topicsSection - Formatted topics list
 * @returns Base prompt string
 */
const buildBaseQuizPrompt = (
  subject: string,
  count: number,
  topicsSection: string,
): string => {
  return `Generate ${count} realistic ${subject} certification exam questions.
    Each question MUST focus on one of the following specific topics (use the exact topic name as examTopic):
    ${topicsSection}

    NOTE: Some topics may appear multiple times in the list above for adaptive learning. Generate a UNIQUE question for EACH occurrence.

    REQUIREMENTS:
    1. Sophisticated distractors requiring expertise
    2. All 4 choices plausible and technically accurate
    3. Wrong answers: common misconceptions, not obvious fakes
    4. Question scenarios can contain correlated topics like in real common business cases
    5. examTopic MUST be the exact topic name from the list above for each question
    6. Each provided exam topic must have a corresponding question (including duplicates)
    7. For duplicate topics, create different questions that test different aspects of the same topic

    CONSTRUCTION:
    - Business scenarios with specific constraints
    - Exact 4 options, can be commands, code snippets, or concepts
    - Each question MUST use one of the provided examTopic values exactly as listed
    - For repeated topics, vary the question content while keeping the same examTopic value
  `;
};

/**
 * Builds the custom prompt section if provided
 * @param customPromptText - Optional custom prompt text
 * @returns Custom prompt section string
 */
const buildCustomPromptSection = (customPromptText?: string): string => {
  return customPromptText?.trim()
    ? `ADDITIONAL FOCUS (the below rules should be applied with each examTopic):${customPromptText.trim()}`
    : '';
};

/**
 * Builds the adaptive difficulty section if exam report is provided
 * @param lastExamReport - Optional exam report for adaptive difficulty
 * @returns Adaptive difficulty section string
 */
const buildAdaptiveDifficultySection = (lastExamReport?: string): string => {
  return lastExamReport?.trim()
    ? buildAdaptiveDifficultyInstructions(lastExamReport)
    : '';
};

/**
 * Builds the format section for the quiz prompt
 * @param count - Number of questions to generate
 * @returns Format section string
 */
const buildFormatSection = (count: number): string => {
  return `
    JSON format:[{
      "question": "string",
      "choices": ["string", "string", "string", "string"],
      "answerIndex": 0,
      "explanation": "string",
      "examTopic": "string (REQUIRED - must be one of the exact topic names from the list above)"
    }]

    Explanation: simple sentences to explain why correct option is correct and why wrong answers are wrong.
    IMPORTANT:
    - Each question MUST have an examTopic value that exactly matches one of the provided topic names.
    - For duplicate topics in the list, create different questions with the same examTopic value.
    - Generate exactly ${count} questions, one for each topic occurrence (including duplicates).
  `;
};

/**
 * Validates if a quiz item has a valid examTopic from the expected list
 * @param item - The quiz item to validate
 * @param examTopicList - List of expected exam topics
 * @returns Boolean indicating if the examTopic is valid
 */
export const validateQuizItemTopic = (
  item: { examTopic?: string },
  examTopicList: string[],
): boolean => {
  if (!item.examTopic || item.examTopic.trim() === '') {
    return false;
  }

  // Normalize the generated topic for comparison
  const normalizedGenerated = item.examTopic
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  // Check if any of the expected topics match (normalized)
  return examTopicList.some((expectedTopic) => {
    const normalizedExpected = expectedTopic
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    return normalizedExpected === normalizedGenerated;
  });
};

/**
 * Gets adaptive quiz metrics from exam topic list
 * @param examTopicList - List of exam topics
 * @returns Object with quiz generation metrics
 */
export const getAdaptiveQuizMetrics = (
  examTopicList: string[],
): AdaptiveQuizMetrics => {
  const uniqueTopics = [...new Set(examTopicList)];
  const duplicateTopics = examTopicList.filter(
    (topic, index) => examTopicList.indexOf(topic) !== index,
  );

  return {
    totalCount: examTopicList.length,
    uniqueTopicsCount: uniqueTopics.length,
    duplicateTopicsCount: duplicateTopics.length,
    duplicateTopics:
      duplicateTopics.length > 0 ? [...new Set(duplicateTopics)] : [],
  };
};
