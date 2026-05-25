# Firebase Functions Structure

> **Source of truth**: `functions/src/` and `functions/src/index.ts`, `functions/src/endpoints/api/`
> **Last reviewed**: 2026-05-26
> **Owner**: Backend Team

## Purpose

This document describes the organization, routing structure, and middleware chain of the Firebase Functions backend execution layer. Understanding this layer is essential for adding endpoints, understanding request flow, and debugging issues.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────┐
│      Firebase Functions Entry Point (GCP)             │
│      HTTPS Server (functions/src/index.ts)            │
└────────────────────┬─────────────────────────────────┘
                     │ HTTP Request
                     ▼
┌──────────────────────────────────────────────────────┐
│         Express.js Application Router                 │
│              (main API dispatcher)                     │
└────────┬─────────────────┬────────────────┬───────────┘
         │                 │                 │
         ▼                 ▼                 ▼
    API Endpoints    Cloud Tasks         Scheduled
    Delegators       (async jobs)        Functions
    (sync handler)   (background jobs)   (timers)
```

## Entry Points

### 1. HTTP Endpoints Function

**File**: `functions/src/index.ts` → exports `endpoints`

**Trigger**: HTTPS requests to the function URL

**Handler**: `functions/src/endpoints/api/index.ts` (Express router)

**Memory/Timeout**: 512 MiB, 180 seconds

```typescript
export const endpoints = onRequest(
  { memory: '512MiB', timeoutSeconds: 180 },
  apiEndpoints,  // Express app
);
```

**Routes**: All REST API endpoints (users, exams, certifications, caching, profiles, etc.)

### 2. Cloud Tasks Delegators Function

**File**: `functions/src/index.ts` → exports `delegators`

**Trigger**: Cloud Tasks queue calls (async jobs)

**Handler**: `functions/src/delegators/` (background job processors)

**Memory/Timeout**: 512 MiB, 180 seconds

**Common jobs**: Exam generation, knowledge pooling analysis, notifications

### 3. Scheduled Functions

**File**: `functions/src/scheduledFunctions/`

**Examples**:
- `automatedStuckExamCleanup` – Cleans up stalled exam generation jobs
- `autoFailStuckExams` – Fails exams that haven't completed after timeout

---

## Express.js Routing Structure

### Main Router Setup

**File**: `functions/src/endpoints/api/index.ts`

The main API router is organized by domain:

```
/api
├── /public/* .......................... Public endpoints (no auth)
├── /auth/* ............................ Auth endpoints (login, register, token generation)
├── /users/:user_id/* .................. User management
│   ├── /profile ....................... User profile and credits
│   ├── /certifications/* .............. Certification management
│   │   └── /:cert_id/exams/* .......... Exam management under certification
│   ├── /exams/* ....................... Direct exam endpoints
│   └── /rate-limit .................... Rate limit info
└── /admin/* ........................... Admin endpoints (as-needed)
```

### Route Organization Pattern

Each endpoint category lives in its own file/folder:

| Domain | Location | Typical Middleware |
|--------|----------|-------------------|
| Public | `endpoints/api/public/` | None (or minimal) |
| Authentication | `endpoints/api/auth/` | `verifyFirebaseToken` (for user routes) |
| Users | `endpoints/api/users/` | `verifyFirebaseToken`, `verifyUserAccess` |
| Certifications | `endpoints/api/users/certifications/` | `verifyFirebaseToken`, `verifyUserAccess` |
| Exams | `endpoints/api/users/exams/` | `verifyFirebaseToken`, `verifyUserAccess` |
| Admin | `endpoints/api/admin/` | `verifyFirebaseToken` + custom admin check |

### Express Request Handlers

All handlers follow the `TypedRequestHandler` pattern:

```typescript
export const myEndpoint: TypedRequestHandler<
  ReqBody,      // Shape of req.body
  ResBody,      // Shape of res.json() response
  Params,       // Shape of req.params
  Query         // Shape of req.query
> = async (req, res, next) => {
  // Handler logic
};
```

---

## Middleware Chain

### Middleware Order (Critical!)

Middleware is applied in order; each middleware calls `next()` to pass control to the next middleware or handler.

```
Request
  │
  ▼
┌─────────────────────────────────────┐
│  Route-Specific Middleware          │
│  (e.g., verifyFirebaseToken)        │
└────────────────────┬────────────────┘
                     │
                     ▼
┌─────────────────────────────────────┐
│  Request Validation Middleware      │
│  (e.g., pagination, body parsing)   │
└────────────────────┬────────────────┘
                     │
                     ▼
┌─────────────────────────────────────┐
│  Route Handler                      │
│  (business logic, response)         │
└─────────────────────────────────────┘
```

### Key Middleware Files

| Middleware | File | Purpose | Adds to Req |
|--------------|------|---------|-------------|
| **verifyFirebaseToken** | `middlewares/authCheck.ts` | Verifies Firebase JWT token | `firebase_user_info` |
| **verifyUserAccess** | `middlewares/verifyUserAccess.ts` | Validates user ownership and lookup | `verified_user` |
| **mediumPagePagination** | `middlewares/pagination.ts` | Parses and validates pagination params | `pagination` |
| **jwtAuth** | `middlewares/jwtAuth.ts` (legacy) | Custom JWT verification (rarely used now) | `user` |

### Auth Middleware Chain

The most common chain for protected endpoints:

```typescript
router.get(
  '/users/:user_id/profile',
  verifyFirebaseToken,     // Step 1: Verify Firebase token
  verifyUserAccess,        // Step 2: Verify user ownership
  getUserProfile,          // Step 3: Handler
);
```

**At each step**:

1. **verifyFirebaseToken**: 
   - Extracts JWT from Authorization header
   - Verifies signature and expiration via Firebase Admin SDK
   - Sets `req.firebase_user_info` with decoded token
   - Returns 401 if token missing or invalid

2. **verifyUserAccess**:
   - Checks `req.params.user_id` exists
   - Queries database: `prisma.user.findUnique({ where: { user_id } })`
   - Verifies `req.firebase_user_info.uid` matches database `firebase_user_id`
   - Sets `req.verified_user` with user record
   - Returns 403 if user not found or ownership mismatch

3. **getUserProfile** (handler):
   - Can safely assume `req.verified_user` exists
   - All user data is verified as owned by the logged-in user

---

## Public vs. Protected Endpoints

### Public Routes

**Location**: `endpoints/api/public/`

**Middleware**: None (or custom auth-optional logic)

**Examples**: 
- Health check
- Public certification metadata
- Sample questions (limited)

```typescript
router.get('/public/health', (req, res) => {
  res.json({ success: true, data: { status: 'healthy' } });
});
```

### Protected Routes

**Middleware Chain**: `verifyFirebaseToken` → `verifyUserAccess` → Handler

**Enforces**: User must be authenticated and accessing their own data

**Examples**:
- Get user profile
- Create exam
- Submit exam
- View certification progress

---

## Request/Response Flow

### Typical Protected Endpoint Flow

```
1. POST /users/abc123/certifications
   Header: Authorization: Bearer <firebase_jwt>
   Body: { cert_id: 42 }

2. verifyFirebaseToken middleware
   │ Extracts token from header
   │ Calls Firebase Admin SDK to verify
   │ Sets req.firebase_user_info = { uid: 'firebase-user-id', ... }

3. verifyUserAccess middleware
   │ Gets user_id from req.params: 'abc123'
   │ Queries DB: SELECT * FROM user WHERE user_id = 'abc123'
   │ Validates req.firebase_user_info.uid === user.firebase_user_id
   │ Sets req.verified_user = { user_id: 'abc123', firebase_user_id: '...', ... }

4. registerCert handler
   │ Safely uses req.verified_user
   │ Calls Prisma service to insert certification
   │ Returns ApiResponse<Certification>

5. Express sends JSON response:
   HTTP 200
   {
     "success": true,
     "data": { cert_id: 42, user_id: 'abc123', ... }
   }
```

---

## Type Safety

### Express Handler Typing

All handlers must use `TypedRequestHandler` to ensure compile-time safety:

```typescript
// ✅ Good: Types specified
const registerCert: TypedRequestHandler<
  { cert_id: number },                    // req.body
  ApiResponse<CertificationRecord>,       // res.json()
  { user_id: string; cert_id?: string },  // req.params
  Record<string, unknown>                 // req.query
> = async (req, res) => {
  // Handler
};

// ❌ Bad: Handler accepts `any`
const registerCert = async (req: any, res: any) => {
  // Handler
};
```

### Request Type Access

Inside a protected handler, access typed fields:

```typescript
const getUserProfile: AuthenticatedRequestHandler<..., ProfileData> = async (
  req,
  res,
) => {
  // req.verified_user is guaranteed to exist (added by middleware)
  // req.firebase_user_info.uid is guaranteed to exist
  
  const profile: ProfileData = {
    user_id: req.verified_user.user_id,  // ✅ Type-safe
    firebase_user_id: req.firebase_user_info.uid,  // ✅ Type-safe
  };
};
```

---

## Dangerous Areas

### 🔴 CRITICAL: Middleware Ordering

If middleware order is wrong, security invariants break:

```typescript
// ❌ WRONG: Handler runs before auth check
router.get('/users/:user_id/profile', getUserProfile, verifyFirebaseToken);
// User data exposed without auth!

// ✅ CORRECT: Auth first, then handler
router.get(
  '/users/:user_id/profile',
  verifyFirebaseToken,
  verifyUserAccess,
  getUserProfile,
);
```

### 🔴 CRITICAL: Trust User ID from Request

Never trust `req.params.user_id` directly. Always verify it matches the authenticated user:

```typescript
// ❌ WRONG: Trusts parameter without verification
const deleteExam = async (req, res) => {
  const { user_id, exam_id } = req.params;
  await prisma.exam.delete({ where: { exam_id } });
  // Attacker could delete another user's exam!
};

// ✅ CORRECT: Verify user_id matches authenticated user
const deleteExam = async (req, res) => {
  const { exam_id } = req.params;
  const user_id = req.verified_user.user_id;  // From verified middleware
  
  // Verify exam belongs to this user before delete
  const exam = await prisma.exam.findUnique({
    where: { exam_id },
  });
  if (exam?.user_id !== user_id) {
    res.status(403).json({ success: false, error: 'Unauthorized' });
    return;
  }
  
  await prisma.exam.delete({ where: { exam_id } });
};
```

### 🔴 CRITICAL: Async Handler Errors

If a handler throws an error, Express will NOT catch it unless using async/await properly:

```typescript
// ❌ WRONG: Unhandled promise rejection
const myHandler = async (req, res) => {
  // Code here
};
// If myHandler throws, Express doesn't catch it!

// ✅ CORRECT: Wrap in try/catch or use error middleware
const myHandler = async (req, res) => {
  try {
    // Code here
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
```

---

## Common Patterns

### Pattern 1: Protected Endpoint with Pagination

```typescript
router.get(
  '/users/:user_id/exams',
  verifyFirebaseToken,           // Step 1: Auth
  verifyUserAccess,              // Step 2: Ownership
  mediumPagePagination,          // Step 3: Parse pagination
  getUserExams,                  // Step 4: Handler
);

const getUserExams: AuthenticatedRequestHandler<
  unknown,
  ApiResponse<{ exams: ExamRecord[]; meta: PaginationMeta }>,
  { user_id: string },
  unknown
> = async (req, res) => {
  const { user_id } = req.verified_user;
  const { page_number, page_size } = req.pagination;
  
  const exams = await examService.getUserExams(user_id, page_number, page_size);
  res.json({ success: true, data: { exams, meta: { total: exams.length } } });
};
```

### Pattern 2: Public Endpoint with Cache

```typescript
router.get('/public/certifications', getCertificationsWithCache);

const getCertificationsWithCache: TypedRequestHandler<
  unknown,
  ApiResponse<Certification[]>
> = async (req, res) => {
  // Try cache first
  const cached = await redisService.get('certifications:all');
  if (cached) {
    res.json({ success: true, data: JSON.parse(cached) });
    return;
  }
  
  // Fetch and cache
  const certs = await prisma.certification.findMany();
  await redisService.set('certifications:all', JSON.stringify(certs), 3600);
  res.json({ success: true, data: certs });
};
```

---

## Configuration

### Firebase Functions Settings

**File**: `functions/src/index.ts`

```typescript
setGlobalOptions({
  maxInstances: 10,           // Max concurrent instances
  region: 'us-central1',      // Always the same region
  memory: '512MiB',           // Memory per instance
  timeoutSeconds: 180,        // Request timeout
});
```

**Why these settings?**
- `maxInstances: 10` – Prevents unlimited scaling and runaway costs
- `region: 'us-central1'` – Central location for lowest latency
- `512MiB` – Sufficient for Node.js + Prisma + typical workloads
- `180 seconds` – Long enough for exam generation but not excessive

---

## Related Docs

- [Repository Map](../ai/repo-map.md) – System boundaries and structure
- [API Endpoint Conventions](../api/endpoint-conventions.md) – REST naming and patterns
- [Response Envelope](../api/response-envelope.md) – ApiResponse<T> contract
- [Auth Patterns](../auth/auth-patterns.md) – Auth invariants and middleware entry points
- [Auth Verification Workflow](../workflow/auth-verification-workflow.md) – Step-by-step auth flow
- [Service Catalog](../services/service-catalog.md) – Available services to call from handlers
