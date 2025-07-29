/**
 * Structured Exam Report Types
 *
 * Defines the schema for structured exam performance reports
 * that enable more precise adaptive learning algorithms.
 */

/**
 * Example TopicPerformance structure:
 * {
 *   "topic": "VPC and Networking",
 *   "correct_answers": 3,
 *   "total_attempts": 5,
 *   "accuracy_rate": 0.6,
 *   "difficulty_level": "intermediate",
 *   "performance_category": "average"
 * }
 */
export interface TopicPerformance {
  topic: string;
  correct_answers: number;
  total_attempts: number;
  accuracy_rate: number; // 0.0 to 1.0
  difficulty_level: 'easy' | 'intermediate' | 'advanced' | 'expert';
  performance_category: 'weak' | 'average' | 'strong';
}

/**
 * Example StructuredExamReport structure:
 * {
 *   "exam_id": "exam_abc123",
 *   "overall_score": 75,
 *   "total_questions": 20,
 *   "correct_answers": 15,
 *   "topic_performance": [
 *     {
 *       "topic": "IAM and Security",
 *       "correct_answers": 4,
 *       "total_attempts": 4,
 *       "accuracy_rate": 1.0,
 *       "difficulty_level": "intermediate",
 *       "performance_category": "strong"
 *     },
 *     {
 *       "topic": "Compute Engine",
 *       "correct_answers": 2,
 *       "total_attempts": 5,
 *       "accuracy_rate": 0.4,
 *       "difficulty_level": "advanced",
 *       "performance_category": "weak"
 *     }
 *   ],
 *   "generated_at": "2025-07-29T14:30:00.000Z",
 *   "text_summary": "You performed excellently in IAM and Security (100% accuracy), showing strong understanding..."
 * }
 */
export interface StructuredExamReport {
  exam_id: string;
  overall_score: number; // 0-100
  total_questions: number;
  correct_answers: number;
  topic_performance: TopicPerformance[];
  generated_at: string; // ISO timestamp
  text_summary: string; // Human-readable summary (backward compatibility)
}

/**
 * Helper function to determine performance category based on accuracy
 */
export const getPerformanceCategory = (
  accuracyRate: number,
): TopicPerformance['performance_category'] => {
  if (accuracyRate >= 0.8) return 'strong';
  if (accuracyRate >= 0.6) return 'average';
  return 'weak';
};

/**
 * Helper function to map difficulty numbers to strings
 */
export const getDifficultyLabel = (
  difficultyLevel: number,
): TopicPerformance['difficulty_level'] => {
  if (difficultyLevel >= 4) return 'expert';
  if (difficultyLevel >= 3) return 'advanced';
  if (difficultyLevel >= 2) return 'intermediate';
  return 'easy';
};

/**
 * Helper function to parse structured exam report from string
 * Returns null if the string doesn't contain valid JSON structure
 *
 * Example of complete stored report format in database (exam_report field):
 * ```
 * "Your performance analysis shows excellent understanding of IAM and Security with 100% accuracy,
 * indicating strong grasp of identity management concepts. However, Compute Engine questions revealed
 * areas for improvement with 40% accuracy, particularly in advanced VM configuration scenarios.
 * Focus your study on VM instance types, persistent disk management, and custom images.
 *
 * --- STRUCTURED_DATA ---
 * {
 *   "exam_id": "exam_abc123",
 *   "overall_score": 75,
 *   "total_questions": 20,
 *   "correct_answers": 15,
 *   "topic_performance": [
 *     {
 *       "topic": "IAM and Security",
 *       "correct_answers": 4,
 *       "total_attempts": 4,
 *       "accuracy_rate": 1.0,
 *       "difficulty_level": "intermediate",
 *       "performance_category": "strong"
 *     },
 *     {
 *       "topic": "Compute Engine",
 *       "correct_answers": 2,
 *       "total_attempts": 5,
 *       "accuracy_rate": 0.4,
 *       "difficulty_level": "advanced",
 *       "performance_category": "weak"
 *     }
 *   ],
 *   "generated_at": "2025-07-29T14:30:00.000Z",
 *   "text_summary": "Your performance analysis shows excellent understanding..."
 * }"
 * ```
 */
export const parseStructuredReport = (
  reportString: string,
): StructuredExamReport | null => {
  try {
    // Parse JSON directly (structured data only)
    const parsed = JSON.parse(reportString);

    // Validate basic structure
    if (parsed.topic_performance && Array.isArray(parsed.topic_performance)) {
      return parsed as StructuredExamReport;
    }

    return null;
  } catch {
    return null;
  }
};
