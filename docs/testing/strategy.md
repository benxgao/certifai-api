# Testing Strategy

> **Source of truth**: `functions/__tests__/`, `functions/jest.config.js`, task handlers in `functions/src/delegators/tasks/`
> **Last reviewed**: 2026-05-26
> **Owner**: Backend Team

## Purpose

Define test patterns for backend correctness with emphasis on API contracts, task idempotency, and error classification.

## Current Test Shape

Primary tests currently in `functions/__tests__/`:

- `cert-summary-phase5-error-contract.test.ts`
- `exam-report-hotfix.test.ts`
- `exam-report-phase1-flow-shape.test.ts`
- `exam-report-task-idempotency.test.ts`
- `example.test.ts`

These focus on:

- API/error contract stability
- Task idempotency semantics
- Phase-specific regression fixes

## Conventions / Rules

### 1) Contract-focused assertions

Prefer asserting stable external contracts:

- HTTP status code
- `success` boolean
- error classification fields (e.g., `retriable`, `permanent_failure`, `error_code`)

### 2) Mock external services

Use Jest mocks for:

- Firebase logger
- Genkit utilities
- downstream generator functions
- external persistence/network dependencies

### 3) Test idempotency for task handlers

Cloud-task-style handlers should be tested for repeated delivery behavior:

- first delivery and duplicate delivery should preserve safe outcomes
- repeated processing should not cause data corruption or invalid duplicate side effects

### 4) Separate transient vs permanent failures

Task handlers should return contractually distinct responses for:

- permanent input/business errors
- transient infrastructure/runtime failures

Tests should explicitly validate this split.

### 5) Keep payload fixtures realistic

Use payloads resembling real task/API payload fields (`exam_id`, `user_id`, `cert_id`, trigger metadata, timestamps).

## Cloud Tasks Local Behavior Notes

Task execution characteristics differ by environment:

- local/dev may execute effectively immediately
- production is queue-driven and asynchronous

Testing should avoid brittle assumptions about wall-clock ordering and should focus on handler contract behavior.

## Coverage Priorities

1. **Task handlers** (`buildExam`, `examReport`, `knowledgePooling`)
2. **Auth + ownership guard paths** (`verifyFirebaseToken`, `verifyUserAccess` integration at route level)
3. **Rate-limit edge cases** (window boundary, equal-to-limit behavior)
4. **Exam status transition safety** (`QUESTIONS_GENERATING` → `READY`/`QUESTION_GENERATION_FAILED`)

## Example Test Pattern (Observed)

- Arrange mocks and deterministic payload
- Call handler with mock req/res
- Assert response status + response payload contract
- Assert mocked dependency invocation counts

## Dangerous Areas / Anti-patterns

- Asserting implementation details instead of observable contract.
- Relying on uncontrolled time without fake timers or deterministic timestamps.
- Missing tests for duplicate task delivery/idempotency.
- Allowing broad `any` in test payloads where typed fixtures are feasible.

## Related Docs

- [Response Envelope](../api/response-envelope.md) – response contract assertions
- [Exam Generation Workflow](../workflow/exam-generation-workflow.md) – async/task sequence context
- [Auth Verification Workflow](../workflow/auth-verification-workflow.md) – auth lifecycle context
- [Service Catalog](../services/service-catalog.md) – service boundaries for mocking
