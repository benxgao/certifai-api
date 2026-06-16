# Exam Generation Workflow

> **Source of truth**: `functions/src/endpoints/api/users/exams/createExam.ts`, `functions/src/delegators/tasks/buildExam/index.ts`, `functions/src/services/cloudTasks/`, `functions/src/services/genkit/`
> **Last reviewed**: 2026-05-26
> **Owner**: Backend Team

## Purpose

Document the end-to-end procedure for exam generation from request intake through asynchronous batch completion.

## Entry Points

- API trigger: `POST /users/:user_id/certifications/:cert_id/exams` (handler in `createExam.ts`)
- Task worker: `/delegators/tasks/take` (delegator route to build-exam task handler)

## Workflow Steps

1. **Request validation and auth context**
   - Validate `user_id`, `cert_id`, and payload limits.
   - Verify user ownership against Firebase user context.

2. **Rate-limit check**
   - Check per-user exam generation limits (optimized Redis-based path).
   - Reject if over quota.

3. **Certification + token eligibility checks**
   - Validate certification exists.
   - Validate user has enough credit tokens for requested question count.
   - This is a preflight check only; the actual credit deduction happens later in the exam submission workflow.

4. **Create exam attempt record**
   - Persist exam in `QUESTIONS_GENERATING` state via transactional write path.

5. **Post-creation invalidation and tracking**
   - Record rate-limit event.
   - Invalidate relevant user exam/rate-limit caches.

6. **Generate topic plan via Genkit**
   - Use `examPlanner` flow with optional custom prompt and optional prior exam report context.
   - Store resulting plan in RTDB (`exam_plans/<exam_id>`).

7. **Queue readiness + first task scheduling**
   - Validate queue readiness before task creation.
   - Create first batch task through `ExamGenerationTaskService.createFirstBatchTask(...)`.

8. **Task worker batch processing**
   - Worker reads latest topics from RTDB.
   - Generates batch questions via AI flow.
   - Validates generated output and stores valid questions.

9. **Batch continuation or completion**
   - If more unassigned topics remain, schedule next batch task.
   - If complete, finalize exam status and return ready state for user flow.

10. **Failure path handling**
   - Classify generation failures.
   - Transition exam status to `QUESTION_GENERATION_FAILED` when needed.
   - Invalidate generation-related caches and emit failure logs/metrics.

## State Transitions

Primary exam status progression:

- `QUESTIONS_GENERATING` → `READY` (successful completion)
- `QUESTIONS_GENERATING` → `QUESTION_GENERATION_FAILED` (failure path)

Downstream states occur outside generation workflow:

- `READY` → `IN_PROGRESS` → `COMPLETED`

## Queue and Task Behavior

Queues used:

- `exam-questions-queue`
- `knowledge-pooling-queue` (downstream post-submit path)
- `exam-reports-queue` (downstream post-submit path)

Task creation service applies short delays to reduce race windows (e.g., RTDB write visibility before first batch processing).

## Local vs Production Behavior

- **Local**: task behavior can appear immediate/synchronous depending on environment setup.
- **Production**: tasks are asynchronous and queue-driven.

Implementation/testing must tolerate both modes.

## Failure Modes and Recovery

- **Queue unavailable**: queue readiness validation attempts recovery; fail request if unresolved.
- **Invalid generated questions**: invalid subset filtered; continue if valid items remain.
- **No valid generated questions**: batch may complete with zero persisted items and proceed according to remaining topic state.
- **AI/runtime errors**: classified, logged, status moved to failure state when necessary.

## Troubleshooting Signals

- `EXAM_TRACK - ...` logs for milestone tracing.
- `CHECKPOINT-*` logs from task processing.
- Exam-generation metrics/logger services for duration/memory and success/failure counters.

## Related Docs

- [Exam Generation (AI Services Invariants)](../ai-services/exam-generation.md) – stable AI guardrails
- [Service Catalog](../services/service-catalog.md) – involved services and ownership
- [Redis Patterns](../cache/redis-patterns.md) – cache/rate-limit behavior
- [Testing Strategy](../testing/strategy.md) – async behavior test guidance
- [Token Economy](../product/token-economy.md) – credit/energy balance model used by exam flows
- [Exam Token Workflow](./exam-token-workflow.md) – submission-time mutation and reward lifecycle
