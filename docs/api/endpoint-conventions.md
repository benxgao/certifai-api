# Endpoint Conventions

> **Source of truth**: `functions/src/endpoints/api/`, `functions/src/types/express.ts`, `functions/src/types/errors.ts`
> **Last reviewed**: 2026-06-06
> **Owner**: Backend Team

## Purpose

This document defines the REST naming, authentication, versioning, and request/response conventions for all certifai-api endpoints.

## Naming Conventions

### Resource-Based URLs

All endpoints follow REST resource naming:

| HTTP Method | Pattern | Purpose | Example |
|-------------|---------|---------|---------|
| `GET` | `/resource` | List resources | `GET /users/:user_id/exams` |
| `POST` | `/resource` | Create resource | `POST /users/:user_id/exams` |
| `GET` | `/resource/:id` | Get single resource | `GET /users/:user_id/exams/:exam_id` |
| `PUT` / `PATCH` | `/resource/:id` | Update resource | `PUT /users/:user_id/exams/:exam_id/questions/1` |
| `DELETE` | `/resource/:id` | Delete resource | `DELETE /users/:user_id/exams/:exam_id` |

### Naming Rules

1. **Use nouns, not verbs**: `/exams` not `/getExams`
2. **Use lowercase**: `/users`, `/certifications`, not `/Users`
3. **Use hyphens for compound words**: `/rate-limit`, not `/rateLimit`
4. **Use plural or singular consistently**: Collection endpoints use plural (`/exams`), but consider readability
5. **Nest resources logically**: `/users/:user_id/certifications/:cert_id/exams`
6. **Use IDs in paths for filtering**: `/users/123/exams` (get exams for user 123)

### Special Actions

For **non-CRUD operations** (e.g., generating results, triggering workflows), use action verbs in the URL:

| Endpoint | Purpose |
|----------|---------|
| `POST /users/:user_id/certifications/:cert_id/exams` | Create and generate new exam |
| `POST /users/:user_id/exams/:exam_id/submit` | Submit completed exam for scoring |
| `POST /users/:user_id/exams/:exam_id/exam-report` | Trigger report regeneration |
| `GET /users/:user_id/rate-limit` | Get rate limit status (not `/rate-limits`) |

---

## Authentication & Authorization

### Auth Middleware Chain

All protected endpoints MUST use this chain:

```typescript
router.get(
  '/users/:user_id/profile',
  verifyFirebaseToken,    // Step 1: Verify JWT
  verifyUserAccess,       // Step 2: Verify user ownership
  handleGetProfile,       // Step 3: Handler
);
```

### Required Auth Headers

**For all protected endpoints**:

```
Authorization: Bearer <firebase_jwt_token>
```

**Example**:
```bash
curl -H "Authorization: Bearer eyJhbGc..." https://certifai-api.com/users/123/profile
```

### User Ownership Verification

All endpoints with `:user_id` parameter must verify the authenticated user matches:

```typescript
// ✅ Correct: Verify ownership in middleware
router.delete(
  '/users/:user_id/exams/:exam_id',
  verifyFirebaseToken,
  verifyUserAccess,      // Verifies user_id matches authenticated user
  deleteExam,
);

// ❌ Wrong: No ownership check
router.delete(
  '/users/:user_id/exams/:exam_id',
  verifyFirebaseToken,
  deleteExam,            // Attacker can delete other users' exams!
);
```

### Public Endpoint Identifier Derivation (No-Login Flows)

For unauthenticated public endpoints that still need deterministic request correlation (e.g., Stage 1 public trial flows), identifier composition must follow these rules:

1. Generate identifier **server-side only** (do not trust client-provided trial IDs).
2. Compose from visitor IP signal and hash with a server secret salt/pepper.
3. Persist only the hashed identifier (e.g., `trial_id`) in storage/logging payloads.
4. Never persist raw IP address in public trial summary records.

This keeps public contracts deterministic for idempotency while reducing direct handling of raw network identifiers in persistence layers.

---

## HTTP Status Codes

### Success Responses

| Code | Meaning | Use Case |
|------|---------|----------|
| `200 OK` | Request succeeded | GET, PUT, PATCH, DELETE operations |
| `201 Created` | Resource created | POST that creates a new resource |
| `204 No Content` | Success, no response body | DELETE operations (optional) |

### Error Responses

| Code | Meaning | Use Case | Example |
|------|---------|----------|---------|
| `400 Bad Request` | Invalid request body/params | Validation error on user input | Missing required field, invalid enum value |
| `401 Unauthorized` | Missing or invalid auth token | No Firebase JWT or token expired | Missing Authorization header |
| `403 Forbidden` | Authenticated but unauthorized | User trying to access another user's data | `user_id` in URL doesn't match authenticated user |
| `404 Not Found` | Resource doesn't exist | Querying non-existent record | `exam_id` doesn't exist |
| `409 Conflict` | State conflict or duplicate | Can't perform action due to state | Deleting a certification that's already deleted |
| `429 Too Many Requests` | Rate limit exceeded | Too many requests in time window | User exceeded exam generation quota |
| `500 Internal Server Error` | Unexpected server error | Unhandled exception in handler | Database connection failure, Genkit timeout |

### Status Code Examples

**POST /users/:user_id/exams (Create exam)**:
- `201 Created` – Exam successfully created
- `400 Bad Request` – Missing `cert_id` field
- `401 Unauthorized` – No Firebase token
- `403 Forbidden` – Trying to create exam for another user
- `429 Too Many Requests` – User exceeded exam quota

**GET /users/:user_id/exams/:exam_id (Retrieve exam)**:
- `200 OK` – Exam found and returned
- `401 Unauthorized` – No Firebase token
- `403 Forbidden` – Trying to access another user's exam
- `404 Not Found` – Exam ID doesn't exist

---

## Request Parameter Types

### Path Parameters

Extracted from URL path:

```
GET /users/:user_id/exams/:exam_id
     ^^^^^^^^              ^^^^^^^
     Path parameters
```

**Requirements**:
- Always required
- Type: string (URL-safe alphanumeric or UUID)
- Should include IDs needed to identify the resource and ownership

### Query Parameters

Extracted from URL query string:

```
GET /users/:user_id/exams?page_number=1&page_size=20
                          ^^^^^^^^^^^^^^^^^^^^^^^^^^
                          Query parameters
```

**Requirements**:
- Optional unless specified as required
- Type: string (parsed to typed values by middleware)
- Examples: `page_number`, `page_size`, `sort_by`, `filter_status`

### Request Body

Sent as JSON in POST/PUT/PATCH requests:

```
POST /users/:user_id/exams
Content-Type: application/json

{
  "cert_id": 42,
  "question_count": 30,
  "difficulty": "ADVANCED"
}
```

**Requirements**:
- Must be valid JSON
- Type defined by handler (TypedRequestHandler)
- Middleware validates and rejects invalid JSON

---

## Pagination

### Pagination Query Parameters

```
GET /users/:user_id/certifications?page_number=1&page_size=20
```

| Parameter | Type | Default | Constraints | Example |
|-----------|------|---------|-------------|---------|
| `page_number` | integer | 1 | ≥ 1 | `1` |
| `page_size` | integer | 20 | 1–100 | `20` |

### Pagination Response Format

Responses with pagination include a `meta` object:

```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "AWS..." },
    { "id": 2, "name": "Azure..." }
  ],
  "meta": {
    "page_number": 1,
    "page_size": 20,
    "total_records": 150,
    "total_pages": 8
  }
}
```

**Field meanings**:
- `page_number` – Current page (1-indexed)
- `page_size` – Records per page
- `total_records` – Total records in result set (not affected by pagination)
- `total_pages` – Total number of pages

### Middleware

Pagination is applied via middleware:

```typescript
import { mediumPagePagination } from '../middlewares/pagination';

router.get(
  '/users/:user_id/certifications',
  verifyFirebaseToken,
  verifyUserAccess,
  mediumPagePagination,  // Parses and validates pagination params
  getUserCertifications,
);

// Inside handler, access pagination info:
const { page_number, page_size } = req.pagination;
```

---

## Request/Response Contracts

### Generic Request Handler Signature

All handlers MUST use typed request handlers:

```typescript
import { TypedRequestHandler } from '../../types/express';

const createExam: TypedRequestHandler<
  CreateExamRequest,           // req.body type
  ApiResponse<ExamRecord>,     // res.json() type
  { user_id: string; cert_id: string },  // req.params
  Record<string, unknown>      // req.query
> = async (req, res) => {
  // Handler logic
  res.json({ success: true, data: examRecord });
};
```

### Request Validation

Handlers should validate input early:

```typescript
const createExam = async (req: AuthenticatedRequest, res) => {
  const { cert_id } = req.params;
  const { question_count, difficulty } = req.body;

  // Validate required fields
  if (!question_count || !difficulty) {
    res.status(400).json({
      success: false,
      error: 'question_count and difficulty are required',
    });
    return;
  }

  // Validate enums
  if (!Object.values(DifficultyLevel).includes(difficulty)) {
    res.status(400).json({
      success: false,
      error: `Invalid difficulty: ${difficulty}`,
    });
    return;
  }

  // Proceed with business logic
  const exam = await prisma.exam.create({ data: { ... } });
  res.status(201).json({ success: true, data: exam });
};
```

---

## Versioning Strategy

Currently, certifai-api does **not** use URL versioning (`/v1/`, `/v2/`). Instead:

1. **Maintain backward compatibility** when adding fields
2. **Make new fields optional** if possible
3. **Use deprecation warnings** in response headers (future)
4. **Document breaking changes** in a changelog

### If Breaking Changes Become Necessary

Consider `/v2/` prefixes:

```
GET /v1/users/:user_id/exams     // Current version
GET /v2/users/:user_id/exams     // New version with breaking changes
```

---

## Error Handling

### Error Response Format

See [Response Envelope](./response-envelope.md) for details. All error responses include:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE"  // Optional: machine-readable code
}
```

### Common Error Codes

| Code | Meaning | HTTP Status |
|------|---------|-------------|
| `AUTHENTICATION_ERROR` | Missing or invalid Firebase token | 401 |
| `AUTHORIZATION_ERROR` | Authenticated but not authorized for resource | 403 |
| `VALIDATION_ERROR` | Request body/params invalid | 400 |
| `NOT_FOUND` | Requested resource doesn't exist | 404 |
| `CONFLICT` | Resource state conflict or duplicate | 409 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_SERVER_ERROR` | Unexpected server failure | 500 |

### Handler Error Handling Pattern

```typescript
const deleteExam = async (req, res) => {
  try {
    const { exam_id } = req.params;
    const { user_id } = req.verified_user;

    // Check ownership
    const exam = await prisma.exam.findUnique({ where: { exam_id } });
    if (!exam) {
      res.status(404).json({
        success: false,
        error: 'Exam not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    if (exam.user_id !== user_id) {
      res.status(403).json({
        success: false,
        error: 'Unauthorized',
        code: 'AUTHORIZATION_ERROR',
      });
      return;
    }

    // Delete and return success
    await prisma.exam.delete({ where: { exam_id } });
    res.json({ success: true, data: { exam_id } });
  } catch (err) {
    console.error('deleteExam error:', err);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
};
```

---

## Related Docs

- [Repository Map](../ai/repo-map.md) – System boundaries and entry points
- [Response Envelope](./response-envelope.md) – Detailed ApiResponse<T> contract
- [Firebase Functions Structure](../architecture/firebase-functions-structure.md) – Middleware and routing
- [Auth Patterns](../auth/auth-patterns.md) – Auth invariants
- [Testing Strategy](../testing/strategy.md) – Testing endpoints
