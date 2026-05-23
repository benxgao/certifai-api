import { z } from 'genkit';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';
import type { ExamReportGeneratorFlow } from '../../types/genkit';

import logger from '../firebase/logger';
import {
  createAiInstancePromise,
  generateWithValidation,
  handleGenerationError,
  logGenerationStart,
  logGenerationComplete,
  DEFAULT_GENERATION_CONFIG,
  googleAI,
  DEFAULT_GENAI_MODEL,
} from './utils';

enableFirebaseTelemetry();

const ExamReportSchema = z.object({
  report: z
    .string()
    .describe(
      'A concise 150-word performance report summarizing strengths and areas for improvement',
    ),
  difficulty_adjustments: z
    .object({
      increase_difficulty: z
        .array(z.string())
        .describe('Topics where difficulty should be increased'),
      maintain_difficulty: z
        .array(z.string())
        .describe('Topics where difficulty should be maintained'),
      decrease_difficulty: z
        .array(z.string())
        .describe('Topics where difficulty should be decreased'),
    })
    .describe(
      'Difficulty level recommendations for adaptive future question generation',
    ),
});

const LLMReportOutputSchema = z.object({
  report: z
    .string()
    .describe(
      'A concise 150-word performance report summarizing strengths and areas for improvement',
    ),
});

/**
 * Exam Report Generator Flow
 * Analyzes user performance data and generates personalized learning recommendations
 */
export const createExamReportGeneratorFlow = async (): Promise<ExamReportGeneratorFlow> => {
  try {
    const ai = await createAiInstancePromise();

    const examReportGeneratorFlow = ai.defineFlow(
      {
        name: 'examReportGenerator',
        inputSchema: z.object({
          user_id: z.string(),
          exam_id: z.string(),
          certification_name: z.string(),
          performance_data: z.array(
            z.object({
              topic: z.string(),
              correct_answers: z.number(),
              total_attempts: z.number(),
              accuracy_rate: z.number(),
              current_difficulty_level: z.number().min(1).max(5), // 1-5 scale
              average_difficulty_attempted: z.number().min(1).max(5),
            }),
          ),
          overall_score: z.number(),
          total_questions: z.number(),
          correct_answers: z.number(),
        }),
        outputSchema: ExamReportSchema,
      },
      async (input) => {
        const {
          user_id,
          exam_id,
          certification_name,
          performance_data,
          overall_score,
          total_questions,
          correct_answers,
        } = input;

        logGenerationStart('examReportGenerator', {
          user_id,
          exam_id,
          certification_name,
          total_topics: performance_data.length,
          overall_score: `${overall_score}%`,
        });

        try {
          // Analyze performance data to identify strengths and weaknesses
          const strongTopics = performance_data
            .filter((topic) => topic.accuracy_rate >= 0.75)
            .sort((a, b) => b.accuracy_rate - a.accuracy_rate)
            .slice(0, 3);

          const weakTopics = performance_data
            .filter((topic) => topic.accuracy_rate < 0.6)
            .sort((a, b) => a.accuracy_rate - b.accuracy_rate)
            .slice(0, 3);

          const averageTopics = performance_data.filter(
            (topic) => topic.accuracy_rate >= 0.6 && topic.accuracy_rate < 0.75,
          );

          // Create difficulty adjustments based on performance
          const difficultyAdjustments = {
            increase_difficulty: strongTopics.map((topic) => topic.topic),
            maintain_difficulty: averageTopics.map((topic) => topic.topic),
            decrease_difficulty: weakTopics.map((topic) => topic.topic),
          };

          // Create performance summary
          const performanceSummary = {
            overall_performance:
              overall_score >= 70
                ? 'good'
                : overall_score >= 50
                ? 'average'
                : 'needs_improvement',
            correct_rate: Math.round((correct_answers / total_questions) * 100),
            strong_topics: strongTopics.map((t) => t.topic),
            weak_topics: weakTopics.map((t) => t.topic),
            average_topics: averageTopics.map((t) => t.topic),
            difficulty_adjustments: difficultyAdjustments,
          };

          const prompt = `
As an AI learning advisor, analyze this ${certification_name} certification exam performance and provide a concise 150-word report with difficulty-based adaptive recommendations.

EXAM PERFORMANCE DATA:
- Overall Score: ${overall_score}% (${correct_answers}/${total_questions} questions correct)
- Certification: ${certification_name}

TOPIC PERFORMANCE BREAKDOWN WITH DIFFICULTY LEVELS:
${performance_data
  .map(
    (topic) =>
      `• ${topic.topic}: ${topic.correct_answers}/${
        topic.total_attempts
      } correct (${Math.round(topic.accuracy_rate * 100)}%) | Current Level: ${
        topic.current_difficulty_level
      }/5 | Avg Attempted: ${topic.average_difficulty_attempted.toFixed(1)}/5`,
  )
  .join('\n')}

DIFFICULTY ADJUSTMENT STRATEGY:
INCREASE DIFFICULTY (≥75% accuracy): ${
            strongTopics
              .map((t) => `${t.topic} (${Math.round(t.accuracy_rate * 100)}%)`)
              .join(', ') || 'None'
          }
MAINTAIN DIFFICULTY (60-74% accuracy): ${
            averageTopics
              .map((t) => `${t.topic} (${Math.round(t.accuracy_rate * 100)}%)`)
              .join(', ') || 'None'
          }
DECREASE DIFFICULTY (<60% accuracy): ${
            weakTopics
              .map((t) => `${t.topic} (${Math.round(t.accuracy_rate * 100)}%)`)
              .join(', ') || 'None'
          }

Generate a personalized 150-word performance report that:
1. Acknowledges specific topics the user performed well on (where difficulty will be increased)
2. Identifies 2-3 priority areas for improvement (where difficulty will be decreased/maintained)
3. Mentions the adaptive difficulty adjustments for future practice
4. Provides encouraging but realistic feedback with specific topic names
5. Suggests focused study recommendations considering current difficulty levels
6. Uses a professional but supportive tone

Keep it exactly around 150 words, be specific about topic names, and emphasize how the adaptive system will adjust question difficulty based on performance.
`;

          // Simplified chunk handler
          const sendChunk = () => {
            // Stream handling placeholder for future use
          };

          const response = await generateWithValidation(
            ai,
            prompt,
            LLMReportOutputSchema,
            sendChunk,
            {
              ...DEFAULT_GENERATION_CONFIG,
              maxOutputTokens: 400, // Increased for additional difficulty info
              temperature: 0.4, // Slightly more focused for consistency
            },
            googleAI.model(DEFAULT_GENAI_MODEL),
          );

          const result = {
            report: response.report,
            difficulty_adjustments: difficultyAdjustments,
            metadata: {
              user_id,
              exam_id,
              certification_name,
              performance_summary: performanceSummary,
              generated_at: new Date().toISOString(),
            },
          };

          logGenerationComplete('examReportGenerator', result, {
            user_id,
            exam_id,
            report_length: response.report.length,
            difficulty_increases:
              difficultyAdjustments.increase_difficulty.length,
            difficulty_decreases:
              difficultyAdjustments.decrease_difficulty.length,
          });

          return {
            report: response.report,
            difficulty_adjustments: difficultyAdjustments,
          };
        } catch (error) {
          handleGenerationError(
            error,
            { user_id, exam_id },
            'exam report generation',
          );
          throw error;
        }
      },
    );

    return examReportGeneratorFlow as ExamReportGeneratorFlow;
  } catch (error) {
    logger.error('Failed to create exam report generator flow:', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * Singleton promise for the exam report generator flow
 */
let examReportGeneratorPromise: Promise<ExamReportGeneratorFlow> | null = null;

/**
 * Get or create the exam report generator flow
 */
export const getExamReportGeneratorFlow = (): Promise<ExamReportGeneratorFlow> => {
  if (!examReportGeneratorPromise) {
    examReportGeneratorPromise = createExamReportGeneratorFlow();
  }
  return examReportGeneratorPromise;
};

// Initialize the promise for use in handlers
examReportGeneratorPromise = createExamReportGeneratorFlow();

// Export the promise for use in handlers
export { examReportGeneratorPromise };
