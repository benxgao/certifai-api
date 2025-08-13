import { AccountData, FullAccountData } from './types';

/**
 * STRIPE FIRESTORE UTILITY FUNCTIONS
 *
 * Common utility functions for data manipulation and validation
 */

/**
 * Clean undefined values from object to prevent Firestore errors
 * Firestore doesn't allow undefined values, so we convert them to null or remove them
 */
export function cleanFirestoreData<T extends Record<string, any>>(
  data: T,
): Partial<T> {
  const cleaned: any = { ...data };

  // Convert undefined values to null for optional fields that should be nullable
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      // For optional Stripe fields, set to null instead of undefined
      if (
        key.startsWith('stripe_') ||
        key.includes('_end') ||
        key.includes('_at')
      ) {
        cleaned[key] = null;
      } else {
        // For other fields, remove the property entirely
        delete cleaned[key];
      }
    }
  });

  return cleaned;
}

/**
 * Compare enriched Stripe data with stored Firestore data to detect changes
 * Returns only the fields that need to be updated
 */
export function detectAccountDataChanges(
  storedAccount: AccountData,
  enrichedAccount: FullAccountData,
): Partial<AccountData> | null {
  const changes: Partial<AccountData> = {};
  let hasChanges = false;

  // List of fields to compare (only minimal data fields that we store in Firestore)
  const fieldsToCompare: (keyof AccountData)[] = [
    'stripe_subscription_status',
    'stripe_current_period_start',
    'stripe_current_period_end',
    'stripe_cancel_at_period_end',
  ];

  for (const field of fieldsToCompare) {
    const storedValue = storedAccount[field];
    const enrichedValue = enrichedAccount[field];

    // Compare values, handling null/undefined differences
    if (storedValue !== enrichedValue) {
      // Special handling for different types of "empty" values
      const isStoredEmpty = storedValue === null || storedValue === undefined;
      const isEnrichedEmpty =
        enrichedValue === null || enrichedValue === undefined;

      // Only consider it a change if both values are not empty, or one is empty and the other is not
      if (!isStoredEmpty || !isEnrichedEmpty) {
        (changes as any)[field] = enrichedValue;
        hasChanges = true;
      }
    }
  }

  return hasChanges ? changes : null;
}
