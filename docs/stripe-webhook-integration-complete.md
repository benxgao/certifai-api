# Stripe Webhook Integration with Unified Account Storage

## Overview

This document summarizes the integration of all Stripe webhook events with the unified account storage system. All webhook handlers now store data in the single `accounts` collection with flat, stripe-prefixed fields.

## Updated Webhook Handlers

### 1. Subscription Handlers (`subscription.ts`)

**Updated Functions:**

- `handleSubscriptionUpdated` - Stores subscription data with stripe\_ prefix
- `handleSubscriptionDeleted` - Marks subscription as canceled and stores deletion timestamp

**Key Features:**

- Robust error handling with detailed logging
- Maintains Firebase custom claims integration
- Stores subscription status, billing period, pricing info
- Handles subscription cancellation gracefully

### 2. Checkout Session Handler (`checkoutSession.ts`)

**Updated Functions:**

- `handleCheckoutSessionCompleted` - Processes successful checkouts and subscription creation

**Key Features:**

- Creates or updates account with customer and subscription data
- Handles both one-time payments and subscription setup
- Integrates with Firebase Auth custom claims
- Comprehensive error handling and logging

### 3. Payment Handlers (`payment.ts`)

**Updated Functions:**

- `handlePaymentSucceeded` - Records successful invoice payments
- `handlePaymentFailed` - Records failed payment attempts
- `handleUpcomingInvoice` - Records upcoming invoice information

**Key Features:**

- Stores latest invoice information in unified account
- Enhanced error handling for payment failures
- Proper logging for payment tracking and debugging

### 4. Customer Handlers (`customer.ts`) - NEW

**New Functions:**

- `handleCustomerCreated` - Logs customer creation and updates existing accounts
- `handleCustomerUpdated` - Syncs customer data changes with account records
- `handleCustomerDeleted` - Marks customer as deleted in account data

**Key Features:**

- Handles customer lifecycle events
- Updates account data when customer information changes
- Graceful handling of customer deletion
- Comprehensive error handling and logging

## Database Schema Updates

### AccountData Interface Extensions

```typescript
// Added customer deletion tracking fields
stripe_customer_deleted?: boolean;
stripe_customer_deleted_at?: string;
```

### New Methods Added to StripeFirestoreService

```typescript
// Get account by Stripe customer ID
static async getAccountByCustomerId(customerId: string): Promise<AccountData | null>

// Update account data (partial updates)
static async updateAccount(apiUserId: string, updateData: Partial<AccountData>): Promise<void>
```

## Webhook Event Integration

### Main Webhook Router (`index.ts`)

**Added Customer Event Handling:**

```typescript
case 'customer.created':
  await handleCustomerCreated(event.data.object as Stripe.Customer);
  break;
case 'customer.updated':
  await handleCustomerUpdated(event.data.object as Stripe.Customer);
  break;
case 'customer.deleted':
  await handleCustomerDeleted(event.data.object as Stripe.Customer);
  break;
```

### Supported Webhook Events

✅ **Fully Integrated:**

- `customer.created`
- `customer.updated`
- `customer.deleted`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `invoice.upcoming`
- `customer.subscription.trial_will_end`

## Error Handling Strategy

### Comprehensive Logging

- All webhook handlers include detailed error logging
- Structured logging with relevant context (customer_id, api_user_id, etc.)
- Action-specific error tracking for debugging

### Resilience Features

- Try-catch blocks around all Firestore operations
- Graceful degradation when accounts don't exist
- Detailed error messages for troubleshooting

### Example Error Handling Pattern:

```typescript
try {
  await StripeFirestoreService.storeSubscription(subscriptionData);
  logger.info('STRIPE_SUBSCRIPTION_STORED', { ... });
} catch (error) {
  logger.error('STRIPE_WEBHOOK_SUBSCRIPTION_STORE_ERROR', {
    error,
    subscription_id: subscription.id,
    customer_id: subscription.customer,
    action: 'store_subscription_updated',
  });
}
```

## Benefits of Integration

### 1. **Unified Data Model**

- All Stripe data stored in single `accounts` collection
- Consistent flat structure with stripe\_ prefixed fields
- Simplified frontend data access

### 2. **Real-time Synchronization**

- Webhook events automatically update account data
- Customer, subscription, and payment data always in sync
- Immediate reflection of Stripe changes in application

### 3. **Enhanced Reliability**

- Comprehensive error handling prevents webhook failures
- Detailed logging for troubleshooting
- Graceful handling of edge cases

### 4. **Improved Performance**

- Single collection queries instead of multiple joins
- Flat data structure reduces query complexity
- Efficient data access patterns

## Next Steps

### Optional Enhancements:

1. **Webhook Event Replay** - Add mechanism to replay failed webhook events
2. **Data Validation** - Add schema validation for incoming webhook data
3. **Monitoring** - Add metrics tracking for webhook processing success rates
4. **Testing** - Add comprehensive webhook integration tests

### Migration Considerations:

- All existing data remains accessible through legacy methods
- Gradual migration path available for frontend components
- Backward compatibility maintained throughout transition

## Files Modified

### Core Database Layer:

- `functions/src/endpoints/stripe/db.ts` - Added getAccountByCustomerId, updateAccount methods, customer deletion fields

### Webhook Handlers:

- `functions/src/endpoints/stripe/snapshotWebhooks/handlers/subscription.ts` - Enhanced with unified storage
- `functions/src/endpoints/stripe/snapshotWebhooks/handlers/checkoutSession.ts` - Enhanced with unified storage
- `functions/src/endpoints/stripe/snapshotWebhooks/handlers/payment.ts` - Enhanced with unified storage
- `functions/src/endpoints/stripe/snapshotWebhooks/handlers/customer.ts` - NEW - Customer lifecycle handling

### Main Router:

- `functions/src/endpoints/stripe/snapshotWebhooks/index.ts` - Added customer event routing

This completes the integration of all Stripe webhook events with the unified account storage system, ensuring all Stripe data changes are automatically synchronized with the application's account records.
