# Redis Cache Implementation for Public API

This document explains the Redis cache layer implementation for the API public endpoints.

## Overview

The Redis cache layer has been implemented to improve performance of public API endpoints by caching frequently accessed data like firms and certifications. This reduces database load and improves response times for end users.

## Architecture

### Components

1. **RedisService** (`src/services/redis/index.ts`)

   - Core Redis client wrapper using @upstash/redis
   - Provides get/set/delete operations with TTL support
   - Includes connection health checks and error handling

2. **CacheManager** (`src/services/cache/index.ts`)

   - High-level cache management utilities
   - Handles cache invalidation strategies
   - Provides warm-up and statistics functionality

3. **Cached Endpoints**
   - All public endpoints now use caching
   - Cache keys are generated based on endpoint and parameters
   - Automatic fallback to database on cache misses

## Cache Configuration

### TTL Settings

- **Firms List**: 1 hour (3600 seconds)
- **Individual Firm**: 30 minutes (1800 seconds)
- **Certifications List**: 1 hour (3600 seconds)
- **Individual Certification**: 30 minutes (1800 seconds)
- **Certifications by Firm**: 30 minutes (1800 seconds)

### Cache Key Patterns

- `firms:list:page_{page}:size_{pageSize}` - Paginated firms list
- `firm:id:{firmId}` - Individual firm data
- `certifications:list:page_{page}:size_{pageSize}` - Paginated certifications list
- `certification:id:{certId}` - Individual certification data
- `certifications:firm:page_{page}:size_{pageSize}_{"firmId":{firmId}}` - Certifications by firm

## Environment Setup

### Required Environment Variables

```bash
# Upstash Redis Configuration
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

These are already configured in your `.env` file.

## Cached Endpoints

### Public Firms Endpoints

1. **GET /api/public/firms**

   - Caches paginated firm lists with certification counts
   - Cache key includes page and pageSize parameters
   - TTL: 1 hour

2. **GET /api/public/firms/:firmId**

   - Caches individual firm data with certification counts
   - Cache key: `firm:id:{firmId}`
   - TTL: 30 minutes

3. **GET /api/public/firms/:firmId/certifications**
   - Caches paginated certifications for a specific firm
   - Cache key includes firmId, page, and pageSize
   - TTL: 30 minutes

### Public Certifications Endpoints

1. **GET /api/public/certifications**

   - Caches paginated certification lists with firm data
   - Cache key includes page and pageSize parameters
   - TTL: 1 hour

2. **GET /api/public/certifications/:certId**
   - Caches individual certification data with related certifications
   - Cache key: `certification:id:{certId}`
   - TTL: 30 minutes

## Cache Management Endpoints

### Health Check

```
GET /api/public/cache/health
```

Returns cache connection status and basic statistics.

### Clear All Cache

```
DELETE /api/public/cache
```

Clears all cached data. Use with caution in production.

### Clear Firms Cache

```
DELETE /api/public/cache/firms
DELETE /api/public/cache/firms/:firmId
```

Clears all firms cache or cache for a specific firm.

### Clear Certifications Cache

```
DELETE /api/public/cache/certifications
DELETE /api/public/cache/certifications/:certId
```

Clears all certifications cache or cache for a specific certification.

## Cache Invalidation Strategy

### Automatic Invalidation

The cache is designed to be invalidated when data changes. The `CacheManager` provides methods for:

- **Firm Changes**: Invalidates firm cache and related certification caches
- **Certification Changes**: Invalidates certification cache and related firm caches
- **Bulk Operations**: Full cache clearance for data integrity

### Manual Invalidation

Use the cache management endpoints above for manual cache clearing when needed.

## Performance Benefits

### Before Cache Implementation

- Every API request hits the database
- Response times: 200-500ms typical
- Database load increases with traffic

### After Cache Implementation

- Cache hits: 10-50ms response time
- Cache misses: Database query + cache storage
- Significantly reduced database load
- Better scalability for high traffic

## Monitoring and Troubleshooting

### Cache Health Monitoring

Use the health endpoint to monitor cache connectivity:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://your-api-url/api/public/cache/health
```

### Common Issues

1. **Cache Connection Issues**

   - Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
   - Verify network connectivity to Upstash
   - Check Upstash dashboard for service status

2. **Stale Data**

   - Use cache invalidation endpoints to refresh data
   - Consider reducing TTL for frequently changing data
   - Implement automatic invalidation on data updates

3. **Memory Usage**
   - Monitor cache size in Upstash dashboard
   - Implement cache eviction policies if needed
   - Consider shorter TTLs for less important data

## Development and Testing

### Local Development

The cache works automatically with your existing setup. Redis errors are handled gracefully, falling back to database queries.

### Testing Cache Behavior

1. Make an API request - should be slow (cache miss)
2. Make the same request again - should be fast (cache hit)
3. Clear cache using management endpoints
4. Verify cache miss on next request

### Debugging

Enable debug logging to see cache hit/miss information:

```typescript
// Cache hits and misses are logged by the RedisService
// Check your logs for messages like:
// "Cache HIT for key: firms:list:page_1:size_10"
// "Cache MISS for key: firms:list:page_1:size_10"
```

## Future Enhancements

1. **Cache Warming**: Pre-populate cache with frequently accessed data
2. **Analytics**: Track cache hit rates and performance metrics
3. **Smart Invalidation**: More granular cache invalidation based on data relationships
4. **Compression**: Compress large cached objects to save memory
5. **Distributed Locking**: Prevent cache stampede on high-traffic endpoints

## Example Usage

### Basic API Request (Cached)

```javascript
// First request (cache miss) - ~300ms
const response1 = await fetch("/api/public/firms?page=1&pageSize=10", {
  headers: { Authorization: "Bearer " + jwt },
});

// Second request (cache hit) - ~20ms
const response2 = await fetch("/api/public/firms?page=1&pageSize=10", {
  headers: { Authorization: "Bearer " + jwt },
});
```

### Manual Cache Management

```javascript
// Clear all cache
await fetch("/api/public/cache", {
  method: "DELETE",
  headers: { Authorization: "Bearer " + jwt },
});

// Clear specific firm cache
await fetch("/api/public/cache/firms/123", {
  method: "DELETE",
  headers: { Authorization: "Bearer " + jwt },
});
```

## Security Considerations

- All cache management endpoints require JWT authentication
- Cache keys do not contain sensitive user data
- Redis connection uses TLS encryption (Upstash default)
- Cache data should be considered public (matches public API endpoints)

## Deployment Notes

- No additional deployment steps required
- Environment variables must be set in production
- Upstash Redis automatically scales
- Monitor cache performance in production logs
