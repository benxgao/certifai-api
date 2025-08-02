# Certification Summary REST API Endpoints

## Overview

Two new REST API endpoints have been implemented to provide clean access to certification summaries through standard HTTP methods:

- **GET** - Retrieve existing certification summary
- **POST** - Generate/regenerate certification summary

## Endpoints

### 1. GET Certification Summary

**Endpoint**: `GET /users/:user_id/certifications/:cert_id/cert-summary`

**Purpose**: Retrieve an existing certification summary without regenerating it.

**Authentication**: Firebase token required

**Parameters**:

- `user_id` (path parameter): User ID
- `cert_id` (path parameter): Certification ID

**Response Examples**:

**Success (200)**:

```json
{
  "success": true,
  "data": {
    "cert_id": "1",
    "user_id": "user_123",
    "summary": "Your AWS Solutions Architect certification journey shows impressive progress...",
    "structured_data": {
      "cert_id": "1",
      "user_id": "user_123",
      "certification_name": "AWS Certified Solutions Architect - Associate",
      "total_exams_taken": 3,
      "average_score": 85,
      "best_score": 92,
      "worst_score": 78,
      "topic_mastery": [...],
      "performance_trend": "improving",
      "strengths": [...],
      "areas_for_improvement": [...],
      "generated_at": "2025-08-02T10:30:00.000Z",
      "ai_summary": "..."
    },
    "generated_at": "2025-08-02T10:30:00.000Z",
    "summary_stats": {
      "total_exams": 3,
      "average_score": 85,
      "best_score": 92,
      "topics_mastered": 15,
      "performance_trend": "improving",
      "strengths_count": 8,
      "improvement_areas_count": 4
    }
  },
  "message": "Certification summary retrieved successfully"
}
```

**Not Found (404)**:

```json
{
  "success": false,
  "error": "Certification summary not found. Generate one by calling POST to this endpoint.",
  "message": "No certification summary exists yet. Use POST method to generate."
}
```

### 2. POST Generate/Regenerate Certification Summary

**Endpoint**: `POST /users/:user_id/certifications/:cert_id/cert-summary`

**Purpose**: Generate a new certification summary or regenerate an existing one.

**Authentication**: Firebase token required

**Parameters**:

- `user_id` (path parameter): User ID
- `cert_id` (path parameter): Certification ID

**Behavior**:

- If summary exists: Deletes existing and generates fresh one
- If summary doesn't exist: Creates new summary
- Requires at least 2 completed exam reports

**Response Examples**:

**Success - New Generation (200)**:

```json
{
  "success": true,
  "data": {
    "cert_id": "1",
    "user_id": "user_123",
    "summary": "Your AWS Solutions Architect certification journey...",
    "structured_data": {...},
    "already_existed": false,
    "generated_at": "2025-08-02T10:30:00.000Z",
    "summary_stats": {...}
  },
  "message": "Certification summary generated successfully"
}
```

**Success - Regeneration (200)**:

```json
{
  "success": true,
  "data": {...},
  "message": "Certification summary regenerated successfully"
}
```

**Insufficient Data (400)**:

```json
{
  "success": false,
  "error": "Certification summary requires at least 2 completed exam reports"
}
```

## Usage Patterns

### 1. Frontend Integration

```javascript
// Check if summary exists first
async function getCertificationSummary(userId, certId) {
  try {
    const response = await fetch(
      `/api/users/${userId}/certifications/${certId}/cert-summary`,
      {
        headers: { Authorization: `Bearer ${firebaseToken}` },
      }
    );

    if (response.status === 404) {
      // No summary exists, need to generate
      return await generateCertificationSummary(userId, certId);
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting cert summary:", error);
  }
}

// Generate new summary
async function generateCertificationSummary(userId, certId) {
  try {
    const response = await fetch(
      `/api/users/${userId}/certifications/${certId}/cert-summary`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${firebaseToken}` },
      }
    );

    return await response.json();
  } catch (error) {
    console.error("Error generating cert summary:", error);
  }
}

// Force regeneration (refresh)
async function refreshCertificationSummary(userId, certId) {
  // POST always regenerates, even if exists
  return await generateCertificationSummary(userId, certId);
}
```

### 2. Mobile App Integration

```swift
// iOS Swift example
func getCertificationSummary(userId: String, certId: String) async throws -> CertSummary {
    let url = URL(string: "https://api.certifai.app/users/\(userId)/certifications/\(certId)/cert-summary")!
    var request = URLRequest(url: url)
    request.setValue("Bearer \(firebaseToken)", forHTTPHeaderField: "Authorization")

    let (data, response) = try await URLSession.shared.data(for: request)

    if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 404 {
        // Generate new summary
        return try await generateCertificationSummary(userId: userId, certId: certId)
    }

    return try JSONDecoder().decode(CertSummaryResponse.self, from: data).data
}
```

## Error Handling

### HTTP Status Codes

- **200 OK**: Summary retrieved/generated successfully
- **400 Bad Request**: Missing parameters or insufficient exam reports
- **401 Unauthorized**: Missing or invalid Firebase token
- **403 Forbidden**: User doesn't have access to this certification
- **404 Not Found**: Summary doesn't exist (GET only), user/certification not found
- **500 Internal Server Error**: Server error during processing

### Error Response Format

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

## Implementation Details

### Architecture

```
GET/POST /users/:user_id/certifications/:cert_id/cert-summary
    ↓
getCertSummary() / regenerateCertSummary() handlers
    ↓
certSummaryFirestore service (for GET)
generateCertSummary() service (for POST)
    ↓
Firestore storage + AI generation
```

### Key Features

1. **RESTful Design**: Clear HTTP verbs for different operations
2. **Efficient Caching**: GET retrieves without computation
3. **Fresh Generation**: POST always ensures latest data
4. **Proper Error Handling**: Comprehensive HTTP status codes
5. **Detailed Logging**: Full audit trail for monitoring
6. **Security**: Firebase authentication and user access verification

### Middleware Stack

Both endpoints use the standard middleware stack:

- `verifyFirebaseToken`: Ensures valid Firebase authentication
- `verifyUserAccess`: Ensures user can only access their own data

### Performance Considerations

- **GET endpoint**: Fast retrieval from Firestore, no AI computation
- **POST endpoint**: Full regeneration including AI processing (~2-5 seconds)
- **Caching Strategy**: Summaries are cached in Firestore until explicitly regenerated

## Monitoring and Logging

### Log Events

- `GET_CERT_SUMMARY_REQUEST`: GET request initiated
- `GET_CERT_SUMMARY_SUCCESS`: Summary retrieved successfully
- `GET_CERT_SUMMARY_ERROR`: Error during retrieval
- `REGENERATE_CERT_SUMMARY_REQUEST`: POST request initiated
- `REGENERATE_CERT_SUMMARY_DELETE_EXISTING`: Existing summary deleted for regeneration
- `REGENERATE_CERT_SUMMARY_SUCCESS`: Summary regenerated successfully
- `REGENERATE_CERT_SUMMARY_ERROR`: Error during regeneration

### Metrics to Track

- Summary retrieval latency (GET)
- Summary generation latency (POST)
- Cache hit rate (GET returning 200 vs 404)
- Error rates by status code
- Popular certifications for summaries

This implementation provides a clean, RESTful interface for certification summaries while maintaining the robust service layer architecture.
