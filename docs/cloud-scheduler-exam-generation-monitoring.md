# Cloud Scheduler Functions: Exam Generation Monitoring

This document describes the expected results and behaviors when running the following scheduled functions in the certifai-api backend:

- `collectExamGenerationMetrics`
- `dailyExamGenerationReport`
- `automatedStuckExamCleanup`
- `autoFailStuckExams`

---

## 1. collectExamGenerationMetrics

**Purpose:**

- Aggregates and records metrics related to exam generation (e.g., number of exams generated, average generation time, error rates).

**Expected Results:**

- Metrics are written to the monitoring database or logging system.
- Useful for dashboarding and performance analysis.
- No direct user-facing output.
- Errors are logged for investigation.

---

## 2. dailyExamGenerationReport

**Purpose:**

- Generates a daily summary report of exam generation activities.

**Expected Results:**

- A report (e.g., JSON, CSV, or email) is generated and stored or sent to admins/monitoring channels.
- Includes statistics such as total exams generated, success/failure rates, and notable incidents.
- Errors are logged; report generation failures are notified to maintainers.

---

## 3. automatedStuckExamCleanup

**Purpose:**

- Identifies and cleans up exam generation jobs that are stuck (e.g., jobs that have not completed within a threshold time).

**Expected Results:**

- Stuck jobs are marked as cleaned up or removed from the queue.
- Related resources (e.g., temp files, DB entries) are released or deleted.
- Cleanup actions are logged for audit.
- No user-facing output, but may affect user experience by freeing up system resources.

---

## 4. autoFailStuckExams

**Purpose:**

- Automatically marks stuck exam generation jobs as failed after a certain timeout.

**Expected Results:**

- Stuck jobs are updated in the database with a failed status and appropriate error message.
- Users may see their exam generation marked as failed in the UI, with a prompt to retry.
- All actions are logged for traceability.

---

## Monitoring & Error Handling

- All functions use structured logging (Firebase Functions logger).
- Failures are reported to monitoring dashboards or alerting systems.
- No direct user notification unless a job they initiated is affected (e.g., auto-failed exam).

## Audit & Compliance

- All actions are auditable via logs.
- Reports and metrics are retained for performance and compliance reviews.

---

For more details, see the implementation in `functions/src/scheduledFunctions/examGenerationMonitoring.ts`.
