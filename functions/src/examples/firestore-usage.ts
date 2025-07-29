import { firestoreService, COLLECTIONS } from '../services/firebase/firestore';

/**
 * Example usage of Firestore CRUD functions
 * This file demonstrates common patterns for using the firestoreService
 */

// Example interfaces (adjust based on your data models)
interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'instructor' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

interface Certification {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User management examples
 */
export class UserService {
  // Create a new user
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) {
    const docRef = await firestoreService.create(COLLECTIONS.USERS, userData);
    return docRef.id;
  }

  // Get user by ID
  async getUserById(userId: string): Promise<User | null> {
    return await firestoreService.read<User>(COLLECTIONS.USERS, userId);
  }

  // Update user
  async updateUser(
    userId: string,
    updates: Partial<Omit<User, 'id' | 'createdAt'>>,
  ) {
    await firestoreService.update(COLLECTIONS.USERS, userId, updates);
  }

  // Delete user
  async deleteUser(userId: string) {
    await firestoreService.delete(COLLECTIONS.USERS, userId);
  }

  // Get users with pagination
  async getUsers(limit: number = 20, role?: User['role']): Promise<User[]> {
    const options: any = {
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      limit,
    };

    if (role) {
      options.where = [{ field: 'role', operator: '==', value: role }];
    }

    return await firestoreService.list<User>(COLLECTIONS.USERS, options);
  }

  // Check if user exists
  async userExists(userId: string): Promise<boolean> {
    return await firestoreService.exists(COLLECTIONS.USERS, userId);
  }

  // Count users by role
  async countUsersByRole(role: User['role']): Promise<number> {
    return await firestoreService.count(COLLECTIONS.USERS, [
      { field: 'role', operator: '==', value: role },
    ]);
  }
}

/**
 * Certification management examples
 */
export class CertificationService {
  // Create certification
  async createCertification(
    certData: Omit<Certification, 'id' | 'createdAt' | 'updatedAt'>,
  ) {
    const docRef = await firestoreService.create(
      COLLECTIONS.CERTIFICATIONS,
      certData,
    );
    return docRef.id;
  }

  // Get active certifications
  async getActiveCertifications(): Promise<Certification[]> {
    return await firestoreService.list<Certification>(
      COLLECTIONS.CERTIFICATIONS,
      {
        where: [{ field: 'isActive', operator: '==', value: true }],
        orderBy: [{ field: 'title', direction: 'asc' }],
      },
    );
  }

  // Get certifications by category
  async getCertificationsByCategory(
    category: string,
  ): Promise<Certification[]> {
    return await firestoreService.list<Certification>(
      COLLECTIONS.CERTIFICATIONS,
      {
        where: [
          { field: 'category', operator: '==', value: category },
          { field: 'isActive', operator: '==', value: true },
        ],
        orderBy: [{ field: 'difficulty', direction: 'asc' }],
      },
    );
  }

  // Update certification status
  async toggleCertificationStatus(certId: string) {
    const cert = await firestoreService.read<Certification>(
      COLLECTIONS.CERTIFICATIONS,
      certId,
    );
    if (cert) {
      await firestoreService.update(COLLECTIONS.CERTIFICATIONS, certId, {
        isActive: !cert.isActive,
      });
    }
  }
}

/**
 * Batch operations example
 */
export class BatchOperationsService {
  // Bulk create users
  async bulkCreateUsers(
    users: Array<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>,
  ) {
    const operations = users.map((user, index) => ({
      type: 'create' as const,
      collectionPath: COLLECTIONS.USERS,
      docId: `user_${Date.now()}_${index}`, // Generate unique IDs
      data: user,
    }));

    await firestoreService.batch(operations);
  }

  // Bulk update certifications
  async bulkUpdateCertifications(
    updates: Array<{ id: string; data: Partial<Certification> }>,
  ) {
    const operations = updates.map(({ id, data }) => ({
      type: 'update' as const,
      collectionPath: COLLECTIONS.CERTIFICATIONS,
      docId: id,
      data,
    }));

    await firestoreService.batch(operations);
  }
}

/**
 * Transaction example
 */
export class TransactionService {
  // Transfer user between groups (hypothetical scenario)
  async transferUserBetweenGroups(
    userId: string,
    fromGroupId: string,
    toGroupId: string,
  ) {
    return await firestoreService.runTransaction(async (transaction) => {
      // Read current state
      const userRef = firestoreService.getDocument(COLLECTIONS.USERS, userId);
      const fromGroupRef = firestoreService.getDocument('groups', fromGroupId);
      const toGroupRef = firestoreService.getDocument('groups', toGroupId);

      const userDoc = await transaction.get(userRef);
      const fromGroupDoc = await transaction.get(fromGroupRef);
      const toGroupDoc = await transaction.get(toGroupRef);

      if (!userDoc.exists || !fromGroupDoc.exists || !toGroupDoc.exists) {
        throw new Error('One or more documents do not exist');
      }

      // Update documents atomically
      transaction.update(userRef, {
        groupId: toGroupId,
        updatedAt: new Date(),
      });
      transaction.update(fromGroupRef, {
        memberCount: fromGroupDoc.data()?.memberCount - 1,
        updatedAt: new Date(),
      });
      transaction.update(toGroupRef, {
        memberCount: toGroupDoc.data()?.memberCount + 1,
        updatedAt: new Date(),
      });

      return { success: true };
    });
  }
}

// Export service instances
export const userService = new UserService();
export const certificationService = new CertificationService();
export const batchOperationsService = new BatchOperationsService();
export const transactionService = new TransactionService();
