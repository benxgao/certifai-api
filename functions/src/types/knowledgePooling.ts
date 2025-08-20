/**
 * Type definitions for Knowledge Pooling feature
 */

/**
 * Structure for individual knowledge insights
 */
export interface KnowledgeInsight {
  insight_id: string;
  insight: string;
  context: string;
  topic: string;
  exam_id: string;
  generated_at: string;
}

/**
 * Complete knowledge pooling response structure
 */
export interface KnowledgePoolingResponse {
  knowledge_insights: KnowledgeInsight[];
  summary: string;
  generated_at: string;
  cert_id: number;
  certification_name: string;
  total_incorrect_answers: number;
  topics_analyzed: number;
  last_updated?: string;
}

/**
 * Data structure for incorrect answers analysis
 */
export interface IncorrectAnswerAnalysis {
  exam_id: string;
  question_id: string;
  topic: string | null;
  question_text: string;
  correct_answer: string;
  user_selected_answer: string;
  explanation: string | null;
}

/**
 * Knowledge pooling generation request
 */
export interface KnowledgePoolingGenerationRequest {
  user_id: string;
  cert_id: number;
  certification_name: string;
  incorrect_answers_data: IncorrectAnswerAnalysis[];
}

/**
 * API request body for knowledge pooling generation
 */
export interface KnowledgePoolingApiRequest {
  cert_id: number;
  cert_name?: string;
  user_id: string;
  force_regenerate?: boolean;
}

/**
 * API response for knowledge pooling generation
 */
export interface KnowledgePoolingApiResponse {
  success: boolean;
  data: KnowledgePoolingResponse;
  message: string;
  cached?: boolean;
  error?: string;
}

/**
 * Statistics about incorrect answers for analysis
 */
export interface IncorrectAnswersStats {
  total_incorrect: number;
  topics_affected: string[];
  recent_exams_count: number;
}
