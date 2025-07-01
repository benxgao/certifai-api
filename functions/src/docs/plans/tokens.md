# Tokens

## Database design

```sql
-- Track token purchases/grants with expiration batches
CREATE TABLE token_batches (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    tokens_purchased INTEGER NOT NULL,
    tokens_remaining INTEGER NOT NULL,
    purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    batch_type VARCHAR(20) NOT NULL DEFAULT 'purchased', -- 'purchased', 'promotional', 'free'
    payment_id VARCHAR(255), -- stripe payment intent id
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_tokens CHECK (tokens_remaining >= 0 AND tokens_remaining <= tokens_purchased),
    INDEX idx_user_expires (user_id, expires_at),
    INDEX idx_expires_remaining (expires_at, tokens_remaining)
);

-- Track usage within time periods for rate limiting
CREATE TABLE token_usage_periods (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    period_type VARCHAR(10) NOT NULL, -- 'daily', 'monthly'
    period_start DATE NOT NULL, -- '2025-07-02' for daily, '2025-07-01' for monthly
    tokens_used INTEGER NOT NULL DEFAULT 0,
    exam_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    UNIQUE KEY unique_user_period (user_id, period_type, period_start),
    INDEX idx_user_period (user_id, period_type, period_start)
);

-- Event history for all token operations (audit trail)
CREATE TABLE token_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    event_type VARCHAR(20) NOT NULL, -- 'purchase', 'deduct', 'refund', 'expire'
    tokens_delta INTEGER NOT NULL, -- positive for add, negative for deduct
    batch_id BIGINT REFERENCES token_batches(id),
    exam_id BIGINT REFERENCES exams(id),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    INDEX idx_user_created (user_id, created_at),
    INDEX idx_batch_id (batch_id),
    INDEX idx_event_type (event_type)
);

-- View for current token balance per user
CREATE VIEW user_token_balance AS
SELECT
    user_id,
    SUM(tokens_remaining) as total_tokens,
    MIN(expires_at) as next_expiry
FROM token_batches
WHERE expires_at > NOW() AND tokens_remaining > 0
GROUP BY user_id;
```

## Events

Here are the key scenarios that would trigger token events in the services:

Token Purchase Events
Payment Service:

token_purchase - User completes payment for token package
token_grant - Free/promotional tokens awarded to user
payment_failed - Payment fails, reverse any provisional token grant
Exam-Related Events
Exam Service:

token_deduct - Exam session starts, deduct token from oldest batch
token_refund - Exam fails to load within 5 minutes (automatic)
token_refund - User abandons exam with <10% completion (automatic)
token_forfeit - User abandons exam after 30+ minutes inactive
System Events:

token_refund - System failure during exam (automatic)
token_refund - Manual refund for technical issues (admin approval)
Batch Management Events
Token Service:

token_expire - Batch expires, zero out remaining tokens
token_cleanup - Remove expired batches with zero tokens
Period Tracking Events
Usage Service:

period_reset - Daily/monthly counters reset automatically
rate_limit_hit - User hits daily/monthly limit (log but don't deduct)
Administrative Events
Admin Service:

token_adjustment - Manual token adjustment by admin
account_migration - Transfer tokens during account merge
bulk_grant - Enterprise bulk token distribution
Each event would:

Update token_batches (for balance changes)
Log to token_events (for audit trail)
Update token_usage_periods (for rate limiting)
Trigger pub/sub notifications for downstream services
