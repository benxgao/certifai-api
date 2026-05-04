# CertifAI API - TypeScript Type Enforcement Guide

**Status**: Phase 1 ✅ Complete | Phase 2 ✅ Complete | Phase 3 ✅ Complete | Phase 4 ✅ Complete | Phase 5 ✅ Complete | Phase 6 ✅ Complete
**Based on**: Learnings from certifai-app SWR type enforcement project (17/17 files completed)

### Phase 1-2 Completion Summary

| Phase | Sub-Phase                     | Status      | Files/Types                   | Lines  |
| ----- | ----------------------------- | ----------- | ----------------------------- | ------ |
| 1     | Audit & Planning              | ✅ Complete | N/A                           | 0      |
| 1     | Error Classes & Express Types | ✅ Complete | 2 files                       | 245    |
| 1     | Enum Definitions              | ✅ Complete | 1 file                        | 65     |
| 2     | Common API Types              | ✅ Complete | common.ts                     | 109    |
| 2     | User/Auth Types               | ✅ Complete | users.ts                      | 224    |
| 2     | Exam Types                    | ✅ Complete | exams.ts                      | 220    |
| 2     | Certification Types           | ✅ Complete | certifications.ts             | 158    |
| 2     | Question/Answer Types         | ✅ Complete | questions.ts                  | 220    |
| 2     | API Index & Main Export       | ✅ Complete | api/index.ts + types/index.ts | 31 + 1 |

**Phase 1**: 310 lines infrastructure | **Phase 2**: 1,087 lines (100+ types) | **Total**: 1,397 lines

**Phase 2 Completion**: May 1, 2026 (same day as Phase 1)

---

## 🚀 Current Phase: Phase 5 - Endpoint Handler Typing

Now that service-layer typing is complete, Phase 5 will:

1. **Type user endpoints** - `functions/src/endpoints/api/users/`
2. **Type exam endpoints** - `functions/src/endpoints/api/exams/`
3. **Type certification + remaining endpoints** - `functions/src/endpoints/api/certifications/` + special cases

**Foundation Ready**:

- ✅ Phase 1 types: Enums, errors, Express extensions
- ✅ Phase 2 types: 100+ request/response types across 5 domains
- ✅ Phase 3 middleware/utils typing complete with scoped validation
- ✅ Phase 4 service-layer typing complete with `npx tsc --noEmit` passing

### Phase 5 Kickoff Checklist (Ready-to-Execute)

- [ ] Lock endpoint typing order: `users` → `exams` → `certifications` → `other`
- [ ] For each category: enforce typed handler signatures and typed params/query/body
- [ ] For each category: validate response payloads against Phase 2 type contracts
- [ ] Track response contract mismatches immediately in `certifai-app/docs/plans/type-enforce.md`
- [ ] Run category-level typecheck after each category before moving on

### Phase 6 Prep Checklist (Queued)

- [ ] Prepare final verification pass (`tsc`, `eslint`, `any` audit)
- [ ] Prepare breaking-change consolidation template for frontend sync
- [ ] Prepare endpoint-by-endpoint migration notes for certifai-app consumers

---

## 🎯 Objective

Eliminate loose `any` types throughout the certifai-api codebase by:

1. Enforcing explicit type parameters on library calls (Express handlers, database queries, service functions)
2. Creating proper request/response interfaces for all endpoints
3. Using generated Prisma types instead of custom `any` types
4. Documenting architectural type patterns for future development

---

## � API Response Contract Changes & Breaking Change Tracking

**CRITICAL**: During type enforcement, you will discover gaps between what the API actually returns vs what types declare. **Any breaking changes or response modifications MUST be logged.**

### Why This Matters

When type enforcement reveals:

- ✅ New fields in API responses
- ✅ Removed fields from API responses
- ✅ Changed field types (e.g., `string` → `number`)
- ✅ Made fields required/optional that weren't before
- ✅ Renamed fields or endpoints

**These impact certifai-app frontend immediately.**

### Breaking Change Recording Process

Whenever you discover an API response change during type enforcement:

**Step 1**: Record in `/Users/benxgao/workspace/certifai-app/docs/plans/type-enforce.md` under the **"⚠️ API BREAKING CHANGES"** section:

```markdown
## ⚠️ API BREAKING CHANGES DETECTED

Track API response contract changes discovered during type enforcement.
**Frontend must implement these changes** - DO NOT IGNORE.

### Change Format:

- **Endpoint**: /api/users/{userId}/profile
- **Field Name**: avatar_url
- **Change Type**: NEW (Added/Removed/Changed Type/Required→Optional)
- **Old Type**: (not present)
- **New Type**: string | null
- **Frontend Impact**: AppHeader, ProfileClient components need updates
- **Status**: [ ] Frontend Updated [ ] Tested
- **PR Link**: (Add when frontend PR is merged)
```

**Step 2**: Create a checklist item in certifai-app's type-enforce.md:

Example from Phase 2:

```markdown
### Frontend Update Required

- [ ] avatar_url field added to UserProfileData
  - Components: AppHeader.tsx, Profile/client.tsx
  - Tests: Need to verify null avatar handling
  - PR Status: Pending
```

**Step 3**: Link to backend commit:

```markdown
**Backend Source**: /Users/benxgao/workspace/certifai-api/functions/src/endpoints/api/users/getUserProfile.ts
**Commit**: [abc1234](link-to-commit)
**Date Discovered**: 2026-05-01
```

### Template for certifai-app type-enforce.md

Add this section at the TOP of the file:

```markdown
# 🚨 BACKEND API CHANGES TO IMPLEMENT

**Last Sync with certifai-api type enforcement**: [Date]
**Status**: [In Progress / All Changes Applied]

## Pending Frontend Updates

### High Priority (Breaking Changes)

- [ ] Endpoint: GET /api/users/{userId}/profile
  - NEW: avatar_url field (string | null)
  - CHANGED: firebase_user_id now nullable (string | null)
  - Components Affected: AppHeader, ProfileClient
  - PR: (link)

### Medium Priority (New Optional Fields)

- [ ] Endpoint: GET /api/exams/{examId}
  - NEW: completion_percentage field (number)
  - Components Affected: ExamCard, ExamDetail
  - PR: (link)

### Verified Complete ✅

- [x] (List completed items here)
```

---

## �📊 Scope

**Files to Process**: All endpoint handlers in `functions/src/endpoints/api/`

**Target Categories**:

- 🟢 **LOW** (5-10 min each): Simple endpoints with clear request/response
- 🟡 **MEDIUM** (15-20 min each): Endpoints with database queries or transformations
- 🔴 **HIGH** (30+ min each): Complex endpoints with multiple service calls or conditional logic

**Estimated Total Time**: 5-8 hours

---

## 🔑 Key Patterns from certifai-app Success

### Pattern 1: Always Use Generated Types

**What Worked**:

```typescript
// ✅ Good - Uses Prisma generated type
import { User, Exam } from "@prisma/client";

async function getUser(userId: string): Promise<User> {
  return db.user.findUnique({ where: { id: userId } });
}

// ❌ Bad - Uses custom any type
interface User {
  id: string;
  [key: string]: any; // ← Prevents type safety
}
```

**Action**: Replace all custom interfaces with Prisma generated types in `functions/src/services/prisma/index.ts`

---

### Pattern 2: Explicit Error Types

**What Worked**:

```typescript
// ✅ Good - Custom error with context
class ExamSubmissionError extends Error {
  constructor(
    message: string,
    public examId: string,
    public userId: string,
  ) {
    super(message);
    this.name = "ExamSubmissionError";
    Object.setPrototypeOf(this, ExamSubmissionError.prototype);
  }
}

// Handler
try {
  await submitExam(examId, answers);
} catch (err) {
  if (err instanceof ExamSubmissionError) {
    // Can access examId, userId for targeted logging
  }
}
```

**Action**: Create custom error classes in `functions/src/types/errors.ts` for:

- Authentication errors
- Validation errors
- Database errors
- Rate limiting errors
- Exam-specific errors

---

### Pattern 3: Request/Response Type Contracts

**What Worked**:

```typescript
// ✅ Good - Explicit request/response types
interface SubmitExamRequest {
  certId: number;
  answers: Record<string, string>; // question_id: answer_id
  timeSpent: number; // milliseconds
}

interface SubmitExamResponse {
  success: boolean;
  data: {
    examId: string;
    score: number;
    passed: boolean;
  };
  error?: string;
}

app.post<SubmitExamResponse>(
  "/exams/:examId/submit",
  validate(SubmitExamRequest),
  submitExamHandler,
);
```

**Action**: For each endpoint, create request/response types in `functions/src/types/api/`

---

### Pattern 4: Service Layer Type Safety

**What Worked**:

```typescript
// ✅ Good - Typed service functions
class ExamService {
  async generateExamQuestions(
    examId: string,
    count: number,
  ): Promise<Question[]> {
    // Returns properly typed array
  }

  async submitUserAnswer(
    examId: string,
    questionId: string,
    answerId: string,
  ): Promise<void> {
    // Explicit return type prevents accidental data leakage
  }
}

// ❌ Bad - Any return types
async function submitAnswer(data: any): Promise<any> {
  // Caller has no idea what they get back
}
```

**Action**: Add return type annotations to all service methods in `functions/src/services/`

---

### Pattern 5: Middleware Type Guards

**What Worked**:

```typescript
// ✅ Good - Typed middleware with request enhancement
interface AuthenticatedRequest extends express.Request {
  user: {
    uid: string;
    email: string;
    role: "user" | "admin";
  };
}

const authMiddleware = (
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction,
) => {
  req.user = verifyToken(req.headers.authorization);
  next();
};

// Handler knows user is always populated
const handler = (req: AuthenticatedRequest, res) => {
  console.log(req.user.uid); // Type-safe
};
```

**Action**: Create typed middleware interfaces in `functions/src/types/express.ts`

---

### Pattern 6: Enum Usage for Fixed Values

**What Worked** (from exam state enforcement):

```typescript
// ✅ Good - Enum prevents typos
enum ExamStatus {
  READY = 'READY',
  GENERATING = 'GENERATING',
  FAILED = 'FAILED',
}

if (exam.status === ExamStatus.READY) { ... }

// ❌ Bad - String literals prone to typos
if (exam.status === 'READY') { ... }
if (exam.status === 'ready') { ... }  // Silent bug!
```

**Action**: Create enums in `functions/src/types/` for all fixed-value fields:

- ExamStatus
- CertificationStatus
- UserRole
- SubmissionStatus
- etc.

---

## 📋 Implementation Phases

### Phase 1a: Type Audit & Planning ✅ COMPLETE

**Completed**: May 1, 2026 (commit 9588cc1)

**Summary**: Completed initial audit identifying loose types (`Promise<any>`, `[key: string]: any`) and enum candidates. Planned infrastructure.

---

### Phase 1b: Core Type Infrastructure ✅ COMPLETE

**Completed**: May 1, 2026 (commit 9588cc1)

**Created**:

- `functions/src/types/errors.ts` (152 lines) - APIError base class + domain-specific errors
- `functions/src/types/express.ts` (93 lines) - AuthenticatedRequest, TypedRequestHandler, TypedResponse
- Updated `functions/src/types/index.ts` with exports

---

### Phase 1c: Enumeration Definitions ✅ COMPLETE

**Completed**: May 1, 2026 (commit 9588cc1)

**Created**: `functions/src/types/enums.ts` (65 lines) - CertificationStatus, ExamStatus, DifficultyLevel with JSDoc references

---

### Phase 2: API Request/Response Type Definitions 📋 COMPLETE

**Completed**: May 1, 2026 | **Total**: 1,087 lines across 6 files, 100+ types

**Created**:

- `functions/src/types/api/common.ts` (109 lines) - Common response wrappers, pagination, rate limiting
- `functions/src/types/api/users.ts` (224 lines) - Auth, profile, rate limiting types
- `functions/src/types/api/exams.ts` (220 lines) - Exam CRUD, submission, report types
- `functions/src/types/api/certifications.ts` (158 lines) - Certification registration, listing types
- `functions/src/types/api/questions.ts` (220 lines) - Question submission, generation, hints
- `functions/src/types/api/index.ts` (31 lines) - Central export hub

**Validation**: ✅ All criteria met - 100+ types, 0 loose `any`, consistent patterns

---

### Phase 3: Middleware & Utility Typing (1 hour)

**Goals**: Type middleware layer enabling request/response flow

**Tasks**:

1. Type all middleware in `functions/src/middlewares/`:
   - `authMiddleware` - uses `AuthenticatedRequest` from Phase 1b
   - `errorHandler` - uses error types from Phase 1b
   - `validationMiddleware` - use request types from Phase 2
   - `corsMiddleware`, `loggingMiddleware` - add proper types

2. Add return types to all utility functions in `functions/src/utils/`:
   - Remove `any` return types
   - Use explicit return types
   - Parameter types should match Phase 2 interfaces where applicable

3. Type router initialization and Express app setup:
   - Type route callbacks
   - Type app configuration functions

**Success Criteria**:

- ✅ All middleware functions typed with `TypedRequestHandler`
- ✅ No middleware has `any` in signature
- ✅ All utility functions have explicit return types
- ✅ App setup code properly typed
- ✅ Builds: `npx tsc --noEmit`

**Buildable**: ✅ Yes - Middleware now properly typed for handlers

**Completed**: May 2, 2026

**Updated Files**:

- `functions/src/middlewares/authCheck.ts`
- `functions/src/middlewares/verifyUserAccess.ts`
- `functions/src/endpoints/stripe/middlewares.ts`
- `functions/src/utils/examRateLimit.ts`
- `functions/src/utils/examQuestionAssociation.ts`
- `functions/src/utils/questionExamConstraint.ts`

**Completion Notes**:

- Removed remaining production `any` usage in middleware/util signatures and casts (test-only `as any` remains in `utils/pagination.test.ts`).
- Added missing middleware type import (`FirebaseJwtToken`) and tightened token parsing in auth middleware.
- Normalized route param typing in `verifyUserAccess` to satisfy strict Prisma input expectations.
- Standardized logger error payloads to structured metadata to satisfy logger type contracts.

**Validation**:

- ✅ No TypeScript errors in all touched Phase 3 files (`get_errors` clean on 6/6 files).
- ✅ Scoped `any` audit clean for middleware and production utils.
- ✅ Integration blockers discovered later (Express middleware typing + RTDB generics) were resolved during Phase 4 review, and full `npx tsc --noEmit` now passes.

---

### Phase 4: Service Layer Typing by Domain (1.5 hours)

**Goals**: Type all business logic services using Phase 2 types

**Process**: Complete one service domain at a time (can parallelize)

**Tasks**:

**4a: Prisma & Database Service (30 min)**

- Type all methods in `functions/src/services/prisma/index.ts`
- Replace `any` return types with Prisma client types
- Use generics for reusable patterns
- Parameter types from Phase 2
- **Update `functions/src/types/prisma.ts`**: Re-export User, Exam, etc. with JSDoc references (`@see functions/prisma/schema.prisma`, `@prismaModel ModelName`)
- **Update `functions/src/types/PRISMA_REFERENCES.md`**: Document all model mappings with line numbers and field counts

**4a Progress (May 2, 2026)**:

- ✅ Added `functions/src/types/prisma.ts` with Prisma model type re-exports and schema-linked JSDoc references.
- ✅ Added `functions/src/types/PRISMA_REFERENCES.md` with enum/model line mappings and drift-check checklist.
- ✅ Updated `functions/src/types/index.ts` to export new Prisma type aliases.
- ⚠️ Remaining 4a follow-up: migrate direct model type imports in service/domain code to `@/src/types` wrappers where applicable.

**4b: Core Services (30 min)**

- Type methods in `functions/src/services/` (auth, validation, etc.)
- Use Phase 2 request/response types
- Custom error classes from Phase 1b

**4c: Domain Services (30 min)** - Pick order: Users, Exams, then Certifications

- For each service, type all public methods
- Parameter types from Phase 2
- Return types using domain-specific types from Phase 2

**4b/4c Progress (May 2, 2026)**:

- ✅ Removed explicit `any` usage and unsafe error casts in:
  - `functions/src/services/data/knowledgePoolingDataService.ts`
  - `functions/src/services/data/examKnowledgePoolingDataService.ts`
  - `functions/src/services/performance/index.ts`
  - `functions/src/services/monitoring/advancedMonitoring.ts`
  - `functions/src/services/optimizedRateLimit/index.ts`
  - `functions/src/services/examRateLimit/index.ts`
  - `functions/src/services/firebase/rtdb.ts`
  - `functions/src/services/exam-generation-metrics.ts`
  - `functions/src/services/exam-generation-health-check.ts`
  - `functions/src/services/knowledgePooling/knowledgePoolingService.ts`
  - `functions/src/services/firestore/examKnowledgePoolingFirestoreService.ts`
  - `functions/src/services/cloudTasks/baseCloudTaskService.ts`
  - `functions/src/services/genkit/certSummaryGenerator.ts`
  - `functions/src/services/genkit/knowledgePoolingGnerator.ts`
- ✅ `get_errors` clean on all touched files in this pass.
- ✅ Latest commit review completed on commit `b1866d1` (May 2, 2026):
  - Fixed Express middleware request typing compatibility for router composition.
  - Resolved JWT public route request type/export mismatch.
  - Reworked RTDB helper typing to restore safe call-site compatibility across endpoints/delegators.
  - Fixed Cloud Task payload typing compatibility and Genkit flow callable typing.
  - Resolved root type export collision in `types/index.ts`.
  - Added Jest types to `functions/tsconfig.json` for test file compilation.
  - Full compile check now passes: `npx tsc --noEmit` ✅.
- ⚠️ Remaining service-layer hotspots with loose typing are concentrated in:
  - `functions/src/services/cache/cacheHierarchy.ts`
  - `functions/src/services/firebase/examReportFirestore.ts`
  - `functions/src/services/firebase/firestore.ts`
  - `functions/src/services/database/batchWriteOptimizer.ts`
  - `functions/src/services/database/queryOptimizer.ts`

**Phase 4 Final Completion (May 2, 2026)**:

- ✅ All remaining service-layer `any` hotspots eliminated:
  - `functions/src/services/cache/cacheHierarchy.ts` — `SimpleRedisClient.set` generic, `WarmupDataEntry.data: unknown`, error casts
  - `functions/src/services/database/queryOptimizer.ts` — parallel batch internals `unknown[]`, `tx: Prisma.TransactionClient`, `BatchOperation` interface, decorator typing
  - `functions/src/services/database/batchWriteOptimizer.ts` — transaction callback, `executeBatchOperations` param, `isRetryableError(unknown)`, `prepareForBatchCreate<T extends Record<string,unknown>>`, `QuestionBatchHelper` full typed interfaces
  - `functions/src/services/firebase/firestore.ts` — `create/update<T extends object>`, `list/read/count` where `value: unknown`, `batch data: Record<string,unknown>`
  - `functions/src/services/firebase/examReportFirestore.ts` — `whereFilters` operator typed, `queryOptions` via `Parameters<>`, error code narrowing
  - `functions/src/services/genkit/examReportGenerator.ts` — typed flow interfaces (`ExamReportGeneratorFlow/Input/Output`), typed promise
  - `functions/src/services/genkit/utils.ts` — `stream: AsyncIterable<{text?}>`, `model: ReturnType<typeof googleAI.model>`, typed `generateParams`, `context/params/result/metadata` signatures
  - `functions/src/services/redis/index.ts` — `set<T>` generic, all `error as any` → `String(error)`
  - `functions/src/services/gcp/cloudTasks/index.ts` — `catch(error: unknown)` with code narrowing
- ✅ Zero `any` in `src/services/` (confirmed via grep)
- ✅ `npx tsc --noEmit` passes with EXIT:0

**Validation per Domain**:

```bash
# After each service is typed:
npx tsc --noEmit functions/src/services/

# Search for remaining any in service
grep -rn ": any\|Promise<any>" functions/src/services/
```

**Success Criteria**:

- ✅ All service methods have explicit return types
- ✅ All parameters use Phase 2 types
- ✅ No `any` in service signatures
- ✅ Prisma types used for database models
- ✅ Custom errors used for error cases
- ✅ Builds cleanly: `npx tsc --noEmit`

**Buildable**: ✅ Yes after each 4a/4b/4c - Services ready for handlers

---

### Phase 5: Endpoint Handler Typing by Category (2.5 hours)

**Goals**: Wire handlers to typed request/response contracts

**Process**: Complete one category at a time (can parallelize)

**5a: User Endpoints (40 min)** ✅ COMPLETE (May 2, 2026)

- Files: `functions/src/endpoints/api/users/*.ts`
- ✅ Replaced `req: any | CustomRequest` with `AuthenticatedRequestHandler<>` in all 4 files
- ✅ Removed all `as any` / `as CustomRequest` casts from handler signatures and logger calls
- ✅ Typed `getUserProfile.ts` with `ApiResponse<UserProfileData>` — coerced Prisma `Date` → ISO string, `string | null` → `string`
- ✅ Typed `getRateLimit.ts` with `ApiResponse<ExamRateLimitInfo>` (actual service return type)
- ✅ Typed `deleteUser.ts` with `AuthenticatedRequestHandler<unknown, Record<string, unknown>>` (extended response shape)
- ✅ Typed `ensure-account.ts` with `AuthenticatedRequestHandler<{...}, unknown>`
- ✅ Added `user_id?: string` deprecated field to `UserProfileData` in `types/api/users.ts`
- ✅ `npx tsc --noEmit` — 0 errors

**5b: Exam Endpoints (50 min)** ✅ COMPLETE (May 3, 2026)

- Files: `functions/src/endpoints/api/exams/*.ts`
- ✅ Typed all exam handlers under actual route location: `functions/src/endpoints/api/users/exams/*.ts` (12 files)
- ✅ Replaced loose handler signatures (`req: any | CustomRequest`) with `AuthenticatedRequestHandler<...>` and typed `params/query/body`
- ✅ Removed `as any`/implicit `any` in handler-level code paths and error logging metadata
- ✅ Category-level typecheck verified clean with project check filtered to exam endpoints:
  - `npx tsc --noEmit 2>&1 | grep "src/endpoints/api/users/exams" || true` → no output
- ✅ Validated and documented contract drift between Phase 2 exam DTOs and actual endpoint payloads in `certifai-app/docs/plans/type-enforce.md`

**5c: Certification Endpoints (50 min)** ✅ COMPLETE (May 3, 2026)

- Files: `functions/src/endpoints/api/users/certifications/*.ts` (7 files)
- ✅ Replaced loose handler signatures (`req: any | CustomRequest`, `Request | CustomRequest`) with typed `AuthenticatedRequestHandler<...>`
- ✅ Typed route params/body/query per endpoint shape (`user_id`, `cert_id`, `exam_id`, pagination/cert filters)
- ✅ Removed endpoint-level `any` usage in this category (handler signatures, logger casts, batch-operation callback typing)
- ✅ Preserved behavior while tightening types on:
  - `register.ts`
  - `getUserCertifications.ts`
  - `deleteCertification.ts`
  - `getKnowledgePooling.ts`
  - `generateKnowledgePooling.ts`
  - `forceGenerateKnowledgePooling.ts`
  - `getCertSummary.ts`
- ✅ Category-level typecheck verified clean:
  - `npx tsc --noEmit 2>&1 | grep "src/endpoints/api/users/certifications" || true` → no output
- ✅ Documented certification contract drift in `certifai-app/docs/plans/type-enforce.md`

**5d: Other Endpoints & Special Cases (30 min)** ✅ COMPLETE (May 5, 2026)

- Files: `functions/src/endpoints/api/admin/`, `functions/src/endpoints/api/ai/`, `functions/src/endpoints/api/auth/`, `functions/src/endpoints/stripe/`, `functions/src/delegators/tasks/`
- ✅ Replaced `req: any | CustomRequest` / `req: Request | CustomRequest` with `AuthenticatedRequest` in all admin, AI, auth, and stripe endpoint handlers
- ✅ Replaced `req: any | CustomRequest` with `Request` in all Cloud Task delegator handlers (knowledgePooling, examReport, buildExam/index)
- ✅ Typed buildExam internal pipeline (`any[]` → `ExamTopicItem[]`, `QuizItem[]`, `ExamAttempt`):
  - `examValidation.ts`: `handleCorruptedExamPlan`, `prepareBatchTopics` now use `ExamTopicItem[]`; `validateExamState` returns `ExamAttempt`
  - `questionGeneration.ts`: `generateQuestionsWithAI` returns `Promise<QuizItem[]>`; `validateGeneratedQuestions` uses fully typed result arrays
  - `databaseOperations.ts` + `databaseOperationsOptimized.ts`: `storeQuestionsInDatabase` params now `QuizItem[]` + typed `validQuestionResults`
  - `rtdb.ts`: `updateExamPlanInRtdb` accepts `ExamTopicItem[]`; `calculateExamProgressFromPlan` accepts `ExamPlan | null`; `updateData` typed as `RtdbObject`
- ✅ Eliminated all `error as any` / `generationError as any` logger casts — replaced with structured `{ error: message }` objects
- ✅ Fixed Stripe v18 breaking change: `current_period_start/end` moved from `Stripe.Subscription` to `subscription.items.data[0]` — introduced `getSubscriptionPeriod()` helper
- ✅ Fixed query param `ParsedQs` errors in admin endpoints — coerced with `String()`
- ✅ `npx tsc --noEmit` passes with EXIT:0 (zero errors)

**Per-Category Validation**:

```bash
# After each category:
npx tsc --noEmit functions/src/endpoints/api/[category]/

# Verify response types used
grep -rn "res\\.json\|res\\.send" functions/src/endpoints/api/[category]/ | head -5
# Should align with Phase 2 response types
```

**Breaking Change Documentation**:

As you type each handler, if you discover:

- Actual response differs from types
- API returns fields not in schema
- Fields are optional when they should be required (or vice versa)

**Record in `/Users/benxgao/workspace/certifai-app/docs/plans/type-enforce.md`**:

```markdown
### Phase 5a: User Endpoints Breaking Changes

- [ ] GET /api/users/{userId} - new `avatar_url` field discovered
  - Components: AppHeader.tsx, ProfileClient.tsx
  - PR: (will create)
```

**Success Criteria**:

- ✅ All handlers use typed `TypedRequestHandler<>`
- ✅ Route parameters validated with types
- ✅ Response data matches Phase 2 response interfaces
- ✅ Error handling uses Phase 1b error classes
- ✅ **All response discrepancies documented in certifai-app**
- ✅ Builds per category: `npx tsc --noEmit`

**Buildable**: ✅ Yes after each category - API endpoints functional and typed

---

### Phase 6a: TypeScript & Linting Verification (45 min)

**Goals**: Ensure all code compiles and passes static checks

**Tasks**:

1. Full TypeScript compilation:

   ```bash
   npx tsc --noEmit 2>&1 | tee /tmp/tsc-report.txt
   ```

2. Check for remaining `any` patterns:

   ```bash
   grep -rn "Promise<any>\|: any\[" functions/src/
   grep -rn "\[key: string\]: any" functions/src/types/
   grep -rn "any\>" functions/src/  # Generics with any
   ```

3. ESLint validation with strict rules:

   ```bash
   npx eslint functions/src/**/*.ts --max-warnings 0
   ```

4. Document any exceptions:
   - Lines where `any` is necessary (third-party types, etc.)
   - Why exception was needed

**Success Criteria**:

- ✅ `npx tsc --noEmit` returns 0 errors
- ✅ No unexpected `any` patterns (exceptions documented)
- ✅ ESLint passes
- ✅ All imports resolve correctly
- ✅ No circular dependencies

**Buildable**: ✅ Yes - All typing complete

---

### Phase 6b: Breaking Changes Documentation & Sync (45 min)

**Goals**: Document all API changes and sync with frontend team

**Tasks**:

1. Consolidate all breaking changes discovered in Phases 5a-5d:
   - Create master breaking changes list
   - Categorize by severity (breaking vs additive)
   - Map to frontend components affected

2. Update `/Users/benxgao/workspace/certifai-app/docs/plans/type-enforce.md`:
   - Add "🚨 BACKEND API CHANGES TO IMPLEMENT" section
   - List all changes with frontend impact
   - Leave PR placeholders for frontend team

3. Create migration guide:
   - Endpoint contracts (request/response per endpoint)
   - Example: `GET /api/users/{userId}` now returns `avatar_url`
   - Before/after code samples

4. Create type contracts document:
   - Link to Phase 2 type files
   - Reference for frontend SWR hook typing

**Success Criteria**:

- ✅ All breaking changes documented
- ✅ Frontend team has clear impact assessment
- ✅ Migration guide created for future developers
- ✅ Type contracts documented in Prisma docs
- ✅ **certifai-app team notified with checklist**

**Buildable**: ✅ Yes - Documentation phase only

**Completed**: May 5, 2026

**Completion Notes**:

- ✅ Audited all Phase 5d endpoints (admin, AI, auth, Stripe, Cloud Task delegators) — **zero** frontend-impacting breaking changes found
- ✅ Created `certifai-app/docs/plans/api-tpyes-phase-5d.md` — full contract documentation for Phase 5d endpoints
- ✅ Updated `certifai-app/docs/plans/type-enforce.md` — added Phase 5d summary section confirming no frontend changes required; updated sync date to May 5, 2026
- ✅ Created `certifai-app/docs/plans/api-migration-guide.md` — consolidated type contracts for all endpoint categories (auth, user, exam, certification, Stripe) with field-level documentation and frontend implementation status table
- ✅ Stripe v18 breaking change documented: `getSubscriptionPeriod()` helper introduced — API response shape unchanged, only internal Stripe SDK read path corrected
- ✅ `npx tsc --noEmit` passes with EXIT:0 (confirmed before documentation phase)

---

## 📊 Revised Phases Summary

| Phase     | Duration   | Focus                                        | Buildable | Dependencies |
| --------- | ---------- | -------------------------------------------- | --------- | ------------ |
| 1a        | 30 min     | Audit & Planning                             | ✅        | None         |
| 1b        | 45 min     | Core Infrastructure (errors, express, types) | ✅        | 1a           |
| 1c        | 45 min     | Enumerations from Prisma                     | ✅        | 1a           |
| 2         | 2 hrs      | API Request/Response Types                   | ✅        | 1b, 1c       |
| 3         | 1 hr       | Middleware & Utilities                       | ✅        | 1b, 2        |
| 4a-4c     | 1.5 hrs    | Service Layer (by domain)                    | ✅        | 1b, 2, 3     |
| 5a-5d     | 2.5 hrs    | Endpoint Handlers (by category)              | ✅        | 4a-4c        |
| 6a        | 45 min     | TypeScript/Linting Verification              | ✅        | 5a-5d        |
| 6b        | 45 min     | Breaking Changes & Documentation             | ✅        | 5a-5d        |
| **TOTAL** | **~9 hrs** | **Complete Type Safety**                     |           |              |

## Key Parallelization Opportunities

- **Phases 1b & 1c** can run in parallel (isolated)
- **Phases 4a, 4b, 4c** can partially overlap (independent services)
- **Phases 5a, 5b, 5c, 5d** can run in parallel (independent endpoints)
- **Phases 6a & 6b** must follow Phase 5 (full picture needed)

---

## 🏗️ Build & Test Workflow Per Phase

### Phase 3: Middleware Build Workflow

```bash
cd functions

# Type check middleware (may have errors if endpoints not typed yet)
npx tsc --noEmit functions/src/middlewares/ 2>&1
# Expected: May show handler errors, but middleware itself should be clean

# Type check utils specifically
npx tsc --noEmit functions/src/utils/
# Expected: ✅ No errors (utilities are standalone)

# Test that middleware compiles
npx eslint functions/src/middlewares/**/*.ts --max-warnings 0
```

### Phase 4a-4c: Service Layer Build Workflow

```bash
cd functions

# After typing each service file (4a, 4b, 4c):
npx tsc --noEmit functions/src/services/
# Expected: ✅ No errors in services

# Lint the service layer
npx eslint functions/src/services/**/*.ts --max-warnings 0

# Verify exports are available
npx tsc --noEmit functions/src/services/index.ts
# Expected: ✅ All exports resolve

# Note: Endpoints that call these services may error until Phase 5
# This is expected - they get connected in Phase 5
```

### Phase 5a-5d: Endpoint Handler Build Workflow

```bash
cd functions

# After each category (5a, 5b, 5c, 5d):
npx tsc --noEmit functions/src/endpoints/api/[category]/
# Expected: ✅ No errors - handlers now wired to services

# After all 5 categories complete:
npx tsc --noEmit functions/src/endpoints/api/
# Expected: ✅ No errors - all endpoints typed

# Full build should work
npm run build 2>&1 | tail -20
# Check for "Successfully compiled" or equivalent

# Run tests if available
npm test -- --testPathPattern="endpoints" 2>&1 | tail -20
```

### Phase 6a: Full Verification Build Workflow

```bash
cd functions

# Complete TypeScript check
npx tsc --noEmit
# Expected: ✅ No errors

# Full lint
npx eslint src/**/*.ts --max-warnings 0
# Expected: ✅ All files pass

# Build
npm run build
# Expected: ✅ Build succeeds

# Run full test suite
npm test 2>&1 | tail -30
# Expected: ✅ Tests pass (or show pre-existing failures)
```

### Phase 6b: No Build Changes

- Documentation phase only
- No code changes, so build remains the same as Phase 6a

---

## 📋 Quick Checklist: Phase Completion Workflow

Use this checklist after completing each phase (update this doc whenever you finish a phase):

```
Phase 1a: [x] Audit complete, findings documented
Phase 1b: [x] Core types compile, no errors
Phase 1c: [x] Enums defined, match Prisma schema
Phase 2:  [x] API types compile, no any types
Phase 3:  [x] Middleware types, utils typed
Phase 4a: [x] Prisma service typed, compiles
Phase 4b: [x] Core services typed, compiles
Phase 4c: [x] Domain services typed, compiles
Phase 5a: [x] User endpoints typed, category compiles
Phase 5b: [x] Exam endpoints typed, category compiles
Phase 5c: [x] Cert endpoints typed, category compiles
Phase 5d: [x] Other endpoints typed, all compile
Phase 6a: [x] npx tsc --noEmit returns 0 errors
Phase 6b: [x] Breaking changes documented and synced
```

---

## 📌 Source of Truth Hierarchy

**CRITICAL PRINCIPLE**: We do NOT auto-generate TypeScript files from Prisma. Instead, we manually define types based on the following hierarchy:

### 1️⃣ Prisma Schema = Primary Source of Truth

```prisma
// ✅ This is the source of truth
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  profile   Profile?
  role      UserRole // enum
}

enum UserRole {
  ADMIN
  USER
  MODERATOR
}
```

**Action**: When typing Phase 1c (Enums) and Phase 4a (Prisma service):

- Copy enum values directly from Prisma schema
- Use Prisma client types (`User`, `Exam`, etc.) directly
- Don't create competing type definitions

### 2️⃣ Business Logic (Services) = Secondary Source of Truth

```typescript
// ✅ Business logic shows what API actually returns
async function getUserProfile(userId: string) {
  // This function shows what's REALLY returned to clients
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    // ← This field might not exist in Prisma - must be added by service
    avatarUrl: user.profile?.avatar_url || null,
  };
}
```

**Action**: When typing Phase 4 (Services) and Phase 5 (Endpoints):

- Check what services actually return (not just what Prisma models have)
- If service adds/transforms fields, type that
- If service returns different structure than Prisma model, document it

### 3️⃣ API Response Types = Documentation Based on 1 + 2

```typescript
// ✅ This documents what actually gets returned to clients
interface GetUserProfileResponse {
  id: string; // From Prisma User.id
  email: string; // From Prisma User.email
  role: UserRole; // From Prisma enum
  avatarUrl: string | null; // Added by service business logic
}
```

**Action**: When typing Phase 2 (API types):

- Use Prisma-derived types for fields that come directly from schema
- Document where service transforms add new fields
- If response differs from Prisma model, add comment explaining why

---

## 📤 Import Pattern: The Key Consistency Rule

**GOLDEN RULE**: Import types ONLY from `functions/src/types/` folder, NEVER directly from `@prisma/client`

### Why This Matters

```typescript
// ❌ DON'T DO THIS - Direct Prisma imports
import { UserRole, User } from "@prisma/client";
import type { Prisma } from "@prisma/client";

// ✅ DO THIS - Import from our types folder
import { UserRole } from "@/src/types/enums";
import type { User } from "@/src/types/prisma";
```

**Why?**

1. **Single Export Point**: Everything exported is in `types/index.ts` - we control what API surface is public
2. **Consistency**: Same place imports come from across the codebase
3. **Documentation**: Comments and JSDoc in our TS files, not generated code
4. **Type Safety**: If Prisma generation format changes, only our wrapper is affected
5. **API Boundary**: Clear what's internal vs external

### What Goes Where

```
functions/src/types/
├── enums.ts          # ← Copy enum definitions from Prisma schema here
├── prisma.ts         # ← Re-export types from @prisma/client here
│                      #    (User, Exam, Question, etc.)
├── api/
│  └── ...            # ← API request/response types (use your TS types)
├── errors.ts         # ← Custom error classes
├── express.ts        # ← Express middleware types
└── index.ts          # ← Single export point for everything
```

### Concrete Examples

#### Enum: Copy from Prisma, Define in TypeScript

```prisma
// ← In functions/prisma/schema.prisma (SOURCE OF TRUTH)
enum ExamStatus {
  READY
  GENERATING
  QUESTIONS_GENERATED
  FAILED
}
```

```typescript
// ← In functions/src/types/enums.ts (OUR DEFINITION)
/**
 * Exam status enum matching Prisma schema
 * @see functions/prisma/schema.prisma
 */
export enum ExamStatus {
  READY = "READY",
  GENERATING = "GENERATING",
  QUESTIONS_GENERATED = "QUESTIONS_GENERATED",
  FAILED = "FAILED",
}

export type ExamStatusType = keyof typeof ExamStatus;
```

```typescript
// ← In handlers/services (HOW WE USE IT)
import { ExamStatus } from '@/src/types/enums';  // ✅ Never from @prisma/client

if (exam.status === ExamStatus.READY) { ... }
```

#### Prisma Models: Re-export Generated Types

```typescript
// ← In functions/src/types/prisma.ts (RE-EXPORT GENERATED TYPES)
// We use Prisma client types but import from our wrapper

export type { User, Exam, Question } from "@prisma/client";
export type { Prisma } from "@prisma/client";

// Or if you want to add metadata:
export type {
  User,
  /** Exam record exactly as stored in database */
  Exam,
  Question,
} from "@prisma/client";
```

```typescript
// ← In functions/src/types/index.ts (EXPORT ALL)
export * from "./enums";
export * from "./prisma";
export * from "./errors";
export * from "./express";
// etc
```

```typescript
// ← In handlers/services (HOW WE USE IT)
import { User, Exam, ExamStatus } from '@/src/types';  // ✅ One import source

const user: User = await prisma.user.findUnique(...);
if (user.role === UserRole.ADMIN) { ... }
```

---

## 🔗 Traceability & Reference Mapping

**IMPORTANT**: Link each type definition back to its Prisma source so we can detect breaking changes during migrations.

### Pattern 1: JSDoc References to Prisma Schema

```typescript
// ← In functions/src/types/enums.ts

/**
 * Exam status values
 *
 * @see functions/prisma/schema.prisma (line ~45)
 * @prismaEnum ExamStatus
 *
 * Values must match Prisma schema exactly. If schema changes:
 * - READY: Ready for exam to start
 * - GENERATING: Questions are being generated
 * - QUESTIONS_GENERATED: Questions ready, exam waiting to start
 * - FAILED: Generation failed
 */
export enum ExamStatus {
  READY = "READY",
  GENERATING = "GENERATING",
  QUESTIONS_GENERATED = "QUESTIONS_GENERATED",
  FAILED = "FAILED",
}

/**
 * User role enum
 * @see functions/prisma/schema.prisma (line ~12)
 * @prismaEnum UserRole
 *
 * Roles in database. Changes here must be migrated in Prisma.
 */
export enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
  MODERATOR = "MODERATOR",
}
```

### Pattern 2: JSDoc References for Model Re-exports

```typescript
// ← In functions/src/types/prisma.ts

/**
 * User record from database
 * @see functions/prisma/schema.prisma (line ~67)
 * @prismaModel User
 *
 * All fields must exist in Prisma client:
 * - id: String (primary key)
 * - email: String (unique)
 * - role: UserRole (enum)
 * - profile: Profile? (relationship, optional)
 */
export type User = import("@prisma/client").User;

/**
 * Exam record from database
 * @see functions/prisma/schema.prisma (line ~120)
 * @prismaModel Exam
 *
 * Core exam data. Relationships:
 * - questions: Question[] (one-to-many)
 * - attempts: ExamAttempt[] (one-to-many)
 */
export type Exam = import("@prisma/client").Exam;
```

### Pattern 3: Reference Mapping Document

Create `functions/src/types/PRISMA_REFERENCES.md` to track all mappings:

```markdown
# Prisma Type References

This document maps TypeScript type definitions to their Prisma sources.
Use this to detect breaking changes when Prisma schema is modified.

## Enums

| TS Enum    | Prisma Schema | Line | Last Verified | Status     |
| ---------- | ------------- | ---- | ------------- | ---------- |
| ExamStatus | schema.prisma | 45   | 2026-05-01    | ✅ In Sync |
| UserRole   | schema.prisma | 12   | 2026-05-01    | ✅ In Sync |
| CertStatus | schema.prisma | 89   | 2026-05-01    | ✅ In Sync |

## Models (Re-exported)

| TS Type  | Prisma Model | Schema Line | Fields Count | Last Verified |
| -------- | ------------ | ----------- | ------------ | ------------- |
| User     | User         | 67          | 12           | 2026-05-01    |
| Exam     | Exam         | 120         | 18           | 2026-05-01    |
| Question | Question     | 150         | 15           | 2026-05-01    |

## Breaking Change Detection

When Prisma schema changes:

1. **Enum Value Added/Removed**:
   - Example: Add PAUSED to ExamStatus
   - Action: Update enums.ts, increment version

2. **Field Added/Removed from Model**:
   - Example: Add new `avatar_url` field to User
   - Action: Check where User type is used, verify impact

3. **Field Type Changed**:
   - Example: Change `attempts: Int` to `attempts: Decimal`
   - Action: Search types using field, update all usages

4. **Relationship Changed**:
   - Example: Remove Question -> Exam relationship
   - Action: Check service layer for impact
```

### Validation Script

Create `scripts/validate-prisma-types.ts` to detect mismatches:

```typescript
// ← In functions/scripts/validate-prisma-types.ts

import { ExamStatus, UserRole } from "../src/types/enums";
import { User, Exam } from "../src/types/prisma";

/**
 * Validate that TS enums match Prisma schema values
 * Run this during CI/CD or before commits
 */
async function validateEnums() {
  console.log("Checking enum consistency...");

  // Check ExamStatus
  const prismaExamStatuses = [
    "READY",
    "GENERATING",
    "QUESTIONS_GENERATED",
    "FAILED",
  ];
  const tsExamStatuses = Object.values(ExamStatus);

  if (
    JSON.stringify(prismaExamStatuses.sort()) !==
    JSON.stringify(tsExamStatuses.sort())
  ) {
    console.error("❌ ExamStatus mismatch!");
    console.error("  Prisma schema values:", prismaExamStatuses);
    console.error("  TS enum values:", tsExamStatuses);
    process.exit(1);
  }

  console.log("✅ All enums in sync with Prisma schema");
}

/**
 * Check that type definitions are being used from @/src/types
 * Flags direct @prisma/client imports
 */
async function checkImportConsistency() {
  const { execSync } = require("child_process");

  console.log("\nChecking for direct @prisma/client imports...");

  const badImports = execSync(`
    grep -r "from '@prisma/client'" src/ --include="*.ts" \\
      | grep -v node_modules \\
      | grep -v types/prisma.ts \\
      | wc -l
  `)
    .toString()
    .trim();

  if (parseInt(badImports) > 0) {
    console.error(
      `❌ Found ${badImports} direct @prisma/client imports (should only be in types/prisma.ts)`,
    );
    process.exit(1);
  }

  console.log("✅ All imports use @/src/types");
}

// Run validations
validateEnums().catch(console.error);
checkImportConsistency().catch(console.error);
```

### Using Validation in CI/CD

Add to `functions/package.json`:

```json
{
  "scripts": {
    "validate:types": "ts-node scripts/validate-prisma-types.ts",
    "validate:imports": "eslint src --rule 'no-restricted-imports: [error, \"@prisma/client\"]'",
    "validate:all": "npm run validate:types && npm run validate:imports"
  },
  "husky": {
    "hooks": {
      "pre-commit": "npm run validate:all"
    }
  }
}
```

### Breaking Change Detection Matrix

When you see these indicators, it's a **Prisma Breaking Change**:

| Indicator                       | Meaning                                 | Action                                                     |
| ------------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| Enum value added to Prisma      | New status/role option                  | Add to TS enum, document in Prisma references              |
| Enum value removed from Prisma  | Status deprecated                       | Remove from TS enum, mark deprecation in code              |
| New field on Prisma model       | API now returns new field               | Add to response types if exposed, document breaking change |
| Field removed from Prisma model | Data no longer exists                   | Remove from response types, document breaking change       |
| Field type changed in Prisma    | Type now different (e.g., Int → String) | Update TS type, validate all usages                        |
| Relationship renamed/removed    | Navigation changed                      | Check service layer impact, services need updates          |

### Detection Workflow

Every time `functions/prisma/schema.prisma` changes:

```bash
# 1. Run validation to catch inconsistencies
cd functions
npm run validate:all

# 2. Check reference document
# → Is the change recorded in PRISMA_REFERENCES.md?

# 3. Update type definitions if needed
# → enums.ts, prisma.ts, api types

# 4. Add comment linking to commit
# Example:
//  * Last validated: 2026-05-01 (commit abc1234)
//  * See: https://github.com/yourrepo/commit/abc1234

# 5. Update PRISMA_REFERENCES.md with new status
# → Mark "Last Verified" date
```

### Migration Example

**Scenario**: Prisma adds new field to User model

```prisma
// In schema.prisma
model User {
  // ... existing fields ...
  avatar_url String?  // ← NEW FIELD
}
```

**Detection & Action**:

```typescript
// 1. Validation script detects mismatch
// → User type from @prisma/client now has avatar_url field
// → Our response types don't have it

// 2. Update response type in types/api/users.ts
interface GetUserResponse {
  id: string;
  email: string;
  role: UserRole;
  // @see functions/prisma/schema.prisma line ~67 (User.avatar_url)
  // @prismaField avatar_url - NEW (added 2026-05-01)
  avatarUrl?: string;
}

// 3. Update PRISMA_REFERENCES.md
// | User | User | 67 | 13 (was 12) | 2026-05-02 | ⚠️ Field count changed |

// 4. Document breaking change in certifai-app
// → See type-enforce.md in frontend repo
```

---

### Migration: Updating Existing Code

If you find code importing directly from `@prisma/client`:

```typescript
// ❌ BEFORE - Direct import
import { ExamStatus, User } from "@prisma/client";

// ✅ AFTER - Import from our types folder
import { ExamStatus, User } from "@/src/types";
```

This is a refactor that can be done during Phase 1b/1c when establishing type infrastructure.

### During Each Phase

**Phase 1c**: Define enums in `types/enums.ts`, **don't import from `@prisma/client`**

**Phase 2**: Define API types using imports from `@/src/types/`, **not `@prisma/client`**

**Phase 4**: Import types from `@/src/types/` in services, **not directly from Prisma**

**Phase 5**: Wire handlers using `@/src/types/` imports, **not direct Prisma imports**

---

## ⚠️ When API Types Don't Match Reality

**This will happen. Here's what you do:**

### Scenario 1: Type Says Field Exists, But Service Doesn't Return It

```typescript
// ❌ Type declares field
interface UserResponse {
  avatarUrl: string | null; // ← API types say this exists
}

// ❌ But service never actually returns it
async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return {
    id: user.id,
    email: user.email,
    // ← avatarUrl missing! Type is wrong
  };
}
```

**Fix**:

1. Check actual service code to see what's returned
2. Remove `avatarUrl` from API response type
3. If frontend needs avatarUrl, update service to return it
4. Document as breaking change in certifai-app

### Scenario 2: Service Returns Field, Type Doesn't Declare It

```typescript
// ❌ Type doesn't have field
interface UserResponse {
  id: string;
  email: string;
  // ← avatarUrl missing from type
}

// ✅ But service returns it
async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return {
    id: user.id,
    email: user.email,
    avatarUrl: user.profile?.avatar_url || null, // ← Actually returned
  };
}
```

**Fix**:

1. Add `avatarUrl: string | null` to API response type
2. Add comment explaining source: `// Added from profile relationship`
3. If this is NEW, document as breaking change in certifai-app
4. If this was MISSING from type, it's a type bug (fix and merge without frontend change)

### Scenario 3: Type Says Field Is Required, But Service Sometimes Omits It

```typescript
// ❌ Type says always present
interface ExamResponse {
  completedAt: string; // Required!
}

// ❌ But service conditionally includes it
async function getExam(examId: string) {
  return {
    id: examId,
    status: "COMPLETED",
    // ← completedAt might not be here if exam not actually done
  };
}
```

**Fix**:

1. Make field optional in type: `completedAt?: string`
2. In service, always return the field (even if null/undefined)
3. Document in type comment: `// Only present if exam.status === COMPLETED`

---

## 🎯 Type Enforcement Philosophy

**We are DOCUMENTING reality, not creating it.**

- ✅ If Prisma schema says field exists → type it as required (unless service omits it)
- ✅ If Service transforms/adds field → document it in type comment
- ✅ If API response differs from Prisma model → that's expected (services add business logic)
- ✅ If type doesn't match reality → fix type to match reality, document why
- ❌ Don't create fake types to match frontend requests
- ❌ Don't ignore fields that Prisma models have but API doesn't return
- ❌ Don't assume fields are optional without checking service code

---

## 🚨 Breaking Change vs Type Bug

### When Discovering a Mismatch:

**Is it a BREAKING CHANGE?** (Involves frontend)

- Type says field X exists, but API never returned it
- Service is removing a field that frontend depends on
- Response type is changing (string → number)
- → Document in certifai-app breaking changes

**Is it a TYPE BUG?** (Just fixing our types)

- Type says field X is required, but it's actually optional in API
- Type is missing field that API always returned
- Type had wrong type (said string, actually number)
- → Fix type, merge immediately, no frontend change needed

---

## 📋 Phase-Specific Guidance

### Phase 1c: Enum Definitions

- Copy EXACTLY from Prisma schema → Define in `functions/src/types/enums.ts`
- Don't add enum values that aren't in Prisma
- If service uses different enum, that's a code smell (investigate)
- **IMPORTANT**: Other code should import enums from `@/src/types/enums`, NOT from `@prisma/client`
- Add to `functions/src/types/index.ts` exports so everything is accessible via `@/src/types`
- **ADD JSDoc REFERENCES**: Include `@see functions/prisma/schema.prisma (line ~XX)` and `@prismaEnum EnumName`
- **CREATE MAPPING**: Update `functions/src/types/PRISMA_REFERENCES.md` to track all enum sources

### Phase 2: API Request/Response Types

- Response types should match what service ACTUALLY returns
- If you see discrepancy, check service code first
- Add comments explaining any transformation: `// Service adds this from profile relationship`
- **Import strategy**: Use enums/types from `@/src/types/`, not `@prisma/client`
- Example: `import { ExamStatus, UserRole } from '@/src/types/enums'` in response type definitions

### Phase 4: Service Typing

- Your return types become the source of truth for what API returns
- If you discover type is wrong, fix it here
- Document why service transforms fields vs returning raw Prisma
- **Import strategy**: Use types from `@/src/types/` throughout (User, ExamStatus, etc.)
- Avoid imports from `@prisma/client` except in the Prisma service layer itself

### Phase 5: Endpoint Handlers

- Validate handlers call services correctly
- Validate response matches typed response interface
- If endpoint returns different structure than service, that's the source of the mismatch
- **Import strategy**: All imports come from `@/src/types/` - never directly from `@prisma/client`
- This ensures API boundary clarity and consistent import patterns

---

## 🔗 Related Documents

- **Prisma Schema**: `functions/prisma/schema.prisma` - Always check here for truth
- **Service Layer**: `functions/src/services/` - Shows what API actually returns
- **API Types**: `functions/src/types/api/` - Documentation of reality
- **Breaking Changes**: `../certifai-app/docs/plans/type-enforce.md` - Frontend impact tracking

---

## 🚦 Common Pitfall Detection

If you encounter during type enforcement:

| Situation                                            | Root Cause                          | Action                                                                                     |
| ---------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| Type has field, service doesn't return it            | Type is wrong                       | Remove from type (type bug) OR update service to return it (breaking change)               |
| Service returns field, type missing it               | Type is incomplete                  | Add field to type (type bug unless new field)                                              |
| Type says required, actually optional                | Type is too strict                  | Make optional in type (type bug)                                                           |
| Field in Prisma, not in response                     | Intentional filtering               | Add comment explaining why (type bug or feature?)                                          |
| API response structure differs from Prisma           | Service transformation              | Document transformation in comment, verify is intentional                                  |
| Importing from `@prisma/client` in handlers/services | Inconsistent imports                | Delete import, use `@/src/types/` instead (e.g., `import { UserRole } from '@/src/types'`) |
| Same enum imported from multiple sources             | Split types source                  | Consolidate to single import from `@/src/types/enums` (or root `@/src/types`)              |
| Enum values don't match Prisma schema                | Type definition is outdated         | Check Prisma schema, update enum values, update PRISMA_REFERENCES.md                       |
| JSDoc reference missing from type definition         | Incomplete traceability             | Add `@see functions/prisma/schema.prisma (line ~XX)` and `@prismaEnum/Model EnumName` tags |
| Prisma schema changed but types not updated          | Stale types                         | Run `npm run validate:types`, update offending types, update PRISMA_REFERENCES.md          |
| PRISMA_REFERENCES.md is missing/outdated             | No breaking change detection system | Recreate/update reference mapping, (re)add to version control                              |

---

## 🚨 Critical Learnings from certifai-app

### 1. **Prisma DateTime Fields Are Always Strings in JSON**

**Problem Encountered**: Defined `submitted_at: number` when API actually returns ISO 8601 strings
**Why**: Prisma serializes DateTime fields to ISO 8601 strings in JSON responses, never as timestamps

**Solution**:

```typescript
// In Prisma schema
model ExamAttempt {
  submitted_at DateTime?
}

// In API response type
interface ExamSubmissionResponse {
  submitted_at: string | null;  // ← Always string, never number
}
```

**Action for API**: Verify all DateTime fields in response types are `string | null`, never `number`

---

### 2. **Duplicate Type Definitions Cause Cascading Errors**

**Problem Encountered**: `ExamState` interface shadowed `ExamListItemData` with different `submitted_at` type
**Why**: When one type is updated, duplicates aren't, causing inconsistencies

**Solution**:

```bash
# Before starting type enforcement:
grep -r "interface Exam" functions/src/types/
# Should show only ONE definition of each domain type
```

**Action for API**: Audit types before enforcement:

```bash
grep -r "interface User\|interface Exam\|interface Certification" functions/src/ | sort | uniq -c
# Look for any count > 1
```

---

### 3. **Generic Library Calls Need All Type Parameters**

**Problem Encountered**: `useSWRMutation<Data, Error>` works, but `useSWRMutation<Data, Error, Key, ExtraArgument>` needed for mutations with extra args
**Why**: Library signature has 4 parameters, not 2

**Solution**:

```typescript
// ✅ Correct - All 4 type parameters
useSWRMutation<
  ApiResponse<ExamSubmitData>,
  Error,
  string,
  { examId: string; answers: any }
>;

// ❌ Incomplete - Missing last 2
useSWRMutation<ApiResponse<ExamSubmitData>, Error>;
```

**Action for API**: Same principle for Express handlers:

```typescript
// ✅ Correct - All type parameters specified
app.post<SubmitExamResponse, SubmitExamRequest, Params, Query>(
  "/submit",
  handler,
);

// ❌ Loose - No type safety
app.post("/submit", handler);
```

---

### 4. **Component/Client Knowledge Reveals API Gaps**

**Pattern**: Frontend code trying to access `profile.avatar_url` indicated missing field
**Reality**: Always verify in API endpoint source code before updating types

**Action for API**: When expanding types based on client feedback:

1. Frontend requests `profile.avatar_url` error
2. DON'T blindly add field to response type
3. Check: Does endpoint return this field? Does Prisma model have it?
4. If not in API: Frontend should stop requesting it, not API adding it

---

### 5. **Error Type Context Matters**

**Problem**: Generic `Error | undefined` doesn't tell caller what failed
**Solution**: Custom error classes with context

**Apply to API**:

```typescript
class ExamGenerationError extends Error {
  constructor(
    message: string,
    public examId: string,
    public failureReason: "validation" | "processing" | "timeout",
  ) {
    super(message);
  }
}

// Callers can now query error context
throw new ExamGenerationError("Question generation failed", examId, "timeout");
```

---

## 🔍 Verification Checklist by Phase

### After Phase 3 (Middleware Complete)

```bash
# Verify middleware compiles
npx tsc --noEmit functions/src/middlewares/

# Check no any in middleware
grep -rn ": any" functions/src/middlewares/ | wc -l
# Should output: 0
```

- ✅ All middleware uses `AuthenticatedRequest` or `TypedRequestHandler`
- ✅ All utilities have explicit return types
- ✅ No middleware has `any` in signature

### After Phase 4a-4c (Services Complete)

```bash
# Verify services compile
npx tsc --noEmit functions/src/services/

# Check service return types
grep -rn "Promise<any>\|: any" functions/src/services/ | wc -l
# Should output: 0

# Count typed methods vs total
grep -cn "async " functions/src/services/*.ts | awk -F: '{sum+=$2} END {print "Total async methods: " sum}'
```

- ✅ All service methods have explicit return types
- ✅ No `any` parameters in service functions
- ✅ Prisma types used for database operations
- ✅ Custom errors used in error paths

### After Phase 5a-5d (Endpoints Complete)

```bash
# Verify by category
npx tsc --noEmit functions/src/endpoints/

# Check handler response types align with Phase 2
grep -rn "res\\.json(\|res\\.send(" functions/src/endpoints/api/ | wc -l
# Each should use typed response interface

# Verify no loose any in endpoints
grep -rn ": any\|Promise<any>" functions/src/endpoints/ | grep -v ".test.ts" | wc -l
# Should be 0 or only in test files
```

- ✅ All handlers use typed request/response types
- ✅ Route parameters validated with types
- ✅ Error handling uses custom error classes
- ✅ **All response discrepancies documented in certifai-app**
- ✅ **All breaking changes have frontend PR associations**

### After Phase 6a (Verification Complete)

```bash
# Final TypeScript check
npx tsc --noEmit 2>&1 | tee /tmp/final-tsc.txt
# Should output: (no errors)

# Count reported errors
grep "error TS" /tmp/final-tsc.txt | wc -l
# Should output: 0

# ESLint validation
npx eslint functions/src/**/*.ts --max-warnings 0 2>&1 | tail -5

# Final any audit
echo "=== Promise<any> ==="
grep -rn "Promise<any>" functions/src/ --include="*.ts" --exclude-dir=node_modules | grep -v ".test.ts" | wc -l

echo "=== [key: string]: any ==="
grep -rn "\[key: string\]: any" functions/src/ --include="*.ts" | wc -l

echo "=== : any patterns (excluding tests) ==="
grep -rn ": any[,;)]" functions/src/ --include="*.ts" | grep -v ".test.ts" | grep -v "node_modules" | wc -l
# All should be 0 for production code
```

- ✅ `npx tsc --noEmit` returns 0 errors
- ✅ ESLint passes with max-warnings 0
- ✅ No unexpected `any` patterns (exceptions documented)
- ✅ All imports resolve correctly
- ✅ No circular dependencies

### After Phase 6b (Documentation Complete)

```bash
# Verify breaking changes documented
grep -c "🚨 BACKEND API CHANGES\|Endpoint:" ../certifai-app/docs/plans/type-enforce.md
# Should have multiple entries if breaking changes exist

# Check all phases documented
grep -E "Phase [1-6]" ../certifai-app/docs/plans/type-enforce.md | wc -l
```

- ✅ All breaking changes documented in certifai-app
- ✅ Frontend team has clear impact assessment
- ✅ Migration guide created
- ✅ Type contracts documented
- ✅ Frontend PRs linked in documentation

---

## 💾 Quick Reference: certifai-app Results

**Starting Point**: 17 SWR hooks with various typing issues
**Ending Point**: 17/17 fully typed with explicit generics

**Issues Fixed**:

- ❌ → ✅ `Promise<any>` return types: 2 → 0
- ❌ → ✅ Missing generic parameters: 5 → 0
- ❌ → ✅ `[key: string]: any` properties: 3 → 0
- ❌ → ✅ Callback `any` parameters: 5 → 0
- ❌ → ✅ Missing error types: 3 → 0

**TypeScript Compilation**: 12 initial errors → 0 final errors

**Time Investment**: ~8 hours for comprehensive type safety

---

## 📊 Breaking Changes Tracking Best Practices

### When Documenting Changes

**DO**:

- ✅ Document **immediately** when discovering a change
- ✅ Include endpoint path exactly: `/api/users/{userId}/exams`
- ✅ Specify field name(s) affected: `exam_status`, `created_at`
- ✅ Note the type change: `string` → `number`, added optional, etc.
- ✅ List all components that need updates
- ✅ Add PR links as soon as frontend PR is created
- ✅ Mark complete when frontend PR is merged

**DON'T**:

- ❌ Wait until end of phase to document (easy to forget changes)
- ❌ Use generic descriptions - be specific
- ❌ Skip affected components - search the codebase
- ❌ Leave entries without PR links
- ❌ Mark complete until PR is actually merged and tested

### Example Breaking Change Entry

```markdown
## ⚠️ API BREAKING CHANGES DETECTED

### 1. User Profile Avatar Field

- **Endpoint**: GET /api/users/{userId}/profile
- **Change Type**: NEW FIELD
- **Field Name**: avatar_url
- **Type**: string | null
- **Description**: Added user avatar URL support
- **Affected Components**:
  - AppHeader.tsx (header user icon)
  - ProfileClient.tsx (profile avatar display)
  - useProfile.ts hook
- **Breaking?**: No - defaults to null (backwards compatible)
- **Frontend PR**: #1234 - Add avatar support
- **Status**: ✅ MERGED (2026-05-01)

### 2. Exam Status Field Type Change

- **Endpoint**: GET /api/exams/{examId}
- **Change Type**: CHANGED TYPE
- **Field Name**: submitted_at
- **Old Type**: number (milliseconds)
- **New Type**: string (ISO 8601)
- **Description**: Changed to ISO format for consistency
- **Affected Components**:
  - ExamDetail.tsx
  - ExamCard.tsx
  - ExamReport.tsx
  - formatters/dateFormat.ts
- **Breaking?**: YES - time formatting code must change
- **Frontend PR**: #1235 - Fix exam date handling
- **Status**: ✅ MERGED (2026-05-02)
- **Tests**: Verified in e2e/exams.spec.ts
```

---

## � Breaking Changes & Frontend Workflow

### Integration Points Between Backend and Frontend

```
certifai-api Type Enforcement        certifai-app Organization
═════════════════════════════════════════════════════════════════

Phase 1 Foundation Types ────────→  ⚠️ API BREAKING CHANGES DETECTED
                                    section in type-enforce.md

Phase 2 Middleware & Utils ──────→  Middleware impact checklist
                                    (auth, validation, etc.)

Phase 3 Service Layer ───────────→  Response type changes
                                    business logic updates needed

Phase 4 Endpoint Handlers ──────→  Complete breaking changes list
                                   frontend PRs created/linked

Phase 5 Verification ──────────→   All frontend PRs merged
                                   integration tested
```

### Step-by-Step Workflow for Each Breaking Change

**When you discover a breaking change during type enforcement:**

1. **In certifai-api** (Backend):
   - Document the exact change in code comments
   - Create the breaking change entry (don't commit yet)
2. **In certifai-app** (Frontend):
   - Add entry to `docs/plans/type-enforce.md` under "🚨 BACKEND API CHANGES"
   - Include: endpoint, field, old/new type, affected components
   - Leave status as `[ ]` (not started)

3. **Communication**:
   - Create Slack message or GitHub discussion linking both docs
   - Frontend dev acknowledges they'll handle it

4. **Frontend Implementation**:
   - Frontend dev creates PR in certifai-app
   - Updates type-enforce.md with PR link
   - Marks status as `[x]` when PR is merged

5. **Backend Commit**:
   - Once frontend PR is merged, backend can safely commit changes
   - Leave link to frontend PR in backend PR

### Example Workflow Document (Add to type-enforce.md)

```markdown
---

# 🚨 BACKEND API CHANGES TO IMPLEMENT

**Coordination with**: certifai-api type enforcement
**Last Sync**: [Date of last backend change]
**Status**: [X] Up to date / [ ] Changes pending / [ ] In progress

## Pending Changes

### Change #1: User Profile Avatar Field

**Discovered in**: certifai-api Phase 2.3
**Backend PR**: #456
**Status**:

- [x] Backend typed (committed)
- [x] Frontend PR created #789
- [x] Frontend PR merged (2026-05-01)

**Implementation Details**:

- Endpoint: GET /api/users/{userId}/profile
- New field: avatar_url (string | null)
- Components affected:
  - [ ] AppHeader.tsx - update user icon
  - [ ] ProfileClient.tsx - add avatar display
  - [ ] useProfile.ts - update return type
- PR #789: Add avatar support
- Tests: [Link to E2E tests]

## Completed Changes ✅

- [x] Previous change from [date]
  - Backend PR: #XXX
  - Frontend PR: #YYY
  - Completion: [date]
```

---

## 📋 Coordination Checklist

**Before Starting Type Enforcement**:

- [ ] Create `🚨 BACKEND API CHANGES TO IMPLEMENT` section in certifai-app docs
- [ ] Brief frontend team on expected changes
- [ ] Establish communication channel (Slack, GitHub discussions)
- [ ] Agree on PR linking convention

**During Each Phase**:

- [ ] Document changes immediately (don't wait until end of phase)
- [ ] Add PR placeholder in certifai-app checklist
- [ ] Notify frontend team of changes
- [ ] Frontend dev starts implementation

**During Phase 4 & 5**:

- [ ] Verify all frontend PRs have been created
- [ ] Ensure all tests pass in both repos
- [ ] Update both docs with completion status
- [ ] Create integration test if needed

**Final Verification**:

- [ ] No "pending" changes left in type-enforce.md
- [ ] All frontend PRs linked
- [ ] All frontend PRs merged
- [ ] Both repos synced and tested

---

## �📝 Implementation Command Reference

```bash
# Check current state
npx tsc --noEmit 2>&1 | grep "^functions/" | head -20

# Find loose any patterns in specific file
grep -n ": any" functions/src/endpoints/api/exams/submitExam.ts

# Find all Promise<any> in services
grep -rn "Promise<any>" functions/src/services/

# Validate Prisma types are used
grep -rn "interface.*{" functions/src/types/ | grep -v "Request\|Response"

# Check for enum usage
grep -r "case.*:" functions/src/endpoints/ | head -20
# (Look for string literals instead of enum values)
```

---

## 🚀 Next Steps: Phase 5 Execution + Phase 6 Readiness

---

**Based on**: certifai-app SWR Type Enforcement - Project Complete (17/17 files, 0 errors)
**Created**: 1 May 2026
**Author Notes**: The patterns in this guide proved highly effective for the frontend. The same principles apply to Express handlers, database operations, and service functions in the API.
