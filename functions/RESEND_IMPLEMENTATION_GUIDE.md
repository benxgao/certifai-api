# Certifai Resend Email Service Implementation

## Overview

Complete email notification system for Stripe webhook events using Resend API, featuring professional HTML templates based on Certifai's design system.

## Files Created/Modified

### 1. Main Service (`/src/services/resend/index.ts`)

- **ResendService** class with singleton pattern for Resend client
- Methods for all Stripe-related email notifications:
  - `sendTrialEndingNotification()` - 3 days before trial ends
  - `sendSubscriptionCanceled()` - When subscription is canceled
  - `sendSubscriptionUpdated()` - When subscription plan changes
  - `sendPaymentFailed()` - When payment fails
  - `sendWelcomeEmail()` - After successful checkout
- Error handling and logging for all email operations
- Configurable via `RESEND_API_KEY` environment variable

### 2. Email Templates (`/src/services/resend/templates.ts`)

Professional HTML email templates following Certifai's design system:

- **Glass-morphism** design with backdrop blur effects
- **Gradient branding** (violet/blue) matching company colors
- **Responsive** layout for mobile and desktop
- **Dark mode** friendly color schemes
- **Action buttons** with hover effects and proper CTAs

Template Features:

- Clean, modern design with proper spacing
- Company branding with Certifai logo styling
- Clear information hierarchy
- Professional typography
- Accessible color contrasts
- Mobile-responsive layout

### 3. Updated Webhook Handlers

#### Subscription Handler (`subscription.ts`)

- ✅ **Trial ending notifications** - Implemented with upgrade CTA
- ✅ **Subscription canceled emails** - With reactivation options
- ✅ **Subscription updated emails** - Plan change confirmations

#### Payment Handler (`payment.ts`)

- ✅ **Payment failed notifications** - With billing update links
- 📧 **Payment succeeded confirmations** - Ready for implementation

#### Checkout Session Handler (`checkoutSession.ts`)

- ✅ **Welcome emails** - For new subscription activations
- 🎉 **Onboarding guidance** - Help users get started

## Email Templates Overview

### 1. Trial Ending Email

- **Trigger**: 3 days before trial expiration
- **Purpose**: Encourage subscription upgrade
- **CTA**: "Upgrade Now" button to pricing page
- **Information**: Trial end date, feature benefits

### 2. Subscription Canceled Email

- **Trigger**: When subscription is canceled
- **Purpose**: Confirm cancellation, offer reactivation
- **CTA**: "Reactivate Subscription" button
- **Information**: Access end date, data retention period

### 3. Subscription Updated Email

- **Trigger**: Plan changes (upgrade/downgrade)
- **Purpose**: Confirm changes, show new billing details
- **CTA**: "Manage Billing" button
- **Information**: New plan, price, next billing date

### 4. Payment Failed Email

- **Trigger**: When payment processing fails
- **Purpose**: Request payment method update
- **CTA**: "Update Payment Method" button
- **Information**: Failed amount, retry date, common failure reasons

### 5. Welcome Email

- **Trigger**: After successful subscription checkout
- **Purpose**: Welcome user, guide next steps
- **CTA**: "Start Learning" + "Get Support" buttons
- **Information**: Plan details, feature overview, pro tips

## Configuration

### Environment Variables

```bash
# Required
RESEND_API_KEY=re_your_api_key_here

# Optional (defaults to https://certifai.com)
FRONTEND_URL=https://app.certestic.com
```

### Resend Account Setup

1. Sign up at [resend.com](https://resend.com)
2. Verify your sending domain
3. Get API key from dashboard
4. Set environment variable in Firebase Functions

### Domain Configuration

- **From Address**: `Certistic <noreply@certestic.com>`
- **Reply-To**: Not set (emails are informational)
- **Domain**: Requires DNS verification in Resend dashboard

## Integration Points

### Firebase Integration

- Fetches user data via Firebase Auth
- Uses `displayName` for personalization
- Handles Firebase UID → email address mapping

### Stripe Integration

- Processes webhook events automatically
- Extracts subscription and payment data
- Uses Firestore for customer ID lookups

### Error Handling

- Comprehensive logging for debugging
- Graceful failure handling (continues processing even if email fails)
- Detailed error context in logs

## Deployment Checklist

- [ ] Set `RESEND_API_KEY` environment variable
- [ ] Verify domain in Resend dashboard
- [ ] Test email delivery in staging environment
- [ ] Configure DNS records for sending domain
- [ ] Update `FRONTEND_URL` for production links
- [ ] Monitor email delivery rates and bounces

## Usage Examples

### Manual Testing

```typescript
// Test trial ending email
await ResendService.sendTrialEndingNotification({
  email: 'user@example.com',
  userName: 'John Doe',
  subscriptionId: 'sub_123',
  trialEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
});

// Test payment failed email
await ResendService.sendPaymentFailed({
  email: 'user@example.com',
  userName: 'John Doe',
  subscriptionId: 'sub_123',
  amount: 2999,
  currency: 'usd',
});
```

### Webhook Integration

Email notifications are automatically triggered by Stripe webhook events:

- `customer.subscription.trial_will_end`
- `customer.subscription.deleted`
- `customer.subscription.updated`
- `invoice.payment_failed`
- `checkout.session.completed`

## Monitoring & Analytics

### Logging

All email operations are logged with context:

- Recipient email
- Email type
- Success/failure status
- Error details (if any)

### Resend Dashboard

- Delivery rates
- Open rates (if tracking enabled)
- Bounce/complaint rates
- Email content preview

## Future Enhancements

1. **Email Preferences** - User opt-out controls
2. **A/B Testing** - Template variations
3. **Analytics Integration** - Track email engagement
4. **Scheduled Emails** - Advanced timing controls
5. **Email Templates UI** - Admin interface for template management

## Security Considerations

- API keys stored securely in environment variables
- No sensitive user data exposed in email content
- Proper error handling prevents information leakage
- Rate limiting handled by Resend service
- Domain verification prevents spoofing
