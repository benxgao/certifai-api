# Knowledge Pooling API Endpoint Testing Guide

## Overview

The `/api/ai/knowledge-pooling` endpoint analyzes incorrect answers from a specific exam and generates targeted learning insights to help users improve their performance.

## Endpoint Details

- **URL**: `POST /api/ai/knowledge-pooling`
- **Authentication**: Required (Firebase JWT token)
- **Content-Type**: `application/json`

## Request Parameters

## Request Parameters

| Parameter          | Type    | Required | Description                                                    |
| ------------------ | ------- | -------- | -------------------------------------------------------------- |
| `exam_id`          | string  | Yes      | ID of the specific exam to analyze                             |
| `api_user_id`      | string  | Yes      | Internal API user identifier                                   |
| `force_regenerate` | boolean | No       | Force regeneration even if recent data exists (default: false) |

## Response Structure

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "knowledge_insights": [
      {
        "topic": "VPC and Networking",
        "insights": [
          {
            "insight": "Remember the difference between NAT Gateways and NAT Instances",
            "context": "NAT Gateways are managed services that provide automatic failover",
            "exam_id": "exam_123",
            "generated_at": "2025-08-18T22:00:00.000Z"
          }
        ]
      }
    ],
    "last_updated": "2025-08-18T22:00:00.000Z",
    "cert_id": 1,
    "certification_name": "AWS Solutions Architect"
  },
  "message": "Knowledge pooling generated successfully",
  "metadata": {
    "exam_id": "exam_123",
    "certification_name": "AWS Solutions Architect",
    "generated_at": "2025-08-18T22:00:00.000Z",
    "processing_time_ms": 1500
  }
}
```

### Error Responses

#### 400 - Bad Request

```json
{
  "success": false,
  "error": "api_user_id is required",
  "details": "Please provide a valid api_user_id parameter"
}
```

#### 401 - Unauthorized

```json
{
  "success": false,
  "error": "Authentication required",
  "details": "Please provide a valid Firebase authentication token"
}
```

#### 403 - Forbidden

```json
{
  "success": false,
  "error": "Forbidden",
  "details": "You can only access your own knowledge pooling data"
}
```

#### 404 - Not Found

```json
{
  "success": false,
  "error": "User not found",
  "details": "The provided api_user_id does not exist"
}
```

#### 500 - Internal Server Error

```json
{
  "success": false,
  "error": "Failed to generate knowledge pooling",
  "details": "Specific error message",
  "metadata": {
    "processing_time_ms": 500,
    "timestamp": "2025-08-18T22:00:00.000Z"
  }
}
```

## Testing Scenarios

### 1. Manual Testing with curl

#### Test 1: Missing exam_id

```bash
curl -X POST http://127.0.0.1:5001/certifai-uat/us-central1/endpoints/api/ai/knowledge-pooling \
  -H "Content-Type: application/json" \
  -d '{"api_user_id": "test-user-123"}'
```

Expected: 400 Bad Request

#### Test 2: Missing api_user_id

```bash
curl -X POST http://127.0.0.1:5001/certifai-uat/us-central1/endpoints/api/ai/knowledge-pooling \
  -H "Content-Type: application/json" \
  -d '{"exam_id": "test-exam-123"}'
```

Expected: 400 Bad Request

#### Test 3: Missing authentication

```bash
curl -X POST http://127.0.0.1:5001/certifai-uat/us-central1/endpoints/api/ai/knowledge-pooling \
  -H "Content-Type: application/json" \
  -d '{"exam_id": "test-exam-123", "api_user_id": "test-user-123"}'
```

Expected: 401 Unauthorized

#### Test 4: Valid request structure (will fail without real data)

```bash
curl -X POST http://127.0.0.1:5001/certifai-uat/us-central1/endpoints/api/ai/knowledge-pooling \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{"exam_id": "real-exam-id", "api_user_id": "real-api-user-id", "force_regenerate": true}'
```

### 2. Testing with Real Data

To test with actual data, you need:

1. **Valid Firebase Auth Token**: Generate from Firebase console or client app
2. **Existing Exam Data**: An exam that has been completed with some incorrect answers
3. **Valid API User ID**: A user who has taken the exam

#### Generate Firebase Token (for testing)

```javascript
// In a Node.js script or browser console with Firebase initialized
firebase
  .auth()
  .currentUser.getIdToken(true)
  .then((token) => {
    console.log('Firebase Token:', token);
  });
```

### 3. Integration Testing Workflow

1. **Setup Test Data**:

   - Create a test user
   - Create a test certification
   - Create a test exam with questions
   - Submit exam with some incorrect answers

2. **Test API Flow**:

   - Call endpoint with valid parameters
   - Verify response structure
   - Check Firestore data storage
   - Test caching behavior

3. **Test Edge Cases**:
   - Exam with no incorrect answers
   - Invalid exam ID
   - User without exam access
   - Network/timeout scenarios

## Performance Considerations

- **Processing Time**: Typically 1-3 seconds for standard exams
- **Rate Limiting**: Consider implementing rate limiting for production
- **Caching**: Built-in 7-day cache to avoid unnecessary regeneration
- **Token Validation**: Firebase token verification adds ~100-200ms

## Monitoring and Logging

The endpoint logs the following events:

- Request parameters and authentication status
- Validation failures with details
- Processing time and success metrics
- Error details for debugging

Monitor these logs to ensure proper functionality and identify issues.

## Known Issues and Limitations

1. **Service Interface Mismatch**: Fixed in refactored version - parameters now match between endpoint and AI service
2. **Error Response Structure**: Enhanced with more detailed error information
3. **Authentication Context**: Improved logging for auth-related issues
4. **Performance Tracking**: Added processing time tracking

## Recommended Improvements

1. **Add Request Validation Schema**: Use a validation library like Joi or Zod
2. **Implement Rate Limiting**: Prevent abuse and manage costs
3. **Add Response Compression**: For large knowledge pooling data
4. **Enhanced Error Types**: More specific error codes for different scenarios
5. **Metrics Collection**: Track usage patterns and performance metrics
