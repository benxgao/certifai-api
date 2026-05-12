# Rollout: Early `READY` Exam Status + Progressive Question Availability

## Summary

This rollout decouples **exam availability** from **generation completion** so users can start an exam as soon as the first batch is usable. Today, `exam_status=READY` is only set after all questions are generated. After this change, `READY` is set as early as possible (first successful batch association), while generation continues in the background.

Key business behavior:

- Batch size changes from `10` to `5`.
- `exam_status` becomes `READY` when first batch questions are associated (at least 1 question linked).
- Users can begin immediately and consume questions ordered by earliest `created_at`.
- `exam_status` changes to `IN_PROGRESS` **only when**:
  1. all questions are generated, and
  2. user has answered at least one question, and
  3. exam is not submitted.
- For exams with fewer than 5 questions: once first batch completes, status becomes `READY`; once user answers first question, status can become `IN_PROGRESS` (because generation is already complete).

---

## Scope

- Estimated files to modify: 10-14
- Estimated files to create: 0-3 (tests/helpers)
- Risk level: **High** (state-machine semantics + async generation + frontend polling)

Out of scope for this rollout:

- New user-visible status values beyond existing enum set.
- Rebuilding exam creation UX beyond status/polling behavior.

---

## Target State (Behavior Contract)

### Status meaning

- `QUESTIONS_GENERATING`: no usable question set yet.
- `READY`: user can start; exam is playable now (may still be generating more questions).
- `IN_PROGRESS`: generation complete and user has started answering but not submitted.
- `COMPLETED`: submitted.
- `QUESTION_GENERATION_FAILED`: unrecoverable generation failure.

### Data semantics

- `total_questions`: **target requested/planned count** (stable after creation).
- Add explicit generation counters to prevent overloading `exam_status`:
  - `generated_questions_count`
  - `associated_questions_count`
  - `generation_completed_at` (nullable)

### Ordering contract

Question retrieval for active exam must be deterministic and ascending by earliest creation time:

- `ORDER BY quizQuestion.created_at ASC`

---

## Phase 0 — Preflight + Feature Flag

### Goal

Prepare controlled rollout path and observability before semantics change.

### Implementation

1. Add backend feature flag (env/config): `EXAM_EARLY_READY_ENABLED`.
2. Add structured logs for transition checkpoints:
   - `EARLY_READY_SET`
   - `GENERATION_COMPLETED`
   - `IN_PROGRESS_SET_AFTER_ANSWER`
3. Ensure logs include: `exam_id`, `user_id`, `batch_number`, `generated_questions_count`, `associated_questions_count`, `target_questions`, `from_status`, `to_status`.

### Files (expected)

- `functions/src/endpoints/api/users/exams/createExam.ts`
- `functions/src/delegators/tasks/buildExam/examCompletion.ts`
- `functions/src/endpoints/api/users/exams/answerUserExamQuestions.ts`
- config/env loading location used in functions runtime

### Acceptance tests (exact)

1. **Flag-off no-op test**
   - Given flag is `false`, creating an exam still follows current behavior (no early `READY` before final generation).
   - Pass criteria: observed status remains `QUESTIONS_GENERATING` until previous completion trigger path.

2. **Structured logging schema test**
   - Trigger one successful generation cycle with flag `true`.
   - Pass criteria: each of the three log event types exists with required fields.

---

## Phase 1 — Schema and Counter Foundations

### Goal

Introduce explicit generation state fields to support early `READY` safely.

### Implementation

1. Prisma schema update for `ExamAttempt`:
   - `generated_questions_count Int @default(0)`
   - `associated_questions_count Int @default(0)`
   - `generation_completed_at DateTime?`
2. Keep existing `total_questions` as target/planned count.
3. Backward compatibility:
   - existing rows default counters to `0` and nullable completion timestamp.

### Files (expected)

- `functions/prisma/schema.prisma`
- migration files under `functions/prisma/migrations/...`
- any affected type exports in `functions/src/services/prisma` layer

### Acceptance tests (exact)

1. **Migration safety test**
   - Apply migration on development DB with existing rows.
   - Pass criteria: migration succeeds without destructive reset; existing rows preserved.

2. **Default value test**
   - Create new exam.
   - Pass criteria: counters are `0`, `generation_completed_at` is `null`.

3. **Type compile gate**
   - Run TypeScript compile check in `functions`.
   - Pass criteria: no TypeScript errors in modified files.

---

## Phase 2 — Batch Size 5 + Progressive Counter Updates

### Goal

Change generator to 5-question batches and maintain counters continuously.

### Implementation

1. Change batch size constant in exam creation from `10` to `5`.
2. On each successful batch persist:
   - increment `generated_questions_count` by stored questions.
   - increment `associated_questions_count` by newly linked `ExamUserAnswer` rows.
3. Ensure idempotency with duplicate-safe insert behavior.

### Files (expected)

- `functions/src/endpoints/api/users/exams/createExam.ts`
- `functions/src/delegators/tasks/buildExam/databaseOperations.ts`
- `functions/src/delegators/tasks/buildExam/examCompletion.ts`
- `functions/src/utils/examQuestionAssociation.ts`

### Acceptance tests (exact)

1. **Batch-size behavior test**
   - Create exam with target `50`.
   - Pass criteria: first task processes up to `5` topics/questions, subsequent tasks continue in 5-sized batches.

2. **Counter monotonicity test**
   - Observe counters across multiple batches.
   - Pass criteria:
     - `generated_questions_count` and `associated_questions_count` never decrease.
     - counters never exceed `total_questions`.

3. **Idempotent retry test**
   - Re-run the same batch payload (simulate task retry).
   - Pass criteria: no duplicate exam-user-answer links; counters remain logically correct.

---

## Phase 3 — Early `READY` Transition

### Goal

Set exam `READY` immediately after first usable association.

### Implementation

1. In completion/association path, if all true:
   - `EXAM_EARLY_READY_ENABLED=true`
   - `exam_status === QUESTIONS_GENERATING`
   - `associated_questions_count > 0`
     then set `exam_status = READY` immediately.
2. Do **not** set `generation_completed_at` at this point.
3. Keep queueing/processing remaining batches until full target is reached or terminal failure.

### Files (expected)

- `functions/src/delegators/tasks/buildExam/examCompletion.ts`
- `functions/src/utils/examQuestionAssociation.ts`

### Acceptance tests (exact)

1. **Early-ready transition test**
   - Create exam with target `50`.
   - Wait until first batch done.
   - Pass criteria: DB status becomes `READY` before all 50 are generated.

2. **Playable while generating test**
   - Call question fetch endpoint after early `READY`.
   - Pass criteria: endpoint returns available questions (not 423 lock).

3. **Background continuation test**
   - After early `READY`, continue polling generation internals.
   - Pass criteria: additional batches continue and counters increase toward target.

---

## Phase 4 — Live Status API Contract Update

### Goal

Expose both availability status and generation progress independently.

### Implementation

Update live-status response data shape to include:

- `exam_status` (availability)
- `progress_percentage` (generation progress)
- `is_generating_completed` (generation completion only)
- `generated_questions_count`
- `associated_questions_count`
- `target_questions`

Important rule:

- `exam_status=READY` must **not** auto-imply `progress_percentage=100`.

### Files (expected)

- `functions/src/endpoints/api/users/exams/getExamLiveStatus.ts`
- shared API typing files used by frontend hook

### Acceptance tests (exact)

1. **Ready-not-complete contract test**
   - In early-ready window (e.g., 5/50 done), call live status.
   - Pass criteria:
     - `exam_status=READY`
     - `is_generating_completed=false`
     - `progress_percentage < 100`

2. **Completion contract test**
   - After final batch complete.
   - Pass criteria:
     - `is_generating_completed=true`
     - `progress_percentage=100`
     - `generated_questions_count=target_questions` (or capped successful target behavior if partial policy applies)

---

## Phase 5 — `IN_PROGRESS` Rule Enforcement

### Goal

Apply new strict semantics for `IN_PROGRESS`.

### Implementation

1. On answer submission (`answerUserExamQuestions.ts`), evaluate transition:
   - if `generation_completed_at != null`
   - and at least one `selected_option_id` exists
   - and `submitted_at == null`
   - then persist `exam_status = IN_PROGRESS`.
2. Before generation completion, answering should **not** force `IN_PROGRESS`; remain `READY`.
3. Ensure read endpoints (`getUserExam`, `getUserExams`) stop overriding status with old inferred logic that conflicts with this rule.

### Files (expected)

- `functions/src/endpoints/api/users/exams/answerUserExamQuestions.ts`
- `functions/src/endpoints/api/users/exams/getUserExam.ts`
- `functions/src/endpoints/api/users/exams/getUserExams.ts`

### Acceptance tests (exact)

1. **No early in-progress test**
   - While generation incomplete (`is_generating_completed=false`), answer first question.
   - Pass criteria: persisted and returned status remains `READY`.

2. **In-progress eligibility test**
   - After generation completion, answer at least one question, not submitted.
   - Pass criteria: persisted and returned status becomes `IN_PROGRESS`.

3. **Small exam edge case (<5)**
   - Create exam with target `3`.
   - After first (and final) batch: status `READY`.
   - After first answered question: status `IN_PROGRESS`.
   - Pass criteria: exact sequence holds.

---

## Phase 6 — Frontend Polling and UX Alignment

### Goal

Frontend should let users start immediately on `READY`, while still tracking background generation.

### Implementation

1. In `useExamLiveStatus`, keep polling while `is_generating_completed=false` (not only while backend status is generating).
2. In exam cards/detail:
   - enable “Begin Exam” once status is `READY`.
   - continue showing generation progress until `is_generating_completed=true`.
3. Preserve ordering by backend question query (`created_at ASC`).

### Files (expected)

- `certifai-app/src/swr/useExamLiveStatus.ts`
- `certifai-app/src/components/custom/ExamCard.tsx`
- `certifai-app/src/swr/exams.ts` (if polling conditions require adjustment)
- related typing files

### Acceptance tests (exact)

1. **Immediate-start UX test**
   - During early-ready window, UI shows start/resume action enabled.
   - Pass criteria: user can navigate into exam before generation reaches 100%.

2. **Progress continuity test**
   - Enter exam right after first batch.
   - Pass criteria: visible question list starts with earliest created questions; additional questions appear as generated.

3. **Polling-stop condition test**
   - Once `is_generating_completed=true`, polling cadence reduces/stops per hook rules.
   - Pass criteria: no unnecessary high-frequency polling after completion.

---

## Phase 7 — Observability, Backfill, and Rollback Hardening

### Goal

Ensure production safety with metrics, alerts, and reversible rollout.

### Implementation

1. Metrics dashboard:
   - time-to-first-ready
   - time-to-generation-complete
   - early-ready success rate
   - status transition anomalies
2. Alerting:
   - stuck `READY` with no counter growth for threshold window
   - mismatch between counter values and linked answer count
3. Rollback:
   - flip feature flag off to restore old semantics.
   - keep schema additions (non-breaking).

### Acceptance tests (exact)

1. **Canary rollout test**
   - Enable feature flag for subset environment/users.
   - Pass criteria: no increase in 5xx, no status deadlocks, successful exam completions unchanged.

2. **Rollback test**
   - Disable flag mid-run for new creations.
   - Pass criteria: new exams follow legacy final-ready semantics without code deploy.

---

## Exact API/State Acceptance Matrix

| Scenario                                                   | Expected `exam_status` | Expected `is_generating_completed` | Notes                         |
| ---------------------------------------------------------- | ---------------------- | ---------------------------------- | ----------------------------- |
| Exam just created, no questions linked                     | `QUESTIONS_GENERATING` | `false`                            | Not playable                  |
| First batch linked (>=1 question), more remaining          | `READY`                | `false`                            | Playable now                  |
| User answers first question before completion              | `READY`                | `false`                            | Must remain READY             |
| All questions generated, no answer selected yet            | `READY`                | `true`                             | Playable, not in-progress yet |
| All generated + at least 1 answer selected + not submitted | `IN_PROGRESS`          | `true`                             | New strict transition         |
| Submitted                                                  | `COMPLETED`            | `true`                             | Terminal                      |

---

## Rollback Plan

1. Set `EXAM_EARLY_READY_ENABLED=false`.
2. Keep progressive counters but stop early status transition.
3. Verify creation flow returns to final-batch `READY` behavior.
4. Keep metrics active for 24h post-rollback observation.

---

## Open Questions for Review

1. Should partially generated exams allow submit before generation completes?
2. If generation ends with fewer than target due to hard failures, should `is_generating_completed=true` still be set with partial count and warning?
3. Should `READY` + incomplete generation have a dedicated frontend badge copy (e.g., “Ready (more questions loading)”) or keep existing label?

---

## Important Note on Frontend Changes

Whenever frontend changes are required due to API modifications, do not implement them directly in the frontend app. Instead, generate phased plans with context in `260508-exam-availability-ux.md` within the app repository. Frontend implementation will be deferred until the API changes are fully completed and verified.

---

## Implementation Order Recommendation

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7

No coding should begin until this document is approved by API + frontend owners.
