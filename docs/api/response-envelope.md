# Response Envelope

> **Source of truth**: `functions/src/types/express.ts`, API endpoint implementations
> **Last reviewed**: 2026-05-26
> **Owner**: Backend Team

## Purpose

This document specifies the standard response envelope structure (`ApiResponse<T>`) that all certifai-api endpoints return. All clients (frontend, external integrations) must handle this structure consistently.

---

## ApiResponse Type Definition

### TypeScript Definition

```typescript
/**
 * Standard success response envelope
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;  // Optional metadata (pagination, timing, etc.)
}

/**
 * Standard error response envelope
 */
export interface ApiErrorResponse {
  success: false;
  error: string;               // Human-readable error message
  code?: string;               // Machine-readable error code
  details?: Record<string, any>;  // Optional context-specific details
}

/**
 * Union of success and error responses
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
```

### Key Fields

| Field | Type | Required | When Present | Purpose |
|-------|------|----------|--------------|---------|
| `success` | `boolean` | ✅ Yes | Always | Indicates success (`true`) or failure (`false`) |
| `data` | `T` (generic) | Conditional | Success only | The response payload (varies by endpoint) |
| `error` | `string` | Conditional | Error only | Human-readable error message |
| `code` | `string` | Optional | Error responses | Machine-readable error code |
| `meta` | object | Optional | Some success responses | Pagination, timing, or other metadata |

---

## Success Response Examples

### Minimal Success Response

```json
{
  "success": true,
  "data": {
    "user_id": "123",
    "email": "user@example.com"
  }
}
```

### Success with Pagination Metadata

```json
{
  "success": true,
  "data": [
    { "cert_id": 1, "name": "AWS Solutions Architect" },
    { "cert_id": 2, "name": "Azure Fundamentals" }
  ],
  "meta": {
    "page_number": 1,
    "page_size": 20,
    "total_records": 150,
    "total_pages": 8
  }
}
```

### Success with Timing Metadata

```json
{
  "success": true,
  "data": {
    "exam_id": "exam-456",
    "score": 85,
    "status": "COMPLETED"
  },
  "meta": {
    "generated_at": "2026-05-26T10:30:00Z",
    "processing_time_ms": 1250
  }
}
```

---

## Error Response Examples

### Basic Error

```json
{
  "success": false,
  "error": "Authentication token is required"
}
```

### Error with Code

```json
{
  "success": false,
  "error": "User not found",
  "code": "NOT_FOUND"
}
```

### Validation Error with Details

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "cert_id": "cert_id is required",
    "difficulty": "difficulty must be one of: EASY, ADVANCED, EXPERT"
  }
}
```

### Rate Limit Error

```json
{
  "success": false,
  "error": "Too many requests. You have exceeded 3 exams per 24 hours",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 3,
    "window": "24h",
    "retry_after": 3600
  }
}
```

---

## Response Metadata (`meta` Object)

### Pagination Metadata

Used in list/collection endpoints:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page_number": 1,
    "page_size": 20,
    "total_records": 150,
    "total_pages": 8
  }
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `page_number` | number | Current page (1-indexed) |
| `page_size` | number | Records returned per page |
| `total_records` | number | Total records available (ignoring pagination) |
| `total_pages` | number | Total pages available |

### Custom Metadata

Different endpoints may include domain-specific metadata:

```json
{
  "success": true,
  "data": { "exam_id": "123", "score": 85 },
  "meta": {
    "exam_status": "COMPLETED",
    "completion_time_seconds": 1800,
    "questions_answered": 30,
    "questions_correct": 25,
    "generated_at": "2026-05-26T10:30:00Z"
  }
}
```

---

## Error Codes Reference

### Authentication (4xx)

| Code | HTTP Status | Meaning | Retry? |
|------|-------------|---------|--------|
| `AUTHENTICATION_ERROR` | 401 | Missing or invalid Firebase JWT token | No (fix token) |
| `TOKEN_EXPIRED` | 401 | JWT token has expired | Yes (refresh token) |

### Authorization (4xx)

| Code | HTTP Status | Meaning | Retry? |
|------|-------------|---------|--------|
| `AUTHORIZATION_ERROR` | 403 | Authenticated but not authorized for resource | No (different user) |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required permissions | No (permission issue) |

### Validation (4xx)

| Code | HTTP Status | Meaning | Retry? |
|------|-------------|---------|--------|
| `VALIDATION_ERROR` | 400 | Request body/params invalid | No (fix request) |
| `INVALID_ENUM_VALUE` | 400 | Enum field has invalid value | No (use valid value) |
| `MISSING_REQUIRED_FIELD` | 400 | Required field missing from body | No (add field) |

### Resource (4xx)

| Code | HTTP Status | Meaning | Retry? |
|------|-------------|---------|--------|
| `NOT_FOUND` | 404 | Requested resource doesn't exist | No (wrong resource) |
| `CONFLICT` | 409 | Resource state conflict | Maybe (state may change) |

### Rate Limiting (4xx)

| Code | HTTP Status | Meaning | Retry? |
|------|-------------|---------|--------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests from this user/IP | Yes (wait, then retry) |

### Server (5xx)

| Code | HTTP Status | Meaning | Retry? |
|------|-------------|---------|--------|
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server-side failure | Yes (transient) |
| `SERVICE_UNAVAILABLE` | 503 | Backend service temporarily unavailable | Yes (wait, then retry) |
| `DATABASE_ERROR` | 500 | Database operation failed | Yes (transient) |

---

## Client Handling Patterns

### TypeScript Handler Pattern

```typescript
// Frontend using SWR or fetch
const response = await fetch('/api/users/123/profile', {
  headers: { Authorization: `Bearer ${token}` }
});

const result: ApiResponse<ProfileData> = await response.json();

if (result.success) {
  // ✅ Success: result.data is ProfileData
  console.log(result.data.email);
  
  // Optional: check metadata
  if (result.meta?.page_number) {
    console.log(`Page ${result.meta.page_number} of ${result.meta.total_pages}`);
  }
} else {
  // ❌ Error: result.error and result.code are available
  console.error(`Error [${result.code}]: ${result.error}`);
  
  if (result.code === 'RATE_LIMIT_EXCEEDED') {
    console.log(`Retry after ${result.details?.retry_after} seconds`);
  }
}
```

### React Hook Pattern (SWR Recommended)

```typescript
// Frontend using SWR
const { data, error, isLoading } = useSWR<ApiResponse<ProfileData>>(
  `/api/users/${userId}/profile`,
  fetcher,
);

if (isLoading) return <div>Loading...</div>;

if (error) {
  return <div>Fetch error: {error.message}</div>;
}

if (data && data.success) {
  return <div>Email: {data.data.email}</div>;
} else if (data && !data.success) {
  return <div>API Error [{data.code}]: {data.error}</div>;
}
```

---

## Types for Common Data Shapes

### User Profile Response

```typescript
interface ApiSuccessResponse<{
  user_id: string;
  firebase_user_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  credits: number;
}>
```

### Paginated Certifications Response

```typescript
interface ApiSuccessResponse<Certification[]> {
  success: true;
  data: Certification[];
  meta: {
    page_number: number;
    page_size: number;
    total_records: number;
    total_pages: number;
  };
}
```

### Exam Result Response

```typescript
interface ApiSuccessResponse<{
  exam_id: string;
  status: ExamStatus;
  score: number;
  time_took_seconds: number;
  questions_answered: number;
  total_questions: number;
}>
```

---

## HTTP Status Code Mapping

### Success Responses

| Status | Meaning | Use Case |
|--------|---------|----------|
| `200 OK` | Request succeeded | GET, PUT, PATCH, DELETE operations |
| `201 Created` | Resource created | POST that creates new resource |

### Client Error Responses

| Status | Meaning | Response Body |
|--------|---------|----------------|
| `400 Bad Request` | Invalid request | `{ success: false, error: "...", code: "VALIDATION_ERROR" }` |
| `401 Unauthorized` | Missing/invalid auth | `{ success: false, error: "...", code: "AUTHENTICATION_ERROR" }` |
| `403 Forbidden` | Not authorized | `{ success: false, error: "...", code: "AUTHORIZATION_ERROR" }` |
| `404 Not Found` | Resource missing | `{ success: false, error: "...", code: "NOT_FOUND" }` |
| `409 Conflict` | State conflict | `{ success: false, error: "...", code: "CONFLICT" }` |
| `429 Too Many Requests` | Rate limited | `{ success: false, error: "...", code: "RATE_LIMIT_EXCEEDED" }` |

### Server Error Responses

| Status | Meaning | Response Body |
|--------|---------|----------------|
| `500 Internal Server Error` | Unexpected error | `{ success: false, error: "An unexpected error occurred", code: "INTERNAL_SERVER_ERROR" }` |
| `503 Service Unavailable` | Temporary outage | `{ success: false, error: "Service temporarily unavailable", code: "SERVICE_UNAVAILABLE" }` |

---

## Guidelines for API Designers

### When Adding New Endpoints

1. **Create specific response type** for the endpoint:
   ```typescript
   interface GetExamReportResponse {
     exam_id: string;
     status: ExamStatus;
     score: number;
     // ... other fields
   }
   
   const handler: TypedRequestHandler<
     unknown,
     ApiResponse<GetExamReportResponse>,
   > = async (req, res) => {
     // ...
     res.json({ success: true, data: report });
   };
   ```

2. **Include pagination metadata if list endpoint**:
   ```typescript
   res.json({
     success: true,
     data: exams,
     meta: {
       page_number: req.pagination.page_number,
       page_size: req.pagination.page_size,
       total_records: totalCount,
       total_pages: Math.ceil(totalCount / pageSize),
     },
   });
   ```

3. **Use consistent error codes** from the reference above

4. **Document response shape in JSDocs**:
   ```typescript
   /**
    * Get user profile with certifications
    * 
    * @returns ApiResponse<{ profile: UserProfile; credits: number }>
    * @throws ApiError (401, 403, 500)
    */
   ```

---

## Related Docs

- [Endpoint Conventions](./endpoint-conventions.md) – REST naming and HTTP status codes
- [Firebase Functions Structure](../architecture/firebase-functions-structure.md) – Request/response handling
- [Auth Patterns](../auth/auth-patterns.md) – Authentication and error handling
- [Testing Strategy](../testing/strategy.md) – Mocking ApiResponse in tests
