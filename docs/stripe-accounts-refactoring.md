# Stripe Firestore Refactoring Guide

## Overview

The Stripe Firestore integration has been refactored to use a single `accounts` collection with a flat data structure instead of separate `stripe_customers`, `stripe_subscriptions`, and `stripe_invoices` collections.

## Changes Made

### New Data Structure

**Before**: Three separate collections

- `stripe_customers/{customer_id}`
- `stripe_subscriptions/{subscription_id}`
- `stripe_invoices/{invoice_id}`

**After**: Single unified collection

- `accounts/{api_user_id}`

### New AccountData Interface

```typescript
interface AccountData {
  // Primary key - API user ID
  api_user_id: string;

  // Reference data
  firebase_user_id: string;
  email: string;

  // Stripe customer data (prefixed)
  stripe_customer_id?: string;
  stripe_customer_created_at?: string;
  stripe_customer_updated_at?: string;

  // Stripe subscription data (prefixed)
  stripe_subscription_id?: string;
  stripe_subscription_status?: string;
  stripe_current_period_start?: number;
  stripe_current_period_end?: number;
  stripe_plan_id?: string;
  stripe_plan_name?: string;
  stripe_amount?: number;
  stripe_currency?: string;
  stripe_trial_end?: number;
  stripe_cancel_at_period_end?: boolean;
  stripe_canceled_at?: number;
  stripe_subscription_created_at?: string;
  stripe_subscription_updated_at?: string;

  // Stripe invoice data (prefixed) - store latest invoice info
  stripe_latest_invoice_id?: string;
  stripe_latest_invoice_status?: string;
  stripe_latest_invoice_amount?: number;
  stripe_latest_invoice_created_at?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}
```

## Benefits

### 1. Single Collection

- Reduced Firestore read operations
- Simpler querying for frontend applications
- Better performance with fewer round trips

### 2. Flat Data Structure

- Easy to fetch all user's Stripe data in one call
- No nested objects that complicate frontend consumption
- Clear field naming with `stripe_` prefix

### 3. API User ID as Primary Key

- Consistent with our internal user identification
- Easy to integrate with existing user management
- Better security and access control

## New Methods

### Primary Methods (Recommended)

```typescript
// Get complete account data
const account = await StripeFirestoreService.getCompleteAccountData(apiUserId);
const accountByFbUid =
  await StripeFirestoreService.getCompleteAccountDataByFirebaseUid(firebaseUid);

// Check subscription status
const hasActive = await StripeFirestoreService.hasActiveSubscription(apiUserId);
const status = await StripeFirestoreService.getSubscriptionStatus(apiUserId);

// Get account by different identifiers
const account = await StripeFirestoreService.getAccountByApiUserId(apiUserId);
const account = await StripeFirestoreService.getAccountByFirebaseUid(
  firebaseUid
);
```

### New API Endpoints

#### Unified Account Data Endpoints

```
GET /stripe/account
GET /stripe/account/:api_user_id
```

**Response format:**

```typescript
{
  success: true,
  data: {
    // Core account info
    api_user_id: string,
    firebase_user_id: string,
    email: string,

    // Stripe customer (prefixed)
    has_stripe_customer: boolean,
    stripe_customer_id?: string,

    // Stripe subscription (prefixed)
    has_subscription: boolean,
    stripe_subscription_status?: string,
    stripe_subscription_id?: string,
    stripe_plan_name?: string,
    stripe_amount?: number,
    stripe_currency?: string,
    stripe_current_period_start?: number,
    stripe_current_period_end?: number,
    stripe_trial_end?: number,
    stripe_cancel_at_period_end?: boolean,
    stripe_canceled_at?: number,

    // Invoice info (prefixed)
    stripe_latest_invoice_id?: string,
    stripe_latest_invoice_status?: string,
    stripe_latest_invoice_amount?: number,

    // Computed fields
    is_active_subscription: boolean,
    is_trial: boolean,
    is_canceled: boolean,

    // Timestamps
    created_at: string,
    updated_at: string
  }
}
```

### Legacy Methods (Backward Compatibility)

These methods are still available but deprecated:

```typescript
// @deprecated - Use getAccountByFirebaseUid instead
const customer = await StripeFirestoreService.getCustomerByFirebaseUid(
  firebaseUid
);

// @deprecated - Use getCompleteAccountDataByFirebaseUid instead
const subscription = await StripeFirestoreService.getSubscriptionByFirebaseUid(
  firebaseUid
);

// @deprecated - Use getCompleteAccountData instead
const subscription = await StripeFirestoreService.getActiveSubscription(
  customerId
);
```

## Frontend Integration

### Before (Multiple API Calls)

```typescript
// Had to make multiple calls to get complete data
const customer = await fetchStripeCustomer();
const subscription = await fetchStripeSubscription();
const invoices = await fetchStripeInvoices();
```

### After (Single API Call)

```typescript
// Get all Stripe data in one call
const { data } = useUnifiedAccountData();
const account = data?.data;

// All data is available in flat structure
const {
  stripe_customer_id,
  stripe_subscription_status,
  stripe_current_period_end,
  stripe_amount,
  stripe_currency,
  stripe_plan_name,
} = account;
```

### New Frontend Hooks

#### Primary Hook - Unified Account Data

```typescript
import {
  useUnifiedAccountData,
  useAccountStatus,
} from "@/src/stripe/client/hooks/useUnifiedAccountData";

// Get all account and Stripe data in one call
const { data, error, isLoading } = useUnifiedAccountData();
const account = data?.data;

// Or use the convenient status hook
const {
  account,
  hasActiveSubscription,
  isTrialing,
  isCanceled,
  planName,
  planAmount,
  currentPeriodEnd,
  refreshAccount,
} = useAccountStatus();
```

#### Backward Compatible Hook

```typescript
// Drop-in replacement for existing useSubscriptionState
const {
  subscription,
  hasActiveSubscription,
  isTrialing,
  isCanceled,
  isLoading,
  error,
  refreshSubscription,
} = useSubscriptionStateUnified();
```

### New Frontend Components

#### Unified Account Dashboard

```tsx
import { UnifiedAccountDashboard } from "@/src/stripe/client/components/UnifiedAccountComponents";

// Single component that displays all account and Stripe data
<UnifiedAccountDashboard />;
```

#### Migration Comparison

```tsx
import { MigrationComparison } from "@/src/stripe/client/components/UnifiedAccountComponents";

// Visual comparison of old vs new approach
<MigrationComparison />;
```

## Migration Strategy

### Phase 1: Backward Compatibility (Current)

- New unified structure implemented
- Legacy methods still work
- Both old and new collections can coexist

### Phase 2: Frontend Updates

- Update frontend to use new account endpoints
- Test with unified data structure
- Validate all Stripe workflows

### Phase 3: Legacy Cleanup

- Remove deprecated methods
- Clean up old collections
- Update documentation

## Example Usage

### Complete Account Data Retrieval

```typescript
export const getAccountWithStripeData = async (req: any, res: Response) => {
  try {
    const firebaseUid = req.firebase_user_info?.user_id;

    // Get complete account data including all Stripe info
    const account =
      await StripeFirestoreService.getCompleteAccountDataByFirebaseUid(
        firebaseUid
      );

    if (!account) {
      return res.status(404).json({
        success: false,
        error: "Account not found",
      });
    }

    // Frontend gets all data in flat structure
    res.status(200).json({
      success: true,
      data: {
        api_user_id: account.api_user_id,
        email: account.email,
        // Customer info
        has_stripe_customer: !!account.stripe_customer_id,
        stripe_customer_id: account.stripe_customer_id,
        // Subscription info
        has_subscription: !!account.stripe_subscription_id,
        subscription_status: account.stripe_subscription_status,
        plan_name: account.stripe_plan_name,
        amount: account.stripe_amount,
        currency: account.stripe_currency,
        current_period_end: account.stripe_current_period_end,
        is_trial: account.stripe_subscription_status === "trialing",
        trial_end: account.stripe_trial_end,
        // Invoice info
        latest_invoice_status: account.stripe_latest_invoice_status,
        // Metadata
        created_at: account.created_at,
        updated_at: account.updated_at,
      },
    });
  } catch (error) {
    logger.error("GET_ACCOUNT_STRIPE_DATA_ERROR", { error });
    res.status(500).json({
      success: false,
      error: "Failed to get account data",
    });
  }
};
```

### Subscription Status Check

```typescript
export const checkSubscriptionAccess = async (req: any, res: Response) => {
  try {
    const { api_user_id } = req.params;

    // Simple check for active subscription
    const hasActive = await StripeFirestoreService.hasActiveSubscription(
      api_user_id
    );

    res.status(200).json({
      success: true,
      data: {
        has_active_subscription: hasActive,
        access_granted: hasActive,
      },
    });
  } catch (error) {
    logger.error("CHECK_SUBSCRIPTION_ACCESS_ERROR", { error });
    res.status(500).json({
      success: false,
      error: "Failed to check subscription access",
    });
  }
};
```

## Security Considerations

### Access Control

- All data is keyed by `api_user_id`
- Firebase UID is stored for reference but not used as key
- Easier to implement row-level security

### Data Privacy

- Single collection reduces surface area for data access
- Clear data ownership per account
- Better compliance with data protection regulations

## Performance Benefits

### Reduced Firestore Operations

- Before: 3 separate reads for complete user data
- After: 1 read for complete user data
- Cost reduction: ~67% fewer read operations

### Frontend Efficiency

- No need to correlate data from multiple sources
- Faster page loads with single API call
- Reduced complexity in state management

## Testing

### Validation Points

1. All legacy methods still work correctly
2. New methods return expected data structure
3. Subscription workflows function properly
4. Invoice storage updates accounts correctly
5. Error handling preserves backward compatibility

### Test Cases

```typescript
// Test backward compatibility
const legacyCustomer = await StripeFirestoreService.getCustomerByFirebaseUid(
  firebaseUid
);
const newAccount = await StripeFirestoreService.getAccountByFirebaseUid(
  firebaseUid
);
assert(legacyCustomer.customer_id === newAccount.stripe_customer_id);

// Test unified data access
const account = await StripeFirestoreService.getCompleteAccountData(apiUserId);
assert(account.api_user_id === apiUserId);
assert(account.stripe_customer_id);
assert(account.stripe_subscription_status);
```

## Files Created/Modified

### Backend Files

#### New Files

- `functions/src/endpoints/stripe/accounts.ts` - New unified account endpoints
- `docs/stripe-accounts-refactoring.md` - This documentation

#### Modified Files

- `functions/src/endpoints/stripe/db.ts` - Refactored with unified AccountData interface
- `functions/src/endpoints/stripe/index.ts` - Added new account endpoints

### Frontend Files (Examples)

#### New Files

- `src/stripe/client/hooks/useUnifiedAccountData.ts` - New hooks for unified data
- `src/stripe/client/components/UnifiedAccountComponents.tsx` - Example components

#### Key Changes

- Single API call replaces multiple calls
- Flat data structure with `stripe_` prefixes
- Backward compatible hooks available
- Improved performance and developer experience

## Summary

The refactoring successfully achieves:

✅ **Single Collection**: All Stripe data in `accounts` collection  
✅ **Flat Structure**: No nested objects, easy frontend consumption  
✅ **API User ID Key**: Consistent with internal user management  
✅ **Stripe Prefixes**: Clear data ownership and naming  
✅ **Backward Compatibility**: Existing code continues to work  
✅ **Performance**: ~67% reduction in Firestore read operations  
✅ **Developer Experience**: Simplified integration and debugging

The system now provides a clean, efficient way to manage all Stripe-related data while maintaining compatibility with existing implementations.
