# NODE_ENV Production Configuration

## Overview

This document outlines the changes made to ensure that `NODE_ENV` is properly set to `production` during build and deployment processes in GitHub Actions and Firebase App Hosting.

## Changes Made

### 1. GitHub Actions Workflow (certifai-api)

**File**: `/Users/xingbingao/workplace/certifai-api/.github/workflows/firebase-hosting-merge.yml`

#### Added NODE_ENV to Multiple Steps:

1. **Install Dependencies Step**:

   ```yaml
   - name: Install npm Dependencies
     run: npm ci
     working-directory: functions
     env:
       NODE_ENV: production
   ```

2. **Build Step**:

   ```yaml
   - name: Build Functions
     run: npm run build
     working-directory: functions
     env:
       NODE_ENV: production
   ```

3. **Environment File Creation**:

   ```yaml
   - name: Create file - .env
     run: |
       echo "NODE_ENV=production" >> .env
       # ... other environment variables
   ```

4. **Deploy Step**:
   ```yaml
   - name: Deploy Firebase Functions
     run: |
       npm run deploy
     working-directory: functions
     env:
       NODE_ENV: production
   ```

### 2. Firebase App Hosting Configuration (certifai-app)

**File**: `/Users/xingbingao/workplace/certifai-app/apphosting.yaml`

#### Uncommented NODE_ENV Setting:

```yaml
env:
  - variable: NODE_ENV
    value: production
```

## Benefits

### Security Benefits

- **CORS Restrictions**: With `NODE_ENV=production`, the CORS configuration will properly block requests with no origin, enhancing security
- **Development-only Features**: Prevents development-specific logging and debugging features from being enabled in production

### Performance Benefits

- **Optimized Dependencies**: Node.js and many packages optimize for production when `NODE_ENV=production`
- **Reduced Bundle Size**: Development dependencies and debug code are excluded
- **Better Caching**: Production mode enables better caching strategies

### Debugging Benefits

- **Proper Logging**: CORS logging will correctly identify production vs development environments
- **Error Handling**: Error messages will be production-appropriate (not exposing sensitive development information)

## Impact on CORS Configuration

With `NODE_ENV=production` set, the CORS configuration in `/functions/src/endpoints/index.ts` will:

```typescript
// This condition will now properly evaluate to false in production
if (!origin && process.env.NODE_ENV === "development") {
  // This block will NOT execute in production deployments
  logger.info("CORS: Allowing request with no origin in development mode");
  return callback(null, true);
}
```

This means:

- ✅ **Production**: Requests without origin will be properly blocked
- ✅ **Development**: Local development (localhost) will still work
- ✅ **Security**: Only allowed domains can access the production API

## Testing

### Verify NODE_ENV in Production

To verify that NODE_ENV is properly set in production:

1. **Check Logs**: Look for CORS-related logs that should show production behavior
2. **Test Requests**: Try requests from unauthorized origins - they should be blocked
3. **Monitor Deployment**: GitHub Actions should show NODE_ENV in build/deploy steps

### Local Development

Ensure local development still works:

```bash
# Local development should still work
cd functions
NODE_ENV=development npm run serve
```

## Environment Variables Summary

| Environment              | Location                | NODE_ENV Value | CORS Behavior                  |
| ------------------------ | ----------------------- | -------------- | ------------------------------ |
| **Local Development**    | `.env.local` or not set | `development`  | Allows requests with no origin |
| **GitHub Actions Build** | Workflow environment    | `production`   | Blocks requests with no origin |
| **Firebase Functions**   | Deployed `.env` file    | `production`   | Blocks requests with no origin |
| **Firebase App Hosting** | `apphosting.yaml`       | `production`   | Production optimizations       |

## Troubleshooting

### Common Issues

1. **Local Development Broken**: Ensure NODE_ENV is not set to production locally
2. **CORS Issues**: Check that allowed origins list includes your frontend domain
3. **Build Failures**: Verify all environment variables are properly set in GitHub secrets

### Checking NODE_ENV

```javascript
// Add this to your code temporarily to verify NODE_ENV
console.log("Current NODE_ENV:", process.env.NODE_ENV);
```

## Related Files

- `/Users/xingbingao/workplace/certifai-api/.github/workflows/firebase-hosting-merge.yml`
- `/Users/xingbingao/workplace/certifai-app/apphosting.yaml`
- `/Users/xingbingao/workplace/certifai-api/functions/src/endpoints/index.ts`
- `/Users/xingbingao/workplace/certifai-api/docs/cors-configuration.md`
