# Knowledge Pooling REST API

## Overview

The Knowledge Pooling REST API provides access to consolidated learning insights for a user's certification. These insights are generated from analyzing incorrect answers across multiple exams under a specific certification.

## Endpoint

### GET /api/users/:user_id/certifications/:cert_id/knowledge-pooling

Retrieve existing knowledge pooling data for a certification.

#### Parameters

- `user_id` (string, required): The API user ID
- `cert_id` (number, required): The certification ID

#### Authentication

Requires Firebase authentication token in the Authorization header:

```
Authorization: Bearer <firebase_token>
```

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
  "message": "Knowledge pooling data retrieved successfully"
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
  "error": "Knowledge pooling data not found",
  "message": "No knowledge pooling data exists for this certification. Complete some exams and generate knowledge insights first."
}
```

**500 Internal Server Error**

```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Failed to retrieve knowledge pooling data"
}
```

## Usage Examples

### Using cURL

```bash
curl -X GET \
  'https://your-api-domain.com/api/users/user_123/certifications/1/knowledge-pooling' \
  -H 'Authorization: Bearer <firebase_token>' \
  -H 'Content-Type: application/json'
```

### Using JavaScript (fetch)

```javascript
const response = await fetch(
  "/api/users/user_123/certifications/1/knowledge-pooling",
  {
    method: "GET",
    headers: {
      Authorization: `Bearer ${firebaseToken}`,
      "Content-Type": "application/json",
    },
  }
);

const data = await response.json();
if (data.success) {
  console.log("Knowledge insights:", data.data.knowledge_insights);
  console.log("Stats:", data.data.stats);
} else {
  console.error("Error:", data.error);
}
```

## Data Structure

### KnowledgeInsight

| Field          | Type   | Description                                |
| -------------- | ------ | ------------------------------------------ |
| `insight_id`   | string | Unique identifier for the insight          |
| `insight`      | string | The learning insight or tip                |
| `topic`        | string | The subject area this insight relates to   |
| `exam_id`      | string | The exam that generated this insight       |
| `generated_at` | string | ISO timestamp when the insight was created |

### Response Stats

| Field            | Type   | Description                                         |
| ---------------- | ------ | --------------------------------------------------- |
| `total_insights` | number | Total number of insights available                  |
| `unique_exams`   | number | Number of different exams that contributed insights |
| `unique_topics`  | number | Number of different topics covered by insights      |

## Notes

- Knowledge pooling data is only available after completing exams and generating insights through the AI knowledge pooling service
- Insights are automatically deduplicated to avoid redundant learning tips
- The endpoint returns consolidated data from all exams under the specified certification
- Access is restricted to the authenticated user's own data through `verifyUserAccess` middleware
