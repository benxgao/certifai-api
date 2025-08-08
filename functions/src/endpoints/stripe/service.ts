import Stripe from 'stripe';
import logger from '../../services/firebase/logger';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
  typescript: true,
});

export interface StripeCustomerData {
  customer_id: string;
  email: string;
  firebase_uid: string;
  api_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionData {
  subscription_id: string;
  customer_id: string;
  status: Stripe.Subscription.Status;
  current_period_start: number;
  current_period_end: number;
  plan_id: string;
  plan_name: string;
  amount: number;
  currency: string;
  trial_end?: number;
  cancel_at_period_end: boolean;
  canceled_at?: number;
  created_at: string;
  updated_at: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  popular?: boolean;
}

export class StripeService {
  /**
   * Create or retrieve Stripe customer
   */
  static async createOrGetCustomer(
    email: string,
    firebaseUid: string,
    apiUserId: string,
    name?: string,
  ): Promise<Stripe.Customer> {
    try {
      // Search for existing customer by email
      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        const customer = existingCustomers.data[0];

        // Update metadata if missing
        if (
          !customer.metadata?.firebase_uid ||
          !customer.metadata?.api_user_id
        ) {
          await stripe.customers.update(customer.id, {
            metadata: {
              firebase_uid: firebaseUid,
              api_user_id: apiUserId,
              ...customer.metadata,
            },
          });
        }

        logger.info(`STRIPE_CUSTOMER_FOUND: ${customer.id}`, {
          customer_id: customer.id,
          email,
          firebase_uid: firebaseUid,
        });
        return customer;
      }

      // Create new customer
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          firebase_uid: firebaseUid,
          api_user_id: apiUserId,
        },
      });

      logger.info(`STRIPE_CUSTOMER_CREATED: ${customer.id}`, {
        customer_id: customer.id,
        email,
        firebase_uid: firebaseUid,
      });

      return customer;
    } catch (error) {
      logger.error('STRIPE_CUSTOMER_ERROR', {
        error,
        email,
        firebase_uid: firebaseUid,
      });
      throw new Error(`Failed to create/get Stripe customer: ${error}`);
    }
  }

  /**
   * Create checkout session for subscription
   */
  static async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    firebaseUid: string,
    trialDays?: number,
  ): Promise<Stripe.Checkout.Session> {
    try {
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          firebase_uid: firebaseUid,
        },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        customer_update: {
          address: 'auto',
          name: 'auto',
        },
        subscription_data: {
          metadata: {
            firebase_uid: firebaseUid,
          },
        },
      };

      // Add trial period if specified
      if (trialDays && trialDays > 0) {
        sessionParams.subscription_data!.trial_period_days = trialDays;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      logger.info(`STRIPE_CHECKOUT_SESSION_CREATED: ${session.id}`, {
        session_id: session.id,
        customer_id: customerId,
        price_id: priceId,
        firebase_uid: firebaseUid,
        trial_days: trialDays,
      });

      return session;
    } catch (error) {
      logger.error('STRIPE_CHECKOUT_SESSION_ERROR', {
        error,
        customerId,
        priceId,
      });
      throw new Error(`Failed to create checkout session: ${error}`);
    }
  }

  /**
   * Create customer portal session
   */
  static async createPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<Stripe.BillingPortal.Session> {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      logger.info(`STRIPE_PORTAL_SESSION_CREATED: ${session.id}`, {
        session_id: session.id,
        customer_id: customerId,
      });

      return session;
    } catch (error) {
      logger.error('STRIPE_PORTAL_SESSION_ERROR', { error, customerId });
      throw new Error(`Failed to create portal session: ${error}`);
    }
  }

  /**
   * Get all available pricing plans
   */
  static async getPricingPlans(): Promise<PricingPlan[]> {
    try {
      const prices = await stripe.prices.list({
        active: true,
        expand: ['data.product'],
      });

      return prices.data.map((price) => {
        const product = price.product as Stripe.Product;
        return {
          id: price.id,
          name: product.name,
          description: product.description || '',
          amount: price.unit_amount || 0,
          currency: price.currency,
          interval: price.recurring?.interval as 'month' | 'year',
          features: product.metadata?.features?.split(',') || [],
          popular: product.metadata?.popular === 'true',
        };
      });
    } catch (error) {
      logger.error('STRIPE_GET_PRICING_PLANS_ERROR', { error });
      throw new Error(`Failed to get pricing plans: ${error}`);
    }
  }

  /**
   * Cancel subscription at period end
   */
  static async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true,
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd,
      });

      logger.info(`STRIPE_SUBSCRIPTION_CANCELED: ${subscriptionId}`, {
        subscription_id: subscriptionId,
        cancel_at_period_end: cancelAtPeriodEnd,
      });

      return subscription;
    } catch (error) {
      logger.error('STRIPE_CANCEL_SUBSCRIPTION_ERROR', {
        error,
        subscription_id: subscriptionId,
      });
      throw new Error(`Failed to cancel subscription: ${error}`);
    }
  }

  /**
   * Resume subscription
   */
  static async resumeSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });

      logger.info(`STRIPE_SUBSCRIPTION_RESUMED: ${subscriptionId}`, {
        subscription_id: subscriptionId,
      });

      return subscription;
    } catch (error) {
      logger.error('STRIPE_RESUME_SUBSCRIPTION_ERROR', {
        error,
        subscription_id: subscriptionId,
      });
      throw new Error(`Failed to resume subscription: ${error}`);
    }
  }

  /**
   * Update subscription plan
   */
  static async updateSubscriptionPlan(
    subscriptionId: string,
    newPriceId: string,
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      const updatedSubscription = await stripe.subscriptions.update(
        subscriptionId,
        {
          items: [
            {
              id: subscription.items.data[0].id,
              price: newPriceId,
            },
          ],
          proration_behavior: 'create_prorations',
        },
      );

      logger.info(`STRIPE_SUBSCRIPTION_UPDATED: ${subscriptionId}`, {
        subscription_id: subscriptionId,
        new_price_id: newPriceId,
      });

      return updatedSubscription;
    } catch (error) {
      logger.error('STRIPE_UPDATE_SUBSCRIPTION_ERROR', {
        error,
        subscription_id: subscriptionId,
        new_price_id: newPriceId,
      });
      throw new Error(`Failed to update subscription: ${error}`);
    }
  }

  /**
   * Get subscription by ID
   */
  static async getSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      logger.error('STRIPE_GET_SUBSCRIPTION_ERROR', {
        error,
        subscription_id: subscriptionId,
      });
      throw new Error(`Failed to get subscription: ${error}`);
    }
  }

  /**
   * Get customer by ID
   */
  static async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      return customer as Stripe.Customer;
    } catch (error) {
      logger.error('STRIPE_GET_CUSTOMER_ERROR', {
        error,
        customer_id: customerId,
      });
      throw new Error(`Failed to get customer: ${error}`);
    }
  }

  /**
   * Get the latest active subscription for a customer
   * Returns the most recent subscription (by created date) that is active or trialing
   */
  static async getLatestActiveSubscription(
    customerId: string,
  ): Promise<Stripe.Subscription | null> {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all', // Get all subscriptions to find the latest
        limit: 100, // Increase limit to ensure we get all subscriptions
        expand: ['data.latest_invoice'],
      });

      if (subscriptions.data.length === 0) {
        return null;
      }

      // Filter for active or trialing subscriptions and sort by created date (newest first)
      const activeSubscriptions = subscriptions.data
        .filter((sub) => ['active', 'trialing'].includes(sub.status))
        .sort((a, b) => b.created - a.created);

      if (activeSubscriptions.length > 0) {
        logger.info('STRIPE_LATEST_ACTIVE_SUBSCRIPTION_FOUND', {
          customer_id: customerId,
          subscription_id: activeSubscriptions[0].id,
          status: activeSubscriptions[0].status,
          created: activeSubscriptions[0].created,
          total_subscriptions: subscriptions.data.length,
          active_subscriptions: activeSubscriptions.length,
        });
        return activeSubscriptions[0];
      }

      // If no active subscriptions, return the most recent one (by created date)
      const latestSubscription = subscriptions.data.sort(
        (a, b) => b.created - a.created,
      )[0];

      logger.info('STRIPE_LATEST_SUBSCRIPTION_FOUND_NO_ACTIVE', {
        customer_id: customerId,
        subscription_id: latestSubscription.id,
        status: latestSubscription.status,
        created: latestSubscription.created,
        total_subscriptions: subscriptions.data.length,
      });

      return latestSubscription;
    } catch (error) {
      logger.error('STRIPE_GET_LATEST_SUBSCRIPTION_ERROR', {
        error,
        customer_id: customerId,
      });
      throw new Error(`Failed to get latest subscription: ${error}`);
    }
  }
}
