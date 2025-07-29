# CORS Configuration Documentation

## Overview

The API has been configured with CORS restrictions to only allow requests from specific trusted domains.

## Allowed Origins

The following origins are permitted to access the API:

### Development

- `http://localhost:3000` - Local development frontend
- `https://localhost:3000` - Local development frontend with HTTPS

### Production

- `https://www.certestic.com` - Production website with www subdomain
- `https://certestic.com` - Production website without www subdomain
- `http://www.certestic.com` - Fallback for HTTP (not recommended for production)
- `http://certestic.com` - Fallback for HTTP (not recommended for production)

## Configuration Details

### CORS Settings

- **Credentials**: Enabled (`credentials: true`) - Allows cookies and authorization headers
- **Methods**: `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`
- **Allowed Headers**: `Content-Type`, `Authorization`, `X-Requested-With`

### Development Mode Behavior

- Requests with no origin (e.g., mobile apps, curl requests) are allowed only when `NODE_ENV=development`
- All origin checks are logged for debugging purposes

### Security Features

- Origin validation with detailed logging
- Automatic rejection of unauthorized origins
- Error messages that specify the blocked origin for debugging

## Implementation Location

The CORS configuration is implemented in `/Users/xingbingao/workplace/certifai-api/functions/src/endpoints/index.ts`

## Testing CORS Configuration

### Expected Behavior

1. ✅ Requests from `localhost:3000` should be allowed
2. ✅ Requests from `www.certestic.com` should be allowed
3. ✅ Requests from `certestic.com` should be allowed
4. ❌ Requests from any other domain should be blocked with CORS error

### Testing Commands

```bash
# Should succeed (allowed origin)
curl -H "Origin: https://www.certestic.com" -X GET https://your-api-endpoint.com/api/healthcheck

# Should fail (blocked origin)
curl -H "Origin: https://malicious-site.com" -X GET https://your-api-endpoint.com/api/healthcheck
```

## Logging

The system logs all CORS decisions:

- **Allowed requests**: `CORS: Allowing request from origin: [origin]`
- **Blocked requests**: `CORS: Blocking request from unauthorized origin: [origin]`
- **Development mode**: `CORS: Allowing request with no origin in development mode`

## Troubleshooting

### Common Issues

1. **Frontend can't connect**: Verify the frontend is running on an allowed origin
2. **CORS errors in browser**: Check the browser console for specific blocked origins
3. **Mobile app issues**: Ensure `NODE_ENV=development` for development testing

### Updating Allowed Origins

To add new allowed origins, update the `allowedOrigins` array in `/functions/src/endpoints/index.ts`:

```typescript
const allowedOrigins = [
  // Add new origins here
  "https://new-domain.com",
  // ... existing origins
];
```

## Security Considerations

- Always use HTTPS in production
- Keep the allowed origins list minimal
- Monitor logs for blocked requests that might indicate legitimate usage
- Consider adding rate limiting for additional security
