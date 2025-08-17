# Remove has_subscription and subscription_status from Firebase Auth Claims - Refactoring Summary

## Overview

This refactoring removes the `has_subscription` and `subscription_status` fields from Firebase custom claims and ensures all subscription status checks rely on Firestore account data or live Stripe data instead. Additionally, `subscription_id` has been renamed to `stripe_subscription_id` for clarity.

## Changes Made

### Backend Changes

#### 1. Webhook Handlers

**File: `functions/src/endpoints/stripe/snapshotWebhooks/handlers/subscription.ts`**

- Removed `has_subscription: ['active', 'trialing'].includes(subscription.status)` from `handleSubscriptionUpdated`
- Removed `subscription_status: subscription.status` from `handleSubscriptionUpdated`
- Removed `has_subscription: false` and `subscription_status: 'canceled'` from `handleSubscriptionDeleted`
- Renamed `subscription_id` to `stripe_subscription_id` for clarity
- Claims now only include `stripe_subscription_id` (set to null when canceled)

**File: `functions/src/endpoints/stripe/snapshotWebhooks/handlers/checkoutSession.ts`**

- Removed `has_subscription: true` from checkout session completion handler
- Claims now only include `stripe_customer_id`

#### 2. Documentation Updates

**File: `functions/src/endpoints/stripe/README.md`**

- Removed `has_subscription` and `subscription_status` from the list of Firebase custom claims
- Added note explaining that subscription status should be derived from Firestore/Stripe data

### Frontend Changes

#### 1. Hooks and Context

**File: `src/stripe/client/hooks/useUnifiedAccountData.ts`**

- Added comment clarifying that subscription status is now derived from account data only, not claims
- No functional changes needed as the hook already uses account data

**File: `src/context/AccountContext.tsx`**

- Added comment clarifying that `hasSubscription` is derived from account data only, not Firebase claims
- No functional changes needed as the context already uses account data

## Benefits

1. **Single Source of Truth**: Subscription status is now consistently derived from Firestore account data, which is kept in sync with Stripe
2. **Reduced Complexity**: No need to maintain subscription status in multiple places (claims and Firestore)
3. **Better Data Consistency**: Account data in Firestore is the authoritative source for subscription information
4. **Improved Performance**: Frontend already uses SWR caching for account data, so no additional performance impact
5. **Simplified Claims**: Firebase custom claims now only contain essential identifiers, not derived state

## Migration Impact

### For Existing Code

- **Frontend components**: No changes needed - they already use account data from the unified account hook
- **Backend logic**: Any code that relied on `has_subscription` or `subscription_status` claims should use Firestore account data instead
- **Authentication flows**: Custom claims now only include `stripe_subscription_id` for basic reference

### For New Development

- Always use the unified account data hook (`useUnifiedAccountData` or `useAccountStatus`) for subscription checks
- Never rely on Firebase custom claims for subscription status - use account data instead
- For server-side checks, query Firestore account data or fetch live data from Stripe

## Testing Checklist

- [ ] Verify subscription webhooks still update Firestore correctly
- [ ] Confirm frontend subscription status displays work properly
- [ ] Test subscription creation flow
- [ ] Test subscription cancellation flow
- [ ] Verify billing portal access works
- [ ] Check that protected routes still work with subscription checks

## API Endpoints Still Available

- `GET /api/stripe/account` - Returns complete account data including subscription status
- All subscription status information is available through this endpoint

## Custom Claims Now Include

- `api_user_id` - Internal user identifier
- `stripe_subscription_id` - Active subscription ID (null when canceled)
- `stripe_customer_id` - Stripe customer identifier
- `init_cert_id` - Initial certification ID (if applicable)

**Note**: Custom claims now contain minimal subscription reference data. The authoritative subscription data should always be fetched from the account endpoints which provide complete, up-to-date information from Firestore/Stripe.
