# Exam Token Workflow

> **Source of truth**: `functions/src/endpoints/api/users/exams/createExam.ts`, `functions/src/endpoints/api/users/exams/submitExamForUser.ts`, `functions/src/endpoints/api/users/getUserProfile.ts`, `functions/prisma/schema.prisma`
> **Last reviewed**: 2026-06-16
> **Owner**: Backend Team

## Purpose

Document the request-to-submission flow that validates credit tokens, finalizes an exam, and awards energy tokens.

## Workflow Steps

1. **User loads balance**
   - The profile endpoint returns `credit_tokens` and `energy_tokens`.
   - UI can use this to show whether the user has enough balance before starting an exam.

2. **Exam request validation**
   - `createExam` verifies the authenticated user owns the requested account.
   - The handler checks that `credit_tokens` is sufficient for the requested question count.
   - This is a preflight check only; no balance mutation happens here.

3. **Exam attempt creation**
   - The server creates `ExamAttempt` with `exam_status = QUESTIONS_GENERATING`.
   - `token_cost` is stored on the exam attempt so the final deduction is deterministic later.

4. **Exam generation proceeds**
   - Question generation, caching, and task orchestration continue independently of token mutation.

5. **Submission validation**
   - `submitExamForUser` loads the exam attempt and verifies ownership.
   - The handler rejects already-submitted exams.
   - It recomputes the score from the submitted answer set.

6. **Atomic balance update**
   - In one Prisma transaction, the system:
     - decrements `credit_tokens` by the exam’s stored `token_cost`
     - increments `energy_tokens` by `2 * correct_answers`
     - marks the exam as `COMPLETED`

7. **Cache invalidation**
   - User profile cache is invalidated so the new balances are visible immediately.
   - Exam cache is invalidated for generation/completion consistency.

8. **Supplementary background work**
   - Exam report generation is queued asynchronously.
   - Knowledge pooling is queued asynchronously.

## State Transitions

- `User.credit_tokens` decreases when an exam is finalized.
- `User.energy_tokens` increases when the exam has correct answers.
- `ExamAttempt.exam_status` transitions to `COMPLETED` after the atomic update.

## Failure Modes and Recovery

- **Insufficient credit balance at creation** → return a validation error before exam creation.
- **Insufficient credit balance at submission** → return a validation error before the transaction.
- **Ownership mismatch** → return `403 Forbidden`.
- **Already submitted** → return `400 Bad Request`.
- **Transaction failure** → no partial token mutation should persist.

## Troubleshooting

- If profile balances look stale, check the profile cache invalidation path.
- If the exam shows the wrong final cost, verify `ExamAttempt.token_cost` was written at creation time.
- If energy awards look too high/low, confirm the scoring path and the `2x correct answers` rule.

## Related Docs

- [Token Economy](../product/token-economy.md) – the conceptual model for credit and energy balances
- [Database Design](../architecture/database-design.md) – Prisma fields and storage layout
- [Exam Generation Workflow](./exam-generation-workflow.md) – creation preflight checks that gate exam start
- [Auth Verification Workflow](./auth-verification-workflow.md) – auth chain used before user-owned operations
