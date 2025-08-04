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
  created_at: string;
  updated_at: string;
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
        logger.info(`STRIPE_CUSTOMER_FOUND: ${existingCustomers.data[0].id}`, {
          customer_id: existingCustomers.data[0].id,
          email,
          firebase_uid: firebaseUid,
        });
        return existingCustomers.data[0];
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
  ): Promise<Stripe.Checkout.Session> {
    try {
      const session = await stripe.checkout.sessions.create({
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
      });

      logger.info(`STRIPE_CHECKOUT_SESSION_CREATED: ${session.id}`, {
        session_id: session.id,
        customer_id: customerId,
        price_id: priceId,
        firebase_uid: firebaseUid,
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
}
