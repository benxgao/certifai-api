import { firestoreService } from '../../services/firebase/firestore';
import logger from '../../services/firebase/logger';
import { StripeCustomerData, SubscriptionData } from './service';

export class StripeFirestoreService {
  private static readonly CUSTOMERS_COLLECTION = 'stripe_customers';
  private static readonly SUBSCRIPTIONS_COLLECTION = 'stripe_subscriptions';

  /**
   * Store customer data in Firestore
   */
  static async storeCustomer(customerData: StripeCustomerData): Promise<void> {
    try {
      await firestoreService.create(
        `${this.CUSTOMERS_COLLECTION}`,
        customerData,
        customerData.customer_id,
      );

      logger.info(
        `FIRESTORE_STRIPE_CUSTOMER_STORED: ${customerData.customer_id}`,
        {
          customer_id: customerData.customer_id,
          firebase_uid: customerData.firebase_uid,
          email: customerData.email,
        },
      );
    } catch (error) {
      logger.error('FIRESTORE_STRIPE_CUSTOMER_STORE_ERROR', {
        error,
        customer_id: customerData.customer_id,
      });
      throw new Error(`Failed to store customer in Firestore: ${error}`);
    }
  }

  /**
   * Get customer by Firebase UID
   */
  static async getCustomerByFirebaseUid(
    firebaseUid: string,
  ): Promise<StripeCustomerData | null> {
    try {
      const customers = await firestoreService.list<StripeCustomerData>(
        this.CUSTOMERS_COLLECTION,
        {
          where: [
            { field: 'firebase_uid', operator: '==', value: firebaseUid },
          ],
          limit: 1,
        },
      );

      return customers.length > 0 ? customers[0] : null;
    } catch (error) {
      logger.error('FIRESTORE_STRIPE_CUSTOMER_GET_ERROR', {
        error,
        firebase_uid: firebaseUid,
      });
      return null;
    }
  }

  /**
   * Store subscription data in Firestore
   */
  static async storeSubscription(
    subscriptionData: SubscriptionData,
  ): Promise<void> {
    try {
      await firestoreService.create(
        this.SUBSCRIPTIONS_COLLECTION,
        subscriptionData,
        subscriptionData.subscription_id,
      );

      logger.info(
        `FIRESTORE_STRIPE_SUBSCRIPTION_STORED: ${subscriptionData.subscription_id}`,
        {
          subscription_id: subscriptionData.subscription_id,
          customer_id: subscriptionData.customer_id,
          status: subscriptionData.status,
        },
      );
    } catch (error) {
      logger.error('FIRESTORE_STRIPE_SUBSCRIPTION_STORE_ERROR', {
        error,
        subscription_id: subscriptionData.subscription_id,
      });
      throw new Error(`Failed to store subscription in Firestore: ${error}`);
    }
  }

  /**
   * Update subscription status
   */
  static async updateSubscriptionStatus(
    subscriptionId: string,
    status: string,
    currentPeriodStart?: number,
    currentPeriodEnd?: number,
  ): Promise<void> {
    try {
      const updateData: Partial<SubscriptionData> = {
        status: status as SubscriptionData['status'],
        updated_at: new Date().toISOString(),
      };

      if (currentPeriodStart)
        updateData.current_period_start = currentPeriodStart;
      if (currentPeriodEnd) updateData.current_period_end = currentPeriodEnd;

      await firestoreService.update(
        this.SUBSCRIPTIONS_COLLECTION,
        subscriptionId,
        updateData,
      );

      logger.info(`FIRESTORE_STRIPE_SUBSCRIPTION_UPDATED: ${subscriptionId}`, {
        subscription_id: subscriptionId,
        status,
      });
    } catch (error) {
      logger.error('FIRESTORE_STRIPE_SUBSCRIPTION_UPDATE_ERROR', {
        error,
        subscription_id: subscriptionId,
      });
      throw new Error(`Failed to update subscription in Firestore: ${error}`);
    }
  }

  /**
   * Get active subscription for customer
   */
  static async getActiveSubscription(
    customerId: string,
  ): Promise<SubscriptionData | null> {
    try {
      const subscriptions = await firestoreService.list<SubscriptionData>(
        this.SUBSCRIPTIONS_COLLECTION,
        {
          where: [
            { field: 'customer_id', operator: '==', value: customerId },
            { field: 'status', operator: 'in', value: ['active', 'trialing'] },
          ],
          orderBy: [{ field: 'created_at', direction: 'desc' }],
          limit: 1,
        },
      );

      return subscriptions.length > 0 ? subscriptions[0] : null;
    } catch (error) {
      logger.error('FIRESTORE_STRIPE_SUBSCRIPTION_GET_ERROR', {
        error,
        customer_id: customerId,
      });
      return null;
    }
  }
}
