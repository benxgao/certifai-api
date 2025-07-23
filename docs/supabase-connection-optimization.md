# Supabase Connection Optimization Guide

## Overview

This guide explains how the connection optimization parameters are implemented for Supabase in the CertifAI API, replacing the commented-out connection settings with a Supabase-compatible approach.

## Implementation Details

### Original Commented Code

```typescript
// datasources: {
//   db: {
//     url:
//       process.env.DATABASE_URL +
//       '?connection_limit=20' + // Limit connections per instance
//       '&pool_timeout=20' + // Pool timeout in seconds
//       '&statement_timeout=30s' + // Statement timeout
//       '&idle_timeout=300s' + // Idle connection timeout
//       '&connect_timeout=10s', // Connection timeout
//   },
// },
```

### New Supabase-Optimized Implementation

```typescript
datasources: {
  db: {
    url: getOptimizedConnectionUrl(),
  },
},
```

## Key Optimizations for Supabase

### 1. **Connection Limit Adjustments**

- **Standard Supabase**: 10 connections per instance (reduced from 20)
- **Pooled Supabase**: 5 connections per instance
- **Reason**: Supabase has stricter connection limits, especially with pgBouncer

### 2. **Statement Timeout Format**

- **Original**: `statement_timeout=30s`
- **Supabase**: `statement_timeout=30000` (milliseconds)
- **Reason**: Supabase expects timeout values in milliseconds

### 3. **Automatic Pool Detection**

```typescript
const isSupabasePooled = baseUrl.includes("pooler.supabase.com");
if (isSupabasePooled) {
  supabaseParams["pgbouncer"] = "true";
  supabaseParams["connection_limit"] = "5";
}
```

### 4. **Connection Parameters**

| Parameter           | Value                | Purpose                                |
| ------------------- | -------------------- | -------------------------------------- |
| `connection_limit`  | 10 (or 5 for pooled) | Prevent connection exhaustion          |
| `pool_timeout`      | 20 seconds           | Time to wait for available connection  |
| `statement_timeout` | 30000ms              | Maximum query execution time           |
| `idle_timeout`      | 300 seconds          | Close idle connections after 5 minutes |
| `connect_timeout`   | 10 seconds           | Maximum time to establish connection   |
| `application_name`  | certifai-api         | For monitoring and debugging           |
| `pgbouncer`         | true (pooled only)   | Enable Supabase connection pooling     |

## Connection String Examples

### Before Optimization

```bash
DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
```

### After Optimization (Applied Automatically)

```bash
# Direct Connection
postgresql://postgres:password@db.xxx.supabase.co:5432/postgres?connection_limit=10&pool_timeout=20&statement_timeout=30000&idle_timeout=300&connect_timeout=10&application_name=certifai-api

# Pooled Connection
postgresql://postgres:password@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=20&statement_timeout=30000&idle_timeout=300&connect_timeout=10&application_name=certifai-api
```

## Environment Setup

### Required Environment Variables

```bash
# For production with pooling (recommended)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# For development without pooling
DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
```

## Benefits of This Implementation

### 1. **Automatic Detection**

- Detects if using Supabase pooled connection
- Applies appropriate parameters automatically
- No manual configuration needed

### 2. **Supabase Compatibility**

- Uses milliseconds for timeouts (Supabase requirement)
- Proper connection limits for Supabase plans
- Enables pgBouncer when using pooled connections

### 3. **Performance Improvements**

- Reduced connection overhead
- Better handling of concurrent requests
- Optimized for Firebase Functions environment

### 4. **Error Prevention**

- Prevents "too many connections" errors
- Handles connection timeouts gracefully
- Compatible with Supabase's connection limits

## Monitoring and Troubleshooting

### Check Connection Parameters

The optimized URL with parameters will be logged during Prisma client initialization. Look for logs showing the connection string with applied parameters.

### Supabase Dashboard Monitoring

1. Monitor connection usage in Supabase dashboard
2. Check for connection limit warnings
3. Review query performance metrics

### Common Issues and Solutions

#### Issue: "too many connections"

**Solution**: The optimization automatically reduces connection limits for Supabase

#### Issue: Query timeouts

**Solution**: Statement timeout is set to 30 seconds, adjust if needed

#### Issue: Pool exhaustion

**Solution**: Pooled connections use even lower limits (5 connections)

## Testing the Implementation

1. **Deploy the updated code**
2. **Check Prisma logs** for the optimized connection string
3. **Monitor Supabase dashboard** for connection usage
4. **Test high-concurrency scenarios** to verify optimization

## Production Recommendations

1. **Use pooled connections** (`pooler.supabase.com`) for production
2. **Monitor connection usage** regularly in Supabase dashboard
3. **Adjust parameters** based on your specific Supabase plan limits
4. **Test thoroughly** before deploying to production

This implementation ensures optimal performance while staying within Supabase's connection limits and requirements.
