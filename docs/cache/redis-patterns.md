# Redis Patterns

> **Source of truth**: `functions/src/services/redis/index.ts`, `functions/src/services/cache/index.ts`, `functions/src/services/optimizedRateLimit/index.ts`
> **Last reviewed**: 2026-05-26
> **Owner**: Backend Team

## Purpose

Define canonical Redis usage in `certifai-api`: key naming, TTL policy, multi-level cache behavior, and invalidation patterns.

## Key Concepts

- **L1 + L2 caching**: in-memory hot cache (`memoryCache`) + Redis cache.
- **Connection pool**: Redis connections are pooled and selected round-robin.
- **Namespace keys**: key prefixes are centralized in `CACHE_CONFIG.KEYS`.
- **Graceful degradation**: Redis errors are logged and should not crash request paths.

## Conventions / Rules

### 1) Use centralized Redis service

Use `RedisService` static methods for cache operations:

- `get`, `set`, `del`, `delPattern`, `getOrSet`
- sorted-set helpers: `zAdd`, `zRangeByScore`, `zRangeByScoreWithScores`, `zRemRangeByScore`, `expire`

Do not call Upstash client directly from endpoint handlers.

### 2) Use approved key prefixes

Use prefixes from `CACHE_CONFIG.KEYS`:

- Public: `firms:list`, `firm:id`, `certifications:list`, `certification:id`, `certifications:firm`
- User-scoped: `user:exams`, `user:exam:questions`, `user:exam:details`, `user:certifications`, `user:profile`, `user:rate_limit`

Generate keys with helper functions (`generatePaginatedCacheKey`, `generateItemCacheKey`, `generateUserCacheKey`).

### 3) Follow TTL tiers

Current TTL policy in `CACHE_CONFIG`:

- Public data: mostly long TTL (10h)
- User exam details: shorter TTL (2m–10m based on volatility)
- Profile: medium TTL (30m)
- Rate-limit data: short TTL (5m)

### 4) Invalidate by event, not ad hoc

Use `CacheManager` semantic methods:

- `invalidateUserExamCacheForGenerationChange`
- `invalidateUserExamCache`
- `invalidateUserCertificationCache`
- `invalidateUserProfileCache`
- `invalidateUserRateLimitCache`
- `invalidateFirmCache`, `invalidateCertificationCache`

### 5) Rate limiting uses Redis sorted sets

Optimized exam rate limiting uses per-user sorted sets:

- Key: `rate_limit:exam:<userId>`
- Score: timestamp (ms)
- Window cleanup: `zRemRangeByScore`
- Count in rolling window: `zRangeByScoreWithScores`

## Real Key Pattern Examples

- `user:exams:<userId>_{"page":1,"pageSize":20}`
- `user:exam:details:<userId>_<examId>`
- `certifications:list:page_1:size_20`
- `rate_limit:exam:<userId>`

## Dangerous Areas / Anti-patterns

- Writing custom key formats in handlers (breaks invalidation).
- Skipping invalidation after exam status transitions.
- Using broad `delPattern('*')` outside controlled admin operations.
- Treating Redis as source of truth for user-critical state.
- Failing open/closed incorrectly for rate limit checks.

## Verification Checklist

- Uses `RedisService`/`CacheManager`, not raw Upstash calls.
- Key prefix originates from `CACHE_CONFIG.KEYS`.
- TTL selected from `CACHE_CONFIG` constants.
- Cache invalidation invoked on write/update lifecycle transitions.

## Related Docs

- [Prisma Patterns](../database/prisma-patterns.md) – DB source-of-truth behind cache
- [Service Catalog](../services/service-catalog.md) – cache and redis service ownership
- [Testing Strategy](../testing/strategy.md) – mocking/stubbing cache behavior
- [Exam Generation Workflow](../workflow/exam-generation-workflow.md) – cache invalidation during status transitions
