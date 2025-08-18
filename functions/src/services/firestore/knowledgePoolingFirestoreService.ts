import { FieldValue } from 'firebase-admin/firestore';
import { firebaseFirestore } from '../firebase/admin';
import logger from '../firebase/logger';

// Get Firestore instance
const firestore = firebaseFirestore;

export interface KnowledgeInsight {
  insight: string;
  context: string;
}

export interface KnowledgePoolingItem {
  topic: string;
  insights: KnowledgeInsight[];
}

export interface KnowledgePoolingData {
  knowledge_insights: KnowledgePoolingItem[];
  summary: string;
  generated_at: string;
  cert_id: number;
  certification_name: string;
  total_incorrect_answers: number;
  topics_analyzed: number;
}

/**
 * Save knowledge pooling data to Firestore
 * Path: users/:api_user_id/certs/:cert_id/knowledge_pooling (document)
 */
export const saveKnowledgePoolingToFirestore = async (
  apiUserId: string,
  certId: number,
  knowledgeData: KnowledgePoolingData,
): Promise<void> => {
  try {
    const docPath = `users/${apiUserId}/certs/${certId}`;
    const docRef = firestore.doc(docPath);

    // Prepare the data for Firestore
    const firestoreData = {
      knowledge_pooling: {
        ...knowledgeData,
        last_updated: new Date().toISOString(),
      },
    };

    // Use merge to update only the knowledge_pooling field
    await docRef.set(firestoreData, { merge: true });

    logger.info(
      `Knowledge pooling data saved to Firestore for user ${apiUserId}, cert ${certId}`,
      {
        path: docPath,
        topics_count: knowledgeData.knowledge_insights.length,
        total_insights: knowledgeData.knowledge_insights.reduce(
          (sum, topic) => sum + topic.insights.length,
          0,
        ),
      },
    );
  } catch (error) {
    logger.error(
      `Error saving knowledge pooling data to Firestore for user ${apiUserId}, cert ${certId}:`,
      error as any,
    );
    throw error;
  }
};

/**
 * Get knowledge pooling data from Firestore
 * Path: users/:api_user_id/certs/:cert_id/knowledge_pooling
 */
export const getKnowledgePoolingFromFirestore = async (
  apiUserId: string,
  certId: number,
): Promise<KnowledgePoolingData | null> => {
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
      `Knowledge pooling data retrieved from Firestore for user ${apiUserId}, cert ${certId}`,
      {
        path: docPath,
        topics_count: knowledgePooling.knowledge_insights?.length || 0,
      },
    );

    return knowledgePooling as KnowledgePoolingData;
  } catch (error) {
    logger.error(
      `Error retrieving knowledge pooling data from Firestore for user ${apiUserId}, cert ${certId}:`,
      error as any,
    );
    throw error;
  }
};

/**
 * Check if knowledge pooling data exists and is recent (within last 7 days)
 */
export const isKnowledgePoolingDataRecent = async (
  apiUserId: string,
  certId: number,
  maxAgeInDays: number = 7,
): Promise<boolean> => {
  try {
    const knowledgeData = await getKnowledgePoolingFromFirestore(
      apiUserId,
      certId,
    );

    if (!knowledgeData || !knowledgeData.generated_at) {
      return false;
    }

    const generatedAt = new Date(knowledgeData.generated_at);
    const maxAge = new Date();
    maxAge.setDate(maxAge.getDate() - maxAgeInDays);

    const isRecent = generatedAt > maxAge;

    logger.info(
      `Knowledge pooling data age check for user ${apiUserId}, cert ${certId}: ${
        isRecent ? 'recent' : 'outdated'
      }`,
      {
        generated_at: knowledgeData.generated_at,
        max_age_days: maxAgeInDays,
        is_recent: isRecent,
      },
    );

    return isRecent;
  } catch (error) {
    logger.error(
      `Error checking knowledge pooling data age for user ${apiUserId}, cert ${certId}:`,
      error as any,
    );
    return false; // Assume outdated if we can't check
  }
};

/**
 * Delete knowledge pooling data from Firestore
 */
export const deleteKnowledgePoolingFromFirestore = async (
  apiUserId: string,
  certId: number,
): Promise<void> => {
  try {
    const docPath = `users/${apiUserId}/certs/${certId}`;
    const docRef = firestore.doc(docPath);

    // Remove only the knowledge_pooling field
    await docRef.update({
      knowledge_pooling: FieldValue.delete(),
    });

    logger.info(
      `Knowledge pooling data deleted from Firestore for user ${apiUserId}, cert ${certId}`,
      { path: docPath },
    );
  } catch (error) {
    logger.error(
      `Error deleting knowledge pooling data from Firestore for user ${apiUserId}, cert ${certId}:`,
      error as any,
    );
    throw error;
  }
};
