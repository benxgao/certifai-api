import { FieldValue } from 'firebase-admin/firestore';
import { firebaseFirestore } from '../firebase/admin';
import logger from '../firebase/logger';

// Get Firestore instance
const firestore = firebaseFirestore;

export interface KnowledgeInsight {
  insight: string;
  context: string;
  exam_id: string;
  generated_at: string;
}

export interface KnowledgePoolingItem {
  topic: string;
  insights: KnowledgeInsight[];
}

export interface ExamKnowledgePoolingData {
  exam_id: string;
  knowledge_insights: KnowledgePoolingItem[];
  summary: string;
  generated_at: string;
  cert_id: number;
  certification_name: string;
  total_incorrect_answers: number;
  topics_analyzed: number;
}

export interface ConsolidatedKnowledgePoolingData {
  knowledge_insights: KnowledgePoolingItem[];
  exam_summaries: Array<{
    exam_id: string;
    summary: string;
    generated_at: string;
    total_incorrect_answers: number;
  }>;
  consolidated_summary: string;
  last_updated: string;
  cert_id: number;
  certification_name: string;
  total_exams_analyzed: number;
  total_incorrect_answers: number;
  total_topics_analyzed: number;
}

/**
 * Save knowledge pooling data for a specific exam and merge with existing certification data
 * Path: users/:api_user_id/certs/:cert_id/knowledge_pooling (document)
 */
export const saveExamKnowledgePoolingToFirestore = async (
  apiUserId: string,
  examData: ExamKnowledgePoolingData,
): Promise<ConsolidatedKnowledgePoolingData> => {
  try {
    const docPath = `users/${apiUserId}/certs/${examData.cert_id}`;
    const docRef = firestore.doc(docPath);

    // Get existing data
    const existingDoc = await docRef.get();
    const existingData = existingDoc.exists
      ? existingDoc.data()?.knowledge_pooling
      : null;

    // Merge insights by topic
    const mergedInsights = mergeKnowledgeInsightsByTopic(
      existingData?.knowledge_insights || [],
      examData.knowledge_insights,
      examData.exam_id,
      examData.generated_at,
    );

    // Prepare exam summary entry
    const newExamSummary = {
      exam_id: examData.exam_id,
      summary: examData.summary,
      generated_at: examData.generated_at,
      total_incorrect_answers: examData.total_incorrect_answers,
    };

    // Update or create exam summaries list
    const existingExamSummaries = existingData?.exam_summaries || [];
    const filteredExamSummaries = existingExamSummaries.filter(
      (summary: any) => summary.exam_id !== examData.exam_id,
    );
    const updatedExamSummaries = [...filteredExamSummaries, newExamSummary];

    // Create consolidated summary
    const consolidatedSummary = generateConsolidatedSummary(
      updatedExamSummaries,
      examData.certification_name,
    );

    // Calculate totals
    const totalIncorrectAnswers = updatedExamSummaries.reduce(
      (sum, exam) => sum + exam.total_incorrect_answers,
      0,
    );

    const consolidatedData: ConsolidatedKnowledgePoolingData = {
      knowledge_insights: mergedInsights,
      exam_summaries: updatedExamSummaries,
      consolidated_summary: consolidatedSummary,
      last_updated: new Date().toISOString(),
      cert_id: examData.cert_id,
      certification_name: examData.certification_name,
      total_exams_analyzed: updatedExamSummaries.length,
      total_incorrect_answers: totalIncorrectAnswers,
      total_topics_analyzed: mergedInsights.length,
    };

    // Save to Firestore
    const firestoreData = {
      knowledge_pooling: consolidatedData,
    };

    await docRef.set(firestoreData, { merge: true });

    logger.info(
      `Exam knowledge pooling data saved and merged for user ${apiUserId}, cert ${examData.cert_id}, exam ${examData.exam_id}`,
      {
        path: docPath,
        total_exams: consolidatedData.total_exams_analyzed,
        total_topics: consolidatedData.total_topics_analyzed,
        total_insights: consolidatedData.knowledge_insights.reduce(
          (sum, topic) => sum + topic.insights.length,
          0,
        ),
      },
    );

    return consolidatedData;
  } catch (error) {
    logger.error(
      `Error saving exam knowledge pooling data for user ${apiUserId}, cert ${examData.cert_id}, exam ${examData.exam_id}:`,
      error as any,
    );
    throw error;
  }
};

/**
 * Get consolidated knowledge pooling data from Firestore
 * Path: users/:api_user_id/certs/:cert_id/knowledge_pooling
 */
export const getConsolidatedKnowledgePoolingFromFirestore = async (
  apiUserId: string,
  certId: number,
): Promise<ConsolidatedKnowledgePoolingData | null> => {
  try {
    const docPath = `users/${apiUserId}/certs/${certId}`;
    const docRef = firestore.doc(docPath);
    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {
      logger.info(
        `No knowledge pooling data found for user ${apiUserId}, cert ${certId}`,
      );
      return null;
    }

    const data = docSnapshot.data();
    const knowledgePooling = data?.knowledge_pooling;

    if (!knowledgePooling) {
      logger.info(
        `Knowledge pooling field not found in document for user ${apiUserId}, cert ${certId}`,
      );
      return null;
    }

    logger.info(
      `Consolidated knowledge pooling data retrieved for user ${apiUserId}, cert ${certId}`,
      {
        path: docPath,
        total_exams: knowledgePooling.total_exams_analyzed || 0,
        total_topics: knowledgePooling.knowledge_insights?.length || 0,
      },
    );

    return knowledgePooling as ConsolidatedKnowledgePoolingData;
  } catch (error) {
    logger.error(
      `Error retrieving consolidated knowledge pooling data for user ${apiUserId}, cert ${certId}:`,
      error as any,
    );
    throw error;
  }
};

/**
 * Check if a specific exam has recent knowledge pooling data (within last 7 days)
 */
export const hasRecentExamKnowledgePooling = async (
  apiUserId: string,
  certId: number,
  examId: string,
  maxAgeInDays: number = 7,
): Promise<boolean> => {
  try {
    const consolidatedData = await getConsolidatedKnowledgePoolingFromFirestore(
      apiUserId,
      certId,
    );

    if (!consolidatedData || !consolidatedData.exam_summaries) {
      return false;
    }

    const examSummary = consolidatedData.exam_summaries.find(
      (summary) => summary.exam_id === examId,
    );

    if (!examSummary || !examSummary.generated_at) {
      return false;
    }

    const generatedAt = new Date(examSummary.generated_at);
    const maxAge = new Date();
    maxAge.setDate(maxAge.getDate() - maxAgeInDays);

    const isRecent = generatedAt > maxAge;

    logger.info(
      `Exam knowledge pooling age check for user ${apiUserId}, cert ${certId}, exam ${examId}: ${
        isRecent ? 'recent' : 'outdated'
      }`,
      {
        generated_at: examSummary.generated_at,
        max_age_days: maxAgeInDays,
        is_recent: isRecent,
      },
    );

    return isRecent;
  } catch (error) {
    logger.error(
      `Error checking exam knowledge pooling age for user ${apiUserId}, cert ${certId}, exam ${examId}:`,
      error as any,
    );
    return false;
  }
};

/**
 * Get insights from a specific exam from consolidated data
 */
export const getInsightsByExamId = async (
  apiUserId: string,
  certId: number,
  examId: string,
): Promise<KnowledgePoolingItem[]> => {
  try {
    const consolidatedData = await getConsolidatedKnowledgePoolingFromFirestore(
      apiUserId,
      certId,
    );

    if (!consolidatedData || !consolidatedData.knowledge_insights) {
      return [];
    }

    // Filter insights to only include those from the specified exam
    const examInsights: KnowledgePoolingItem[] =
      consolidatedData.knowledge_insights
        .map((topicItem) => ({
          topic: topicItem.topic,
          insights: topicItem.insights.filter(
            (insight) => insight.exam_id === examId,
          ),
        }))
        .filter((topicItem) => topicItem.insights.length > 0); // Only include topics that have insights from this exam

    logger.info(
      `Retrieved insights for exam ${examId} from user ${apiUserId}, cert ${certId}`,
      {
        total_topics: examInsights.length,
        total_insights: examInsights.reduce(
          (sum, topic) => sum + topic.insights.length,
          0,
        ),
      },
    );

    return examInsights;
  } catch (error) {
    logger.error(
      `Error retrieving insights for exam ${examId} from user ${apiUserId}, cert ${certId}:`,
      error as any,
    );
    throw error;
  }
};

/**
 * Delete knowledge pooling data for a specific exam
 */
export const deleteExamKnowledgePoolingFromFirestore = async (
  apiUserId: string,
  certId: number,
  examId: string,
): Promise<ConsolidatedKnowledgePoolingData | null> => {
  try {
    const consolidatedData = await getConsolidatedKnowledgePoolingFromFirestore(
      apiUserId,
      certId,
    );

    if (!consolidatedData) {
      logger.info(
        `No knowledge pooling data to delete for user ${apiUserId}, cert ${certId}, exam ${examId}`,
      );
      return null;
    }

    // Remove the specific exam
    const updatedExamSummaries = consolidatedData.exam_summaries.filter(
      (summary) => summary.exam_id !== examId,
    );

    if (updatedExamSummaries.length === 0) {
      // If no exams left, delete the entire knowledge_pooling field
      const docPath = `users/${apiUserId}/certs/${certId}`;
      const docRef = firestore.doc(docPath);

      await docRef.update({
        knowledge_pooling: FieldValue.delete(),
      });

      logger.info(
        `All knowledge pooling data deleted for user ${apiUserId}, cert ${certId}`,
      );
      return null;
    }

    // Remove insights from the specific exam
    const updatedKnowledgeInsights = consolidatedData.knowledge_insights
      .map((topicItem) => ({
        topic: topicItem.topic,
        insights: topicItem.insights.filter(
          (insight) => insight.exam_id !== examId,
        ),
      }))
      .filter((topicItem) => topicItem.insights.length > 0); // Remove topics with no remaining insights

    const updatedData: ConsolidatedKnowledgePoolingData = {
      ...consolidatedData,
      knowledge_insights: updatedKnowledgeInsights,
      exam_summaries: updatedExamSummaries,
      total_exams_analyzed: updatedExamSummaries.length,
      total_incorrect_answers: updatedExamSummaries.reduce(
        (sum, exam) => sum + exam.total_incorrect_answers,
        0,
      ),
      total_topics_analyzed: updatedKnowledgeInsights.length,
      last_updated: new Date().toISOString(),
    };

    // Save updated data
    const docPath = `users/${apiUserId}/certs/${certId}`;
    const docRef = firestore.doc(docPath);

    await docRef.set(
      {
        knowledge_pooling: updatedData,
      },
      { merge: true },
    );

    logger.info(
      `Exam knowledge pooling data deleted for user ${apiUserId}, cert ${certId}, exam ${examId}`,
    );

    return updatedData;
  } catch (error) {
    logger.error(
      `Error deleting exam knowledge pooling data for user ${apiUserId}, cert ${certId}, exam ${examId}:`,
      error as any,
    );
    throw error;
  }
};

/**
 * Merge knowledge insights by topic, avoiding duplicates and combining similar insights
 */
function mergeKnowledgeInsightsByTopic(
  existingInsights: KnowledgePoolingItem[],
  newInsights: KnowledgePoolingItem[],
  examId: string,
  generatedAt: string,
): KnowledgePoolingItem[] {
  const topicMap = new Map<string, KnowledgeInsight[]>();

  // Add existing insights
  existingInsights.forEach((item) => {
    topicMap.set(item.topic, [...(item.insights || [])]);
  });

  // Add new insights, avoiding duplicates
  newInsights.forEach((item) => {
    const existingTopicInsights = topicMap.get(item.topic) || [];
    const newTopicInsights = [...existingTopicInsights];

    item.insights.forEach((newInsight) => {
      // Check for duplicate insights (simple string comparison)
      const isDuplicate = existingTopicInsights.some(
        (existing) =>
          existing.insight.toLowerCase().trim() ===
          newInsight.insight.toLowerCase().trim(),
      );

      if (!isDuplicate) {
        // Add exam_id and generated_at to the new insight
        const enhancedInsight: KnowledgeInsight = {
          ...newInsight,
          exam_id: examId,
          generated_at: generatedAt,
        };
        newTopicInsights.push(enhancedInsight);
      }
    });

    topicMap.set(item.topic, newTopicInsights);
  });

  // Convert back to array format
  return Array.from(topicMap.entries()).map(([topic, insights]) => ({
    topic,
    insights,
  }));
}

/**
 * Generate a consolidated summary from multiple exam summaries
 */
function generateConsolidatedSummary(
  examSummaries: Array<{
    exam_id: string;
    summary: string;
    total_incorrect_answers: number;
  }>,
  certificationName: string,
): string {
  const totalExams = examSummaries.length;
  const totalIncorrect = examSummaries.reduce(
    (sum, exam) => sum + exam.total_incorrect_answers,
    0,
  );

  if (totalExams === 1) {
    return examSummaries[0].summary;
  }

  return `Based on analysis of ${totalExams} ${certificationName} exams with ${totalIncorrect} total incorrect answers, your main learning areas include the key concepts and misconceptions identified across your exam history. Focus on the consolidated insights to strengthen your understanding and avoid repeating similar mistakes.`;
}
