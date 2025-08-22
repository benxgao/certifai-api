import { FieldValue } from 'firebase-admin/firestore';
import { firebaseFirestore } from '../firebase/admin';
import logger from '../firebase/logger';
import { randomUUID } from 'crypto';

// Get Firestore instance
const firestore = firebaseFirestore;

export interface KnowledgeInsight {
  insight_id: string;
  insight: string;
  topic: string;
  exam_id: string;
  generated_at: string;
}

export interface ExamKnowledgePoolingData {
  exam_id: string;
  knowledge_insights: KnowledgeInsight[];
  summary: string;
  generated_at: string;
  cert_id: number;
  certification_name: string;
  total_incorrect_answers: number;
  topics_analyzed: number;
}

export interface ConsolidatedKnowledgePoolingData {
  knowledge_insights: KnowledgeInsight[];
  last_updated: string;
  cert_id: number;
  certification_name: string;
}

/**
 * Merge knowledge insights, avoiding duplicates
 */
function mergeKnowledgeInsights(
  existingInsights: KnowledgeInsight[],
  newInsights: KnowledgeInsight[],
  examId: string,
  generatedAt: string,
): KnowledgeInsight[] {
  const merged = [...existingInsights];

  newInsights.forEach((newInsight) => {
    const isDuplicate = merged.some((existing) => {
      return (
        existing.insight.toLowerCase().trim() ===
        newInsight.insight.toLowerCase().trim()
      );
    });

    if (!isDuplicate) {
      merged.push({
        ...newInsight,
        insight_id: newInsight.insight_id || generateInsightId(),
        exam_id: examId,
        generated_at: generatedAt,
      });
    }
  });

  return merged;
}

/**
 * Generate a unique insight ID
 */
function generateInsightId(): string {
  return randomUUID();
}

/**
 * Save exam knowledge pooling data to Firestore
 *
 * @param apiUserId - The user's API ID
 * @param examData - The exam knowledge pooling data to save
 * @param forceRegenerate - If true, removes existing knowledge pooling data for this specific exam before adding new data
 * @returns Consolidated knowledge pooling data including all exams for the certification
 */
export const saveExamKnowledgePoolingToFirestore = async (
  apiUserId: string,
  examData: ExamKnowledgePoolingData,
  forceRegenerate: boolean = false,
): Promise<ConsolidatedKnowledgePoolingData> => {
  try {
    const docPath = `users/${apiUserId}/certs/${examData.cert_id}`;
    const docRef = firestore.doc(docPath);

    const existingDoc = await docRef.get();
    const existingData = existingDoc.exists
      ? existingDoc.data()?.knowledge_pooling
      : null;

    let existingInsights = existingData?.knowledge_insights || [];

    // If force regenerate is true, remove all existing data for this specific exam
    if (forceRegenerate) {
      logger.info(
        `Force regenerate enabled: removing existing knowledge pooling data for exam ${examData.exam_id}`,
        {
          apiUserId,
          cert_id: examData.cert_id,
          exam_id: examData.exam_id,
          previous_insights_count: existingInsights.length,
        },
      );

      // Remove insights from this specific exam
      const insightsBeforeFilter = existingInsights.length;
      existingInsights = existingInsights.filter(
        (insight: KnowledgeInsight) => insight.exam_id !== examData.exam_id,
      );
      const insightsAfterFilter = existingInsights.length;

      logger.info(
        `Force regenerate cleanup completed for exam ${examData.exam_id}`,
        {
          insights_removed: insightsBeforeFilter - insightsAfterFilter,
          remaining_insights: insightsAfterFilter,
        },
      );
    }

    const mergedInsights = mergeKnowledgeInsights(
      existingInsights,
      examData.knowledge_insights,
      examData.exam_id,
      examData.generated_at,
    );

    const consolidatedData: ConsolidatedKnowledgePoolingData = {
      knowledge_insights: mergedInsights,
      last_updated: new Date().toISOString(),
      cert_id: examData.cert_id,
      certification_name: examData.certification_name,
    };

    await docRef.set({ knowledge_pooling: consolidatedData }, { merge: true });

    logger.info(
      `Exam knowledge pooling data saved and ${
        forceRegenerate ? 'force regenerated' : 'merged'
      } for user ${apiUserId}, cert ${examData.cert_id}, exam ${
        examData.exam_id
      }`,
      {
        path: docPath,
        total_insights: consolidatedData.knowledge_insights.length,
        force_regenerate: forceRegenerate,
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
        has_insights:
          Array.isArray(knowledgePooling.knowledge_insights) &&
          knowledgePooling.knowledge_insights.length > 0,
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

    if (!consolidatedData || !consolidatedData.knowledge_insights) {
      return false;
    }

    // Find the most recent insight for this exam
    const examInsights = consolidatedData.knowledge_insights.filter(
      (insight) => insight.exam_id === examId,
    );

    if (examInsights.length === 0) {
      return false;
    }

    // Find the most recent insight for this exam
    const mostRecentInsight = examInsights.reduce((latest, current) => {
      return new Date(current.generated_at) > new Date(latest.generated_at)
        ? current
        : latest;
    });

    const generatedAt = new Date(mostRecentInsight.generated_at);
    const maxAge = new Date();
    maxAge.setDate(maxAge.getDate() - maxAgeInDays);

    const isRecent = generatedAt > maxAge;

    logger.info(
      `Exam knowledge pooling age check for user ${apiUserId}, cert ${certId}, exam ${examId}: ${
        isRecent ? 'recent' : 'outdated'
      }`,
      {
        generated_at: mostRecentInsight.generated_at,
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
 * Get insights from a specific exam
 */
export const getFlattenedInsightsByExamId = async (
  apiUserId: string,
  certId: number,
  examId: string,
): Promise<KnowledgeInsight[]> => {
  try {
    const consolidatedData = await getConsolidatedKnowledgePoolingFromFirestore(
      apiUserId,
      certId,
    );

    if (!consolidatedData?.knowledge_insights) {
      return [];
    }

    const examInsights = consolidatedData.knowledge_insights.filter(
      (insight) => insight.exam_id === examId,
    );

    logger.info(
      `Retrieved insights for exam ${examId} from user ${apiUserId}, cert ${certId}`,
      {
        total_insights: examInsights.length,
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

    const updatedKnowledgeInsights = consolidatedData.knowledge_insights.filter(
      (insight) => insight.exam_id !== examId,
    );

    // If no insights remain, delete the entire knowledge_pooling field
    if (updatedKnowledgeInsights.length === 0) {
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

    const updatedData: ConsolidatedKnowledgePoolingData = {
      ...consolidatedData,
      knowledge_insights: updatedKnowledgeInsights,
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
