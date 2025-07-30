# User Access Verification Middleware Implementation

## Overview

This document describes the implementation of the `verifyUserAccess` middleware that extracts and centralizes user ID and Firebase user ID verification logic across all API routes that require user-specific access control.

## Problem Statement

Previously, user authorization verification was duplicated across multiple API handlers:

- Each handler manually verified the Firebase user ID from the token
- Each handler performed database lookups to validate user ownership
- Redundant authorization logic across 15+ endpoints
- Inconsistent error handling and logging

## Solution

Created a reusable Express middleware `verifyUserAccess` that:

1. **Validates Authentication**: Ensures Firebase token is present and verified
2. **Validates Parameters**: Checks that `user_id` parameter exists
3. **Database Verification**: Looks up user by `user_id` and validates ownership
4. **Authorization Check**: Ensures Firebase user ID from token matches user's `firebase_user_id`
5. **Enhanced Request**: Adds verified user data to request object for downstream handlers

## Implementation Details

### Middleware Location

- **File**: `/functions/src/middlewares/verifyUserAccess.ts`
- **Usage**: Applied after `verifyFirebaseToken` middleware

### Key Features

- Consistent error messages and HTTP status codes
- Comprehensive logging for security monitoring
- Adds `verified_user` to request object
- Handles edge cases (missing parameters, invalid users, etc.)

### Routes Updated

All routes with `:user_id` parameter now use this middleware:

**User Profile & Management:**

- `GET /users/:user_id/profile`
- `GET /users/:user_id/rate-limit`
- `DELETE /users/:user_id`

**Certification Management:**

- `POST /users/:user_id/certifications`
- `GET /users/:user_id/certifications`
- `DELETE /users/:user_id/certifications/:cert_id`

**Exam Management:**

- `POST /users/:user_id/certifications/:cert_id/exams`
- `GET /users/:user_id/exams`
- `GET /users/:user_id/exams/:exam_id`
- `GET /users/:user_id/exams/:exam_id/questions`
- `GET /users/:user_id/exams/:exam_id/generating-progress`
- `PUT /users/:user_id/exams/:exam_id/questions/:quiz_question_id`
- `POST /users/:user_id/certifications/:cert_id/exams/:exam_id/submit`
- `DELETE /users/:user_id/exams/:exam_id`

**Exam Reports:**

- `GET /users/:user_id/exams/:exam_id/exam-report`
- `POST /users/:user_id/exams/:exam_id/exam-report`

## Before/After Comparison

### Before (Duplicated in each handler)

```typescript
// Each handler had this logic
const { user_id } = req.params;
const firebaseUserIdFromToken = req.firebase_user_info?.uid;

if (!firebaseUserIdFromToken) {
  res.status(401).json({ success: false, error: 'Authentication required' });
  return;
}

if (!user_id) {
  res.status(400).json({ success: false, error: 'User ID required' });
  return;
}

const user = await prisma.user.findUnique({
  where: { user_id: user_id },
  select: { user_id: true, firebase_user_id: true },
});

if (!user) {
  res.status(404).json({ success: false, error: 'User not found' });
  return;
}

if (user.firebase_user_id !== firebaseUserIdFromToken) {
  res.status(403).json({ success: false, error: 'Forbidden' });
  return;
}
```

### After (Simplified handlers)

```typescript
// Route definition
router.get(
  '/users/:user_id/profile',
  verifyFirebaseToken,
  verifyUserAccess, // ← New middleware
  getUserProfile,
);

// Handler code
const verifiedUser = req.verified_user; // ← From middleware
if (!verifiedUser) {
  res.status(500).json({
    success: false,
    error: 'User verification middleware not properly configured',
  });
  return;
}
// Continue with business logic...
```

## Security Improvements

1. **Consistent Authorization**: All user routes now have identical security patterns
2. **Enhanced Logging**: Centralized security logging with detailed context
3. **Defense in Depth**: Multiple validation layers (auth → params → database → ownership)
4. **Standardized Responses**: Consistent error messages and status codes
5. **Request Enhancement**: Verified user data available to all downstream handlers

## Error Handling

The middleware provides standardized error responses:

- **401 Unauthorized**: Missing or invalid Firebase token
- **400 Bad Request**: Missing `user_id` parameter
- **404 Not Found**: User not found in database
- **403 Forbidden**: User attempting to access another user's resources
- **500 Internal Server Error**: Database or middleware configuration issues

## Usage Example

```typescript
// Route with middleware
router.get(
  '/users/:user_id/exams/:exam_id/exam-report',
  verifyFirebaseToken, // Step 1: Verify Firebase JWT
  verifyUserAccess, // Step 2: Verify user ownership
  getExamReport, // Step 3: Execute business logic
);

// Handler function
export const getExamReport = async (req: CustomRequest, res: Response) => {
  try {
    const { user_id, exam_id } = req.params;
    const verifiedUser = req.verified_user; // Available from middleware

    // Skip manual user verification - already done by middleware
    // Continue with exam report logic...
  } catch (error) {
    // Handle business logic errors
  }
};
```

## Benefits

1. **Code Reduction**: Removed ~50 lines of duplicated code per handler
2. **Consistency**: All user routes now have identical security behavior
3. **Maintainability**: Security logic centralized in one location
4. **Performance**: Single database lookup per request (vs potential multiple lookups)
5. **Security**: Consistent authorization patterns reduce security vulnerabilities
6. **Testing**: Easier to test security logic in isolation

## Migration Notes

- All existing handlers updated to use middleware pattern
- Backward compatibility maintained - no API contract changes
- Enhanced error logging for better debugging
- No performance impact - same number of database operations

## Future Considerations

- Could extend middleware for role-based access control
- Could add caching for frequently accessed user data
- Could implement rate limiting per user
- Could add audit logging for sensitive operations

This middleware implementation significantly improves code quality, security consistency, and maintainability across the entire user-scoped API surface.
