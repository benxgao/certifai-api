import {
  getFirestore,
  Firestore,
  DocumentReference,
  CollectionReference,
  Query,
} from 'firebase-admin/firestore';
import logger from './logger';

/**
 * Firestore service providing CRUD operations
 * Follows certifai patterns with error handling and logging
 */
class FirestoreService {
  private db: Firestore;

  constructor() {
    this.db = getFirestore();
  }

  /**
   * Create a new document in a collection
   * @param collectionPath - Path to the collection
   * @param data - Document data
   * @param docId - Optional document ID, if not provided Firestore will auto-generate
   * @returns Promise<DocumentReference>
   */
  async create<T extends Record<string, any>>(
    collectionPath: string,
    data: T,
    docId?: string,
  ): Promise<DocumentReference> {
    try {
      const timestamp = new Date();
      const documentData = {
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      let docRef: DocumentReference;

      if (docId) {
        docRef = this.db.collection(collectionPath).doc(docId);
        await docRef.set(documentData);
      } else {
        docRef = await this.db.collection(collectionPath).add(documentData);
      }

      logger.info(`Document created in ${collectionPath}`, {
        docId: docRef.id,
      });
      return docRef;
    } catch (error) {
      logger.error(`Failed to create document in ${collectionPath}`, { error });
      throw error;
    }
  }

  /**
   * Read a single document by ID
   * @param collectionPath - Path to the collection
   * @param docId - Document ID
   * @returns Promise<T | null>
   */
  async read<T = Record<string, any>>(
    collectionPath: string,
    docId: string,
  ): Promise<T | null> {
    try {
      const docRef = this.db.collection(collectionPath).doc(docId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      return { id: doc.id, ...doc.data() } as T;
    } catch (error) {
      logger.error(`Failed to read document ${docId} from ${collectionPath}`, {
        error,
      });
      throw error;
    }
  }

  /**
   * Update a document
   * @param collectionPath - Path to the collection
   * @param docId - Document ID
   * @param data - Partial data to update
   * @returns Promise<void>
   */
  async update<T extends Record<string, any>>(
    collectionPath: string,
    docId: string,
    data: Partial<T>,
  ): Promise<void> {
    try {
      const docRef = this.db.collection(collectionPath).doc(docId);
      const updateData = {
        ...data,
        updatedAt: new Date(),
      };

      await docRef.update(updateData);
      logger.info(`Document ${docId} updated in ${collectionPath}`);
    } catch (error) {
      logger.error(`Failed to update document ${docId} in ${collectionPath}`, {
        error,
      });
      throw error;
    }
  }

  /**
   * Delete a document
   * @param collectionPath - Path to the collection
   * @param docId - Document ID
   * @returns Promise<void>
   */
  async delete(collectionPath: string, docId: string): Promise<void> {
    try {
      const docRef = this.db.collection(collectionPath).doc(docId);
      await docRef.delete();
      logger.info(`Document ${docId} deleted from ${collectionPath}`);
    } catch (error) {
      logger.error(
        `Failed to delete document ${docId} from ${collectionPath}`,
        { error },
      );
      throw error;
    }
  }

  /**
   * List documents with optional filtering and pagination
   * @param collectionPath - Path to the collection
   * @param options - Query options
   * @returns Promise<T[]>
   */
  async list<T = Record<string, any>>(
    collectionPath: string,
    options: {
      where?: Array<{
        field: string;
        operator: FirebaseFirestore.WhereFilterOp;
        value: any;
      }>;
      orderBy?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
      limit?: number;
      startAfter?: FirebaseFirestore.DocumentSnapshot;
    } = {},
  ): Promise<T[]> {
    try {
      let query: Query = this.db.collection(collectionPath);

      // Apply where conditions
      if (options.where) {
        options.where.forEach(({ field, operator, value }) => {
          query = query.where(field, operator, value);
        });
      }

      // Apply ordering
      if (options.orderBy) {
        options.orderBy.forEach(({ field, direction = 'asc' }) => {
          query = query.orderBy(field, direction);
        });
      }

      // Apply pagination
      if (options.startAfter) {
        query = query.startAfter(options.startAfter);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
    } catch (error) {
      logger.error(`Failed to list documents from ${collectionPath}`, {
        error,
      });
      throw error;
    }
  }

  /**
   * Count documents in a collection with optional filtering
   * @param collectionPath - Path to the collection
   * @param where - Optional where conditions
   * @returns Promise<number>
   */
  async count(
    collectionPath: string,
    where?: Array<{
      field: string;
      operator: FirebaseFirestore.WhereFilterOp;
      value: any;
    }>,
  ): Promise<number> {
    try {
      let query: Query = this.db.collection(collectionPath);

      if (where) {
        where.forEach(({ field, operator, value }) => {
          query = query.where(field, operator, value);
        });
      }

      const snapshot = await query.count().get();
      return snapshot.data().count;
    } catch (error) {
      logger.error(`Failed to count documents in ${collectionPath}`, { error });
      throw error;
    }
  }

  /**
   * Check if a document exists
   * @param collectionPath - Path to the collection
   * @param docId - Document ID
   * @returns Promise<boolean>
   */
  async exists(collectionPath: string, docId: string): Promise<boolean> {
    try {
      const docRef = this.db.collection(collectionPath).doc(docId);
      const doc = await docRef.get();
      return doc.exists;
    } catch (error) {
      logger.error(
        `Failed to check existence of document ${docId} in ${collectionPath}`,
        { error },
      );
      throw error;
    }
  }

  /**
   * Batch operations for multiple documents
   * @param operations - Array of batch operations
   * @returns Promise<void>
   */
  async batch(
    operations: Array<{
      type: 'create' | 'update' | 'delete';
      collectionPath: string;
      docId?: string;
      data?: any;
    }>,
  ): Promise<void> {
    try {
      const batch = this.db.batch();
      const timestamp = new Date();

      operations.forEach(({ type, collectionPath, docId, data }) => {
        const collection = this.db.collection(collectionPath);

        switch (type) {
          case 'create':
            if (docId) {
              const docRef = collection.doc(docId);
              batch.set(docRef, {
                ...data,
                createdAt: timestamp,
                updatedAt: timestamp,
              });
            } else {
              throw new Error(
                'Document ID is required for batch create operations',
              );
            }
            break;

          case 'update': {
            if (!docId)
              throw new Error('Document ID is required for update operations');
            const updateDocRef = collection.doc(docId);
            batch.update(updateDocRef, { ...data, updatedAt: timestamp });
            break;
          }

          case 'delete': {
            if (!docId)
              throw new Error('Document ID is required for delete operations');
            const deleteDocRef = collection.doc(docId);
            batch.delete(deleteDocRef);
            break;
          }
        }
      });

      await batch.commit();
      logger.info(
        `Batch operation completed with ${operations.length} operations`,
      );
    } catch (error) {
      logger.error('Failed to execute batch operation', { error });
      throw error;
    }
  }

  /**
   * Get a reference to a collection
   * @param collectionPath - Path to the collection
   * @returns CollectionReference
   */
  getCollection(collectionPath: string): CollectionReference {
    return this.db.collection(collectionPath);
  }

  /**
   * Get a reference to a document
   * @param collectionPath - Path to the collection
   * @param docId - Document ID
   * @returns DocumentReference
   */
  getDocument(collectionPath: string, docId: string): DocumentReference {
    return this.db.collection(collectionPath).doc(docId);
  }

  /**
   * Run a transaction
   * @param updateFunction - Function to run in transaction
   * @returns Promise<T>
   */
  async runTransaction<T>(
    updateFunction: (transaction: FirebaseFirestore.Transaction) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.runTransaction(updateFunction);
    } catch (error) {
      logger.error('Failed to run transaction', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const firestoreService = new FirestoreService();

// Export Firestore instance for direct access if needed
export const firestore = getFirestore();

// Common collection paths (add your collections here)
export const COLLECTIONS = {
  USERS: 'users',
  CERTIFICATIONS: 'certifications',
  EXAMS: 'exams',
  EXAM_RESULTS: 'examResults',
  QUESTIONS: 'questions',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
