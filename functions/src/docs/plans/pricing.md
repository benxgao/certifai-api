# Product plan

## basic features

- [ ] get payment options ready in dev
- [ ] a feature flag between email_subscriber and payment options
- [ ] duplicate environments
- [ ] complete marketing endpoints, group users

## approach 1

- Users get 1 free cert with 3 exams for 6 months

- Users buy per-cert to extend the free cert or a new cert, to

  - take unlimited exams
  - extend for 6 months

- Users can have max 1 active cert by default

  - get allowed certs from user_tx
    - 11 user_tx
    - 1 associated with cert with expired_at at future and marked as active
    - 1 null as inactive (1 contains {inactive: 1, active: 1, expired: 0})
    - 10 with expired_at past (each contains {inactive: 0,active: 0, expired: 10})
  - when users login (check + update user_tx)
    - update if any expired certs -> user_tx (1 contains {inactive: 1, active: 1 - 1, expired: 0 + 1})
  - when user register a cert (check + update user_tx)

    - allow if (inactive) user_tx > (active) user_certs and update user_tx (1 contains {inactive: 1 - 1, active: 1 + 1, expired: 0})
    - decline if (inactive) user_tx = 0
    - allow if user buy more, and update user_tx (1 contains {inactive: 0 + 1, active: 0, expired: 0})

  - when user enter a cert (check + update user_tx)

    - allow if cert is not expired
    - decline if cert is expired
      - update user_tx (1 contains {inactive: 0, active: 1 - 1, expired: 0 + 1})
      - update user_cert (expired_at)
    - allow if user buy more
      - update user_tx (1 contains {inactive: 0 + 1, active: 0, expired: 0})
      - register again
        - update user_tx (1 contains {inactive: 1 - 1, active: 0 + 1, expired: 0})
        - update user_cert (actived_at, expired_at)

- Pricing plans
  - buy 1 active cert at $6.99 expired in 6 months
  - buy 2 active cert at $8.99 expired in 6 months

## approach 2

- [ ] deduct credit tokens on exam creation
- [ ] enable email subscriber when token is used out
- [ ] create event_history table to record token usage
- [ ] create pubsub for handling token event
- [ ] show event history in time series in profile page

### Token Policies

**Token Expiration:**

- Purchased tokens expire 12 months from purchase date
- Free/promotional tokens expire 6 months from grant date
- Users receive email notifications 30, 7, and 1 day before expiration

**Refund Policy:**

- No refunds for successfully completed exams
- Automatic refund if exam fails to load within 5 minutes
- Manual refund for technical issues (admin approval required)
- Refund window: 24 hours from token deduction
- Maximum 3 refunds per user per month

**Token Deduction Rules:**

- Tokens deducted only when exam session starts (not on creation)
- Failed exam attempts (< 10% completion) receive automatic refund
- Abandoned exams (> 30 minutes inactive) forfeit tokens
- System failures during exam result in automatic refund

**Abuse Prevention:**

- Maximum 10 exam attempts per day per user
- IP-based rate limiting for token purchases
- Account suspension for suspicious token usage patterns
- No token transfers between accounts

**Token Packages:**

- 5 tokens: $4.99 (expires 6 months)
- 15 tokens: $12.99 (expires 12 months)
- 30 tokens: $19.99 (expires 12 months)
- Enterprise bulk pricing available

**Business Continuity:**

- Token balance persists through account migrations
- Partial service outages don't consume tokens
- Scheduled maintenance notifications prevent token waste

### Token Period Tracking

**Separate token balance from usage periods:**

- `user_tokens`: total available tokens (fungible)
- `token_purchases`: track purchase date and expiration per batch
- `token_usage_periods`: track usage within time windows

**FIFO Token Expiration:**

- Consume oldest tokens first (by purchase_date)
- Track remaining tokens per purchase batch
- Auto-expire unused tokens from oldest batches

**Usage Period Limits:**

- Daily limit: 10 exams per day (reset at midnight UTC)
- Monthly limit: 100 exams per month (reset on calendar month)
- Rate limiting: 1 exam per 5 minutes

**Database Schema:**

```sql
-- Track token purchases with expiration
token_batches: {user_id, tokens_purchased, tokens_remaining, purchased_at, expires_at}

-- Track usage within periods
token_usage_periods: {user_id, period_type, period_start, tokens_used, exam_count}

-- Event history for all token operations
event_history: {user_id, event_type, tokens_delta, batch_id, created_at, metadata}
```

**Implementation:**

- Check period limits before token deduction
- Deduct from oldest non-expired batch first
- Log usage to current period counters
- Reset period counters automatically
