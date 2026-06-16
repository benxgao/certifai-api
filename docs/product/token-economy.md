# Token Economy

> **Source of truth**: `functions/prisma/schema.prisma`, `functions/src/endpoints/api/users/getUserProfile.ts`, `functions/src/endpoints/api/users/exams/createExam.ts`, `functions/src/endpoints/api/users/exams/submitExamForUser.ts`
> **Last reviewed**: 2026-06-16
> **Owner**: Product + Backend

## Purpose

This document defines the credit/energy token system used by Certifai for exam access, scoring rewards, and profile balance display.

## Key Concepts

### Credit Tokens

Spendable balance attached to a user account.

- Default on new users: `300`
- Exposed in the profile response as `credit_tokens`
- Used to determine whether a user can proceed with exam generation/start flow
- Deducted when an exam is submitted and finalized

### Energy Tokens

Reward balance attached to a user account.

- Default on new users: `0`
- Exposed in the profile response as `energy_tokens`
- Increased when an exam is submitted successfully
- Current implementation awards `2` energy tokens per correct answer

### Exam Token Cost

Per-exam cost stored on `ExamAttempt.token_cost`.

- Computed at exam creation time from the requested question count
- Current implementation uses `requestedNumberOfQuestions * 2`
- Used again at submission time to deduct credit tokens atomically

### Important Distinction

Do not confuse these balances with:

- Firebase/JWT tokens used for authentication
- Rate-limit tokens returned by the exam rate-limit endpoint

## Balance Lifecycle

1. **Account bootstrap**
   - A new `User` record starts with `credit_tokens = 300` and `energy_tokens = 0`.

2. **Profile read**
   - `GET /api/users/:user_id/profile` returns both balances for UI display and account monitoring.

3. **Exam preflight**
   - `createExam` validates that the user has enough credit tokens for the requested exam size.
   - No credit tokens are deducted at this stage.

4. **Exam completion**
   - `submitExamForUser` deducts the stored credit cost from `credit_tokens`.
   - The same transaction increments `energy_tokens` based on correct answers.

5. **Cache refresh**
   - Profile cache is invalidated after submission so the UI sees the updated balances.

## Examples

- A user with `credit_tokens = 300` requests a 20-question exam.
  - `createExam` validates the balance against the computed cost.
  - The exam record stores the computed `token_cost`.
  - On submit, credit tokens are reduced and energy tokens are awarded.

- A user answers 18 questions correctly in a 30-question exam.
  - Submission awards `36` energy tokens.
  - The user’s credit balance is reduced by the exam cost stored on the attempt.

## Related Docs

- [Product Glossary](./glossary.md) – shared terminology for credit and energy balances
- [Database Design](../architecture/database-design.md) – Prisma schema fields and storage notes
- [Exam Token Workflow](../workflow/exam-token-workflow.md) – step-by-step lifecycle from creation to submission
- [Exam Generation Workflow](../workflow/exam-generation-workflow.md) – preflight balance validation during exam creation
