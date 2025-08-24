# Generate Knowledge Pooling API

## Overview

The Generate Knowledge Pooling API provides frontend consumers with the ability to generate knowledge pooling insights for a specific exam. This endpoint works exactly like the `/api/ai/knowledge-pooling` endpoint but provides a user-friendly REST API interface that matches other user endpoints.

## Endpoint

### POST `/api/users/:user_id/certifications/:cert_id/knowledge-pooling`

Generates knowledge pooling insights for a specific exam by analyzing incorrect answers.

#### Parameters

- `user_id` (string, required): The API user ID (internal UUID)
- `cert_id` (number, required): The certification ID

#### Authentication

Requires Firebase authentication token in the Authorization header:

```
Authorization: Bearer <firebase_token>
```

#### Request Body

```json
{
  "exam_id": "exam_456",
  "forceGenerate": false
}
```

| Field           | Type    | Required | Description                                                    |
| --------------- | ------- | -------- | -------------------------------------------------------------- |
| `exam_id`       | string  | Yes      | ID of the exam to analyze for knowledge pooling                |
| `forceGenerate` | boolean | No       | Force regeneration even if recent data exists (default: false) |

#### Response

**Success Response (200)**

```json
{
  "success": true,
  "data": {
    "cert_id": 1,
    "user_id": "user_123",
    "knowledge_insights": [
      {
        "insight_id": "insight_abc123",
        "insight": "VPC subnets in different Availability Zones provide high availability and fault tolerance for your applications.",
        "topic": "VPC Networking",
        "exam_id": "exam_456",
        "generated_at": "2025-08-24T10:30:00.000Z"
      },
      {
        "insight_id": "insight_def456",
        "insight": "IAM policies should follow the principle of least privilege to minimize security risks.",
        "topic": "Security and Identity",
        "exam_id": "exam_789",
        "generated_at": "2025-08-24T11:15:00.000Z"
      }
    ],
    "certification_name": "AWS Solutions Architect Associate",
    "last_updated": "2025-08-24T11:15:00.000Z",
    "stats": {
      "total_insights": 2,
      "unique_exams": 2,
      "unique_topics": 2
    }
  },
  "message": "Knowledge pooling generated successfully",
  "generated": true,
  "metadata": {
    "exam_id_used": "exam_456",
    "force_regenerate": false,
    "processing_time_ms": 1500,
    "analysis_needed": true,
    "timestamp": "2025-08-24T11:15:00.000Z"
  }
}
```

**Error Responses**

**400 Bad Request**

```json
{
  "success": false,
  "error": "user_id and cert_id are required"
}
```

```json
{
  "success": false,
  "error": "exam_id is required and must be a string",
  "details": "Please provide a valid exam_id in the request body"
}
```

```json
{
  "success": false,
  "error": "cert_id must be a valid number"
}
```

**401 Unauthorized**

```json
{
  "success": false,
  "error": "Authentication required"
}
```

**404 Not Found**

```json
{
  "success": false,
  "error": "Exam not found or not accessible for this user"
}
```

**500 Internal Server Error**

```json
{
  "success": false,
  "error": "Failed to generate knowledge pooling",
  "details": "Specific error message",
  "metadata": {
    "processing_time_ms": 1200,
    "timestamp": "2025-08-24T11:15:00.000Z"
  }
}
```

## How It Works

### Service Integration

This endpoint works exactly like `/api/ai/knowledge-pooling` by:

1. **Direct Parameter Mapping**: Uses the provided `exam_id` and `forceGenerate` parameters
2. **Same Service Layer**: Calls the same `KnowledgePoolingService.generateKnowledgePooling()` method
3. **Identical Logic**: Follows the exact same business logic and validation
4. **Consolidated Response**: Returns consolidated knowledge pooling data for the certification

### Key Features

- **Exact API Compatibility**: Same functionality as the internal API endpoint
- **Request Body Input**: Accepts `exam_id` and `forceGenerate` in request body
- **Force Regeneration**: Optionally forces regeneration even if recent data exists
- **Consistent Response Format**: Returns data matching the GET knowledge pooling endpoint
- **Comprehensive Error Handling**: Provides detailed error messages for various scenarios
- **Performance Monitoring**: Includes processing time and metadata in responses

## Usage Examples

### Using cURL

#### Generate Knowledge Pooling (Normal)

```bash
curl -X POST \
  'https://your-api-domain.com/api/users/user_123/certifications/1/knowledge-pooling' \
  -H 'Authorization: Bearer <firebase_token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "exam_id": "exam_456",
    "forceGenerate": false
  }'
```

#### Force Regenerate Knowledge Pooling

```bash
curl -X POST \
  'https://your-api-domain.com/api/users/user_123/certifications/1/knowledge-pooling' \
  -H 'Authorization: Bearer <firebase_token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "exam_id": "exam_456",
    "forceGenerate": true
  }'
```

### Using JavaScript (fetch)

```javascript
const generateKnowledgePooling = async (
  userId,
  certId,
  examId,
  forceGenerate = false
) => {
  const response = await fetch(
    `/api/users/${userId}/certifications/${certId}/knowledge-pooling`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firebaseToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        exam_id: examId,
        forceGenerate: forceGenerate,
      }),
    }
  );

  const data = await response.json();
  if (data.success) {
    console.log("Generated insights:", data.data.knowledge_insights);
    console.log("Processing time:", data.metadata.processing_time_ms + "ms");
    console.log("Force regenerated:", data.metadata.force_regenerate);
  } else {
    console.error("Error:", data.error);
  }

  return data;
};

// Usage
await generateKnowledgePooling("user_123", 1, "exam_456", false);
await generateKnowledgePooling("user_123", 1, "exam_456", true); // Force regenerate
```

### Using React Hook

```typescript
const useGenerateKnowledgePooling = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (
    userId: string,
    certId: number,
    examId: string,
    forceGenerate: boolean = false
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/users/${userId}/certifications/${certId}/knowledge-pooling`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firebaseToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            exam_id: examId,
            forceGenerate: forceGenerate,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      return data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { generate, loading, error };
};
```

## Comparison with Related Endpoints

### vs. `/api/ai/knowledge-pooling`

| Feature             | Internal API                               | Frontend API                                                    |
| ------------------- | ------------------------------------------ | --------------------------------------------------------------- |
| **URL**             | `/api/ai/knowledge-pooling`                | `/api/users/:user_id/certifications/:cert_id/knowledge-pooling` |
| **Method**          | POST                                       | POST                                                            |
| **Request Body**    | `{exam_id, api_user_id, force_regenerate}` | `{exam_id, forceGenerate}`                                      |
| **Authentication**  | Firebase token + `api_user_id` validation  | Firebase token + user access verification                       |
| **Response Format** | Service-oriented response                  | REST API response matching GET endpoint                         |
| **Target Audience** | Internal services, background tasks        | Frontend consumers                                              |
| **Business Logic**  | ✅ Identical                               | ✅ Identical                                                    |
| **Service Layer**   | ✅ Same                                    | ✅ Same                                                         |

### vs. GET Knowledge Pooling Endpoint

| Feature             | GET Endpoint              | POST Endpoint                       |
| ------------------- | ------------------------- | ----------------------------------- |
| **Purpose**         | Retrieve existing data    | Generate new data                   |
| **Response Format** | Identical structure       | Identical structure + metadata      |
| **Performance**     | Fast (cached data)        | Slower (AI generation)              |
| **Caching**         | Returns cached data       | May use cache or force regeneration |
| **Use Case**        | Display existing insights | Generate/refresh insights           |

## Request/Response Flow

### Successful Generation Flow

1. **Request Validation** → Validates `user_id`, `cert_id`, and `exam_id`
2. **Authentication** → Verifies Firebase JWT token and user access
3. **Service Delegation** → Calls `KnowledgePoolingService.generateKnowledgePooling()`
4. **AI Generation** → Generates insights using the same logic as internal API
5. **Data Consolidation** → Retrieves consolidated knowledge pooling data
6. **Response Formation** → Returns data in GET endpoint format + metadata

### Error Handling Flow

1. **Parameter Validation** → Returns 400 for missing/invalid parameters
2. **Authentication Check** → Returns 401 for missing/invalid tokens
3. **Service Errors** → Maps service errors to appropriate HTTP status codes
4. **Data Retrieval Errors** → Handles cases where generation succeeds but data retrieval fails

## Best Practices

### When to Use

- **User-Initiated Generation**: When users want to generate insights for a specific exam
- **Force Regeneration**: When users want to refresh existing insights
- **Frontend Integration**: For building user interfaces that need knowledge pooling functionality
- **Specific Exam Analysis**: When you have a specific exam ID to analyze

### When NOT to Use

- **Automated Background Processing**: Use the internal `/api/ai/knowledge-pooling` endpoint instead
- **Bulk Operations**: Not suitable for processing multiple exams at once
- **Real-time Updates**: Consider using cached data from GET endpoint for better performance

### Performance Considerations

- **AI Generation Cost**: Each call triggers AI generation which has associated costs
- **Processing Time**: Can take several seconds depending on exam complexity
- **Rate Limiting**: Consider implementing rate limiting for production use
- **Caching**: Use `forceGenerate: false` to leverage existing cached data when possible

## Error Handling

### Common Error Scenarios

1. **Missing exam_id**: Returns 400 with clear error message
2. **Invalid Parameters**: Returns 400 for malformed parameters
3. **Authentication Issues**: Returns 401 for missing/invalid Firebase tokens
4. **User Access**: Returns 403 if user doesn't have access to the certification
5. **Service Errors**: Returns appropriate HTTP codes based on service layer errors

### Error Response Structure

All error responses include:

- `success: false`
- `error`: Error type/message
- `details` (optional): Additional error information
- `metadata`: Processing time and timestamp information

## Testing

Use the provided test script to validate the endpoint:

```bash
chmod +x /functions/src/tests/test-generate-knowledge-pooling.sh
./functions/src/tests/test-generate-knowledge-pooling.sh
```

The test script validates:

- Normal generation with specific exam_id
- Force regeneration functionality
- Parameter validation (missing exam_id)
- Authentication requirements
- Error handling scenarios

## Notes

- This endpoint works exactly like `/api/ai/knowledge-pooling` but with a frontend-friendly interface
- Requires a specific `exam_id` in the request body
- `forceGenerate` parameter controls whether to use cached data or force regeneration
- Response format matches the GET knowledge pooling endpoint for easy frontend integration
- Access is restricted to authenticated users through Firebase token validation and user access verification middleware
- Processing time varies depending on exam complexity and AI service performance
