# Force Generate Knowledge Pooling API

## Overview

The Force Generate Knowledge Pooling API provides frontend consumers with the ability to force-regenerate knowledge pooling insights for a specific certification. This endpoint simulates the payload and flow of the `/api/ai/knowledge-pooling` endpoint while providing a user-friendly REST API interface that matches the existing GET knowledge pooling endpoint.

## Endpoint

### POST `/api/users/:user_id/certifications/:cert_id/knowledge-pooling/force-generate`

Force generates knowledge pooling insights for a certification by analyzing the user's most recent exam under that certification.

#### Parameters

- `user_id` (string, required): The API user ID (internal UUID)
- `cert_id` (number, required): The certification ID

#### Authentication

Requires Firebase authentication token in the Authorization header:

```
Authorization: Bearer <firebase_token>
```

#### Request

No request body is required. The endpoint automatically:

1. Finds the most recent completed exam for the user under the specified certification
2. Uses that exam to trigger knowledge pooling generation with `force_regenerate=true`
3. Returns consolidated knowledge pooling data for the entire certification

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
  "message": "Knowledge pooling force generated successfully",
  "force_regenerated": true,
  "metadata": {
    "exam_id_used": "exam_456",
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
  "error": "No completed exams found",
  "message": "No completed exams found for this certification. Complete at least one exam to generate knowledge pooling insights."
}
```

**500 Internal Server Error**

```json
{
  "success": false,
  "error": "Failed to force generate knowledge pooling",
  "details": "Specific error message",
  "metadata": {
    "processing_time_ms": 1200,
    "timestamp": "2025-08-24T11:15:00.000Z"
  }
}
```

## How It Works

### Flow Simulation

This endpoint simulates the `/api/ai/knowledge-pooling` flow by:

1. **Finding the Most Recent Exam**: Automatically identifies the user's most recently completed exam under the specified certification
2. **Simulating Payload**: Uses the found exam ID as the `exam_id` parameter that would normally be provided to `/api/ai/knowledge-pooling`
3. **Force Regeneration**: Always sets `force_regenerate=true` to ensure fresh insights are generated
4. **Service Layer Integration**: Uses the same `KnowledgePoolingService` that powers `/api/ai/knowledge-pooling`
5. **Consolidated Response**: Returns data in the same format as the GET knowledge pooling endpoint

### Key Features

- **No Request Body Required**: The endpoint handles all the complexity internally
- **Automatic Exam Selection**: Intelligently selects the most recent exam for analysis
- **Force Regeneration**: Always forces regeneration even if recent data exists
- **Consistent Response Format**: Returns data matching the GET knowledge pooling endpoint
- **Comprehensive Error Handling**: Provides detailed error messages for various scenarios
- **Performance Monitoring**: Includes processing time and metadata in responses

## Usage Examples

### Using cURL

```bash
curl -X POST \
  'https://your-api-domain.com/api/users/user_123/certifications/1/knowledge-pooling/force-generate' \
  -H 'Authorization: Bearer <firebase_token>' \
  -H 'Content-Type: application/json'
```

### Using JavaScript (fetch)

```javascript
const response = await fetch(
  "/api/users/user_123/certifications/1/knowledge-pooling/force-generate",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firebaseToken}`,
      "Content-Type": "application/json",
    },
  }
);

const data = await response.json();
if (data.success) {
  console.log("Force generated insights:", data.data.knowledge_insights);
  console.log("Processing time:", data.metadata.processing_time_ms + "ms");
  console.log("Exam used:", data.metadata.exam_id_used);
} else {
  console.error("Error:", data.error);
}
```

### Using React Hook

```typescript
const useForceGenerateKnowledgePooling = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forceGenerate = async (userId: string, certId: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/users/${userId}/certifications/${certId}/knowledge-pooling/force-generate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firebaseToken}`,
            "Content-Type": "application/json",
          },
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

  return { forceGenerate, loading, error };
};
```

## Comparison with Related Endpoints

### vs. `/api/ai/knowledge-pooling`

| Feature                | `/api/ai/knowledge-pooling`               | Force Generate Endpoint                   |
| ---------------------- | ----------------------------------------- | ----------------------------------------- |
| **Target Audience**    | Internal services, background tasks       | Frontend consumers                        |
| **Request Format**     | Requires `exam_id` in request body        | Uses URL parameters, auto-finds exam      |
| **Response Format**    | Service-oriented response                 | REST API response matching GET endpoint   |
| **Authentication**     | Firebase token + `api_user_id` validation | Firebase token + user access verification |
| **Force Regeneration** | Optional via `force_regenerate` param     | Always enabled                            |
| **Exam Selection**     | Requires specific exam ID                 | Automatically selects most recent exam    |

### vs. GET Knowledge Pooling Endpoint

| Feature             | GET Endpoint              | Force Generate Endpoint        |
| ------------------- | ------------------------- | ------------------------------ |
| **Purpose**         | Retrieve existing data    | Generate new data              |
| **Response Format** | Identical structure       | Identical structure + metadata |
| **Caching**         | Returns cached data       | Forces regeneration            |
| **Performance**     | Fast (cached data)        | Slower (AI generation)         |
| **Use Case**        | Display existing insights | Refresh stale insights         |

## Best Practices

### When to Use

- **User requests fresh insights**: When users want to generate new insights based on recent exam performance
- **Stale data scenarios**: When existing knowledge pooling data is outdated
- **Testing and development**: For generating test data or validating the knowledge pooling system
- **User-initiated refresh**: When users explicitly request updated insights

### When NOT to Use

- **Frequent automated calls**: Avoid calling this endpoint automatically or frequently due to AI generation costs
- **Display existing data**: Use the GET endpoint instead for displaying existing insights
- **Background processing**: Use the internal `/api/ai/knowledge-pooling` endpoint for automated workflows

### Rate Limiting Considerations

- This endpoint should be used sparingly due to AI generation costs
- Consider implementing rate limiting to prevent abuse
- Frontend should provide clear user feedback about the generation process
- Cache results on the frontend to minimize repeated calls

## Error Handling

### Common Error Scenarios

1. **No Completed Exams**: User hasn't completed any exams under the certification
2. **Invalid Parameters**: Missing or malformed user_id/cert_id
3. **Authentication Issues**: Invalid or missing Firebase token
4. **Service Errors**: AI generation or database connectivity issues
5. **Data Retrieval Issues**: Generated successfully but failed to retrieve consolidated data

### Error Response Structure

All error responses include:

- `success: false`
- `error`: Error type/message
- `details` (optional): Additional error information
- `metadata`: Processing time and timestamp information

## Monitoring and Logging

### Key Metrics to Monitor

- **Request Volume**: Track usage patterns and peak times
- **Processing Time**: Monitor AI generation performance
- **Success Rate**: Track successful vs. failed generations
- **Error Distribution**: Monitor common error types
- **Exam Selection**: Track which exams are being used for generation

### Log Structure

The endpoint provides structured logging for:

- Request initiation with parameters
- Exam selection and validation
- AI generation results
- Response preparation and delivery
- Error scenarios with context

## Testing

Use the provided test script to validate the endpoint:

```bash
./src/tests/test-force-generate-knowledge-pooling.sh
```

The test script validates:

- Successful force generation
- Parameter validation
- Authentication requirements
- Error handling
- HTTP method restrictions

## Notes

- This endpoint requires at least one completed exam under the specified certification
- Always forces regeneration regardless of existing data freshness
- Processing time varies depending on exam complexity and AI service performance
- Response format is consistent with the GET knowledge pooling endpoint for easy frontend integration
- Access is restricted to authenticated users through Firebase token validation and user access verification middleware
