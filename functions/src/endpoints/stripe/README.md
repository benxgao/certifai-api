# Stripe Integration - Certifai API

This directory contains the complete Stripe subscription management implementation for the Certifai API, built for Stripe API version `2025-07-30.basil`.

## Files Overview

### Core Service Files

- **`service.ts`** - Main Stripe service class with all API operations
- **`db.ts`** - Firestore integration for storing Stripe data
- **`utils.ts`** - Utility functions for Firebase and validation
- **`errorHandler.ts`** - Comprehensive error handling for Stripe operations

### Endpoint Files

- **`createCheckout.ts`** - Create Stripe checkout sessions
- **`createPortal.ts`** - Create customer portal sessions
- **`subscriptions.ts`** - All subscription management endpoints
- **`snapshotWebhook.ts`** - Webhook handlers for Stripe events

### Configuration Files

- **`index.ts`** - Route definitions and middleware setup
- **`middlewares.ts`** - Custom middleware for Stripe operations

## API Endpoints

### Authentication Required Endpoints

#### Checkout & Portal

- `POST /stripe/create-checkout-session` - Create a checkout session
- `POST /stripe/create-portal-session` - Create a customer portal session

#### Subscription Management

- `GET /stripe/subscription/status` - Get current subscription status
- `GET /stripe/subscription/history` - Get subscription history
- `POST /stripe/subscription/cancel` - Cancel subscription
- `POST /stripe/subscription/resume` - Resume cancelled subscription
- `POST /stripe/subscription/reactivate` - Reactivate subscription in grace period
- `POST /stripe/subscription/update-plan` - Update subscription plan

### Public Endpoints

- `GET /stripe/pricing-plans` - Get all available pricing plans

### Webhooks

- `POST /stripe/webhook-snapshot` - Main webhook endpoint for Stripe events

## Environment Variables Required

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Webhook Events Handled

- `checkout.session.completed` - When checkout is completed
- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription updated
- `customer.subscription.deleted` - Subscription cancelled
- `customer.subscription.trial_will_end` - Trial ending soon
- `invoice.payment_succeeded` - Payment succeeded
- `invoice.payment_failed` - Payment failed
- `invoice.upcoming` - Upcoming invoice

## Key Features

### ✅ Latest Stripe API Support

- Built for Stripe API version `2025-07-30.basil`
- Modern TypeScript types and error handling
- Proper webhook signature verification

### ✅ Firebase Integration

- Custom claims updated with subscription status
- Firestore storage for subscription data
- Secure user authentication

### ✅ Comprehensive Error Handling

- Stripe-specific error types
- Proper HTTP status codes
- Detailed logging for debugging

### ✅ Subscription Lifecycle

- Create, cancel, resume, and update subscriptions
- Trial period support
- Grace period handling
- Subscription history tracking

### ✅ Security

- Firebase token verification
- Webhook signature verification
- Input validation and sanitization

## Usage Examples

### Create Checkout Session

```typescript
const response = await fetch('/api/stripe/create-checkout-session', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer <firebase-token>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    price_id: 'price_1234567890',
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
    trial_days: 14, // optional
  }),
});
```

### Get Subscription Status

```typescript
const response = await fetch('/api/stripe/subscription/status', {
  method: 'GET',
  headers: {
    Authorization: 'Bearer <firebase-token>',
  },
});
```

### Cancel Subscription

```typescript
const response = await fetch('/api/stripe/subscription/cancel', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer <firebase-token>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    cancel_at_period_end: true, // optional, defaults to true
  }),
});
```

## Development Notes

### Type Safety Considerations

- Some Stripe properties use `(subscription as any)` casting due to API version differences
- This is specifically for `current_period_start` and `current_period_end` properties
- All other types are properly typed with the latest Stripe TypeScript definitions

### Firebase Custom Claims

The integration automatically updates Firebase custom claims with:

- `stripe_customer_id` - Stripe customer ID
- `subscription_status` - Current subscription status
- `subscription_id` - Active subscription ID
- `has_subscription` - Boolean flag for active subscription

### Testing

Make sure to test with Stripe test mode before going live:

1. Use test API keys
2. Set up test webhooks
3. Use test card numbers for checkout testing

## Migration from Previous Versions

If upgrading from an older Stripe integration:

1. Update environment variables
2. Test webhook endpoints
3. Verify custom claims are being set correctly
4. Test subscription flows end-to-end
