/**
 * STRIPE FIRESTORE INTEGRATION TYPES
 *
 * Type definitions for Stripe and Firestore data structures
 */

/**
 * Minimal account data structure for Firestore storage
 * ONLY stores essential identifiers and basic info - detailed data is fetched from Stripe API
 */
export interface AccountData {
  // Primary key - API user ID
  api_user_id: string;

  // Reference data
  firebase_user_id: string;
  email: string;

  // Stripe customer (minimal - just ID)
  stripe_customer_id?: string;

  // Stripe subscription (minimal - just ID and status for quick checks)
  stripe_subscription_id?: string;
  stripe_subscription_status?: string;

  // Essential dates only
  stripe_current_period_start?: number; // Keep for billing period info
  stripe_current_period_end?: number; // Keep for quick expiry checks

  stripe_cancel_at_period_end?: boolean; // Keep for cancellation status

  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Complete account data enriched with full Stripe API details
 * This interface includes all detailed subscription information fetched from Stripe
 */
export interface FullAccountData extends AccountData {
  // Full subscription details from Stripe API
  stripe_current_period_start?: number;
  stripe_current_period_end?: number;
  stripe_plan_id?: string;
  stripe_plan_name?: string;
  stripe_amount?: number;
  stripe_currency?: string;
  stripe_trial_end?: number;
  stripe_canceled_at?: number;
  stripe_subscription_created_at?: string;
  stripe_subscription_updated_at?: string;

  // Latest invoice info from Stripe API
  stripe_latest_invoice_id?: string;
  stripe_latest_invoice_status?: string;
  stripe_latest_invoice_amount?: number;
  stripe_latest_invoice_created_at?: string;

  // Customer details from Stripe API
  stripe_customer_created_at?: string;
  stripe_customer_updated_at?: string;
  stripe_customer_deleted?: boolean;
  stripe_customer_deleted_at?: string;

  // Metadata about data source
  _stripe_data_fetched_at?: string;
  _data_source: 'stripe_live';
}
