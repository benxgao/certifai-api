# Certifai API Database Design (Current Implementation)

This document is an **AI-assistant-first** data map of how storage is used in `certifai-api` today.

Goal: help any assistant quickly understand the current data model and start data-design work without re-scanning the whole repo.

---

## 1) Storage overview (what is used for what)

- **PostgreSQL via Prisma** (`functions/prisma/schema.prisma`)
  - Source of truth for core product entities: users, certifications, exams, questions, answers.
- **Firestore**
  - Stores document-style analytics and billing/account sync data:
    - exam reports, certification summaries, knowledge pooling, Stripe account projection.
- **Firebase RTDB**
  - Stores real-time exam generation plan/progress structures (primary path: `exam_plans/{exam_id}`).

---

## 2) Prisma / PostgreSQL schema

Authoritative file: `functions/prisma/schema.prisma`

### Enums

#### `CertificationStatus`

- `PASSED`, `IN_PROGRESS`, `INTERESTED`, `DELETING`, `NOT_STARTED`, `EXPIRED`, `SUSPENDED`

#### `ExamStatus`

- `PENDING_QUESTIONS`, `QUESTIONS_GENERATING`, `READY`, `IN_PROGRESS`, `COMPLETED`, `QUESTION_GENERATION_FAILED`

#### `DifficultyLevel`

- `EASY`, `ADVANCED`, `EXPERT`

### Tables (models)

### `Firm`

Purpose: certification provider/vendor metadata.

| Field         | Type                   | Description                |
| ------------- | ---------------------- | -------------------------- |
| `firm_id`     | `Int` PK autoincrement | Internal firm ID           |
| `name`        | `String` unique        | Firm display name          |
| `code`        | `String` unique        | Short code (e.g., AWS/GCP) |
| `description` | `String?`              | Optional description       |
| `website_url` | `String?`              | Optional website           |
| `logo_url`    | `String?`              | Optional logo URL          |
| `created_at`  | `DateTime`             | Create timestamp           |
| `updated_at`  | `DateTime`             | Auto-updated timestamp     |

Relations:

- 1:N with `Certification` via `firm_id`.

---

### `Certification`

Purpose: certification catalog record.

| Field             | Type                   | Description                  |
| ----------------- | ---------------------- | ---------------------------- |
| `cert_id`         | `Int` PK autoincrement | Internal certification ID    |
| `firm_id`         | `Int` FK               | Owner firm (`Firm.firm_id`)  |
| `name`            | `String`               | Certification name           |
| `slug`            | `String` unique        | URL/identifier slug          |
| `exam_guide_url`  | `String?`              | Optional reference guide URL |
| `min_quiz_counts` | `Int`                  | Minimum question count       |
| `max_quiz_counts` | `Int`                  | Maximum question count       |
| `pass_score`      | `Float`                | Passing threshold            |

Relations:

- N:1 `Firm`
- 1:N `QuizQuestion`
- 1:N `ExamAttempt`
- 1:N `UserCertification`

---

### `User`

Purpose: core API user account.

| Field              | Type                | Description            |
| ------------------ | ------------------- | ---------------------- |
| `user_id`          | `String` PK uuid    | Internal API user ID   |
| `firebase_user_id` | `String?` unique    | Firebase Auth UID link |
| `credit_tokens`    | `Int` default `300` | Credit token balance   |
| `energy_tokens`    | `Int` default `0`   | Energy token balance   |
| `created_at`       | `DateTime`          | Create timestamp       |
| `updated_at`       | `DateTime`          | Update timestamp       |

Relations:

- 1:N `ExamAttempt`
- 1:N `UserCertification`

---

### `UserCertification`

Purpose: user ↔ certification registration/status join.

| Field         | Type                  | Description                 |
| ------------- | --------------------- | --------------------------- |
| `user_id`     | `String` FK           | User ID                     |
| `cert_id`     | `Int` FK              | Certification ID            |
| `status`      | `CertificationStatus` | Current cert progress state |
| `assigned_at` | `DateTime`            | Registration timestamp      |
| `updated_at`  | `DateTime`            | Auto-updated timestamp      |

Keys:

- Composite PK: `@@id([user_id, cert_id])`

---

### `QuizQuestion`

Purpose: generated question bank items.

| Field              | Type              | Description                                    |
| ------------------ | ----------------- | ---------------------------------------------- |
| `quiz_question_id` | `String` PK uuid  | Question ID                                    |
| `cert_id`          | `Int` FK          | Certification ID                               |
| `generated_from`   | `String?` FK-like | Source exam attempt ID (`ExamAttempt.exam_id`) |
| `difficulty`       | `DifficultyLevel` | Difficulty label                               |
| `question_text`    | `String`          | Question prompt                                |
| `explanations`     | `String?`         | Explanation text                               |
| `exam_topic`       | `String?`         | Topic label                                    |
| `created_at`       | `DateTime`        | Create timestamp                               |
| `is_deprecated`    | `Boolean`         | Soft deprecation flag                          |

Relations:

- N:1 `Certification`
- 1:N `AnswerOption`
- 1:N `ExamUserAnswer`
- N:1 optional to `ExamAttempt` via named relation `GeneratedQuestions`

---

### `AnswerOption`

Purpose: options for each quiz question.

| Field              | Type             | Description         |
| ------------------ | ---------------- | ------------------- |
| `option_id`        | `String` PK uuid | Option ID           |
| `quiz_question_id` | `String` FK      | Parent question ID  |
| `option_text`      | `String`         | Option content      |
| `is_correct`       | `Boolean`        | Correct answer flag |
| `created_at`       | `DateTime`       | Create timestamp    |

Relations:

- N:1 `QuizQuestion`
- 1:N `ExamUserAnswer` (selected option)

---

### `ExamAttempt`

Purpose: user exam session header.

| Field                | Type               | Description              |
| -------------------- | ------------------ | ------------------------ |
| `exam_id`            | `String` PK uuid   | Exam attempt ID          |
| `user_id`            | `String` FK        | User owner               |
| `cert_id`            | `Int` FK           | Certification            |
| `exam_status`        | `ExamStatus`       | Exam lifecycle state     |
| `total_questions`    | `Int?`             | Planned question count   |
| `score`              | `Float?`           | Final score              |
| `token_cost`         | `Int` default `60` | Token cost for exam      |
| `custom_prompt_text` | `String?`          | Custom generation prompt |
| `started_at`         | `DateTime`         | Start timestamp          |
| `submitted_at`       | `DateTime?`        | Submission timestamp     |

Relations:

- N:1 `User`
- N:1 `Certification`
- 1:N `ExamUserAnswer`
- 1:N generated `QuizQuestion[]` via relation `GeneratedQuestions`

---

### `ExamUserAnswer`

Purpose: per-question answer record inside an exam.

| Field                | Type             | Description        |
| -------------------- | ---------------- | ------------------ |
| `user_answer_id`     | `String` PK uuid | Answer row ID      |
| `exam_id`            | `String` FK      | Exam attempt ID    |
| `quiz_question_id`   | `String` FK      | Question ID        |
| `selected_option_id` | `String?` FK     | Selected option ID |
| `is_correct`         | `Boolean?`       | Scoring result     |

Constraints:

- Unique per exam/question: `@@unique([exam_id, quiz_question_id])`

---

## 3) Firestore data model (currently used)

Primary service files:

- `functions/src/services/firebase/examReportFirestore.ts`
- `functions/src/services/firebase/certSummaryFirestore.ts`
- `functions/src/services/firestore/examKnowledgePoolingFirestoreService.ts`
- `functions/src/endpoints/stripe/db/*.ts`

### Collection: `accounts`

Document ID: `api_user_id`

Used by Stripe webhook sync and billing reads.

#### Core fields

| Field                         | Type       | Description                          |
| ----------------------------- | ---------- | ------------------------------------ |
| `api_user_id`                 | `string`   | API user ID (doc id mirror)          |
| `firebase_user_id`            | `string`   | Firebase UID                         |
| `email`                       | `string`   | User email                           |
| `stripe_customer_id`          | `string?`  | Stripe customer reference            |
| `stripe_subscription_id`      | `string?`  | Current/latest subscription ID       |
| `stripe_subscription_status`  | `string?`  | Subscription status                  |
| `stripe_current_period_start` | `number?`  | Billing period start (epoch seconds) |
| `stripe_current_period_end`   | `number?`  | Billing period end (epoch seconds)   |
| `stripe_cancel_at_period_end` | `boolean?` | Cancellation-at-period-end flag      |
| `created_at`                  | `string`   | ISO timestamp                        |
| `updated_at`                  | `string`   | ISO timestamp                        |

Notes:

- This collection intentionally stores **minimal projection data**, not full Stripe payloads.

---

### Nested collection: `users/{user_id}/certs/{cert_id}/exam_reports/{exam_id}`

Purpose: structured exam report history per user/cert.

#### Key fields (report payload)

| Field                     | Type                 | Description                |
| ------------------------- | -------------------- | -------------------------- |
| `exam_id`                 | `string`             | Exam ID (also doc id)      |
| `user_id`                 | `string`             | Owner user ID              |
| `certification_name`      | `string`             | Certification label        |
| `overall_score`           | `number`             | Score (0–100)              |
| `total_questions`         | `number`             | Total questions in exam    |
| `correct_answers`         | `number`             | Correct answer count       |
| `topic_performance`       | `TopicPerformance[]` | Per-topic breakdown        |
| `generated_at`            | `string`             | ISO report timestamp       |
| `text_summary`            | `string`             | Human-readable summary     |
| `createdAt` / `updatedAt` | `Date`               | Firestore write timestamps |

`topic_performance[]` item fields:

- `topic`, `correct_answers`, `total_attempts`, `accuracy_rate`, `difficulty_level`, `performance_category`

---

### Nested document: `users/{user_id}/certs/{cert_id}/summaries/cert_summary`

Purpose: aggregated certification-level summary over multiple exam reports.

#### Key fields

| Field                      | Type                                 | Description                |
| -------------------------- | ------------------------------------ | -------------------------- |
| `cert_id`                  | `string`                             | Certification ID           |
| `user_id`                  | `string`                             | Owner user ID              |
| `certification_name`       | `string`                             | Certification label        |
| `total_exams_taken`        | `number`                             | Number of exams considered |
| `average_score`            | `number`                             | Mean score                 |
| `best_score`               | `number`                             | Best score                 |
| `worst_score`              | `number`                             | Worst score                |
| `total_questions_answered` | `number`                             | Aggregate answered count   |
| `total_correct_answers`    | `number`                             | Aggregate correct count    |
| `overall_accuracy_rate`    | `number`                             | Global accuracy ratio      |
| `topic_mastery`            | `TopicMastery[]`                     | Topic mastery aggregates   |
| `performance_trend`        | `'improving'\|'declining'\|'stable'` | Trend label                |
| `strengths`                | `string[]`                           | Strong topics              |
| `areas_for_improvement`    | `string[]`                           | Weak topics                |
| `generated_at`             | `string`                             | ISO generation time        |
| `ai_summary`               | `string`                             | AI-generated summary text  |
| `createdAt` / `updatedAt`  | `Date`                               | Firestore write timestamps |

---

### Nested document field: `users/{api_user_id}/certs/{cert_id}` → `knowledge_pooling`

Purpose: consolidated knowledge insights derived from incorrect answers.

`knowledge_pooling` object fields:

| Field                | Type                 | Description               |
| -------------------- | -------------------- | ------------------------- |
| `knowledge_insights` | `KnowledgeInsight[]` | Deduplicated insight list |
| `last_updated`       | `string`             | ISO timestamp             |
| `cert_id`            | `number`             | Certification ID          |
| `certification_name` | `string`             | Certification label       |

`knowledge_insights[]` item fields:

- `insight_id`, `insight`, `topic`, `exam_id`, `generated_at`

---

### Firestore paths seen but not core business schema

- `users/{user_id}` delete path appears in `deleteUser.ts` cleanup logic.
- `COLLECTIONS` in `services/firebase/firestore.ts` (`users`, `certifications`, `exams`, etc.) is generic helper/example and not the primary typed business schema.

---

## 4) RTDB data model (currently used)

Primary service files:

- `functions/src/services/genkit/examPlanner.ts`
- `functions/src/delegators/tasks/buildExam/rtdb.ts`
- `functions/src/endpoints/api/users/exams/getExamLiveStatus.ts`

### Path: `exam_plans/{exam_id}` (active source of truth)

Purpose:

- Real-time exam generation plan + assignment status.
- Used to calculate generation progress and question readiness.

#### Base structure

| Field            | Type                 | Description                                   |
| ---------------- | -------------------- | --------------------------------------------- |
| `questions`      | `ExamPlanQuestion[]` | Planned topics and generated question mapping |
| `cert_id`        | `string`             | Certification ID                              |
| `user_id`        | `string`             | User owner ID                                 |
| `created_at`     | `number`             | Epoch seconds, plan creation time             |
| `customPrompt`   | `string?`            | Optional custom prompt                        |
| `lastExamReport` | `string?`            | Optional prior report context                 |
| `updated_at`     | `number?`            | Epoch seconds, updated during generation      |

`questions[]` item fields:

- `exam_topic: string`
- `question_id: string | null` (null until linked/generated)

---

### Path: `exam_progress/{exam_id}` (deprecated)

Status:

- Kept for backward compatibility/rollback comments; **progress now derives from `exam_plans/{exam_id}`**.

Legacy shape:

- `current_batch`, `total_batches`, `questions_generated`, `target_questions?`, `completion_percentage`, `updated_at`

---

## 5) Cross-store data linkage map

Use this when designing joins and migrations:

- `User.user_id` (Prisma) ↔ Firestore path segment `users/{user_id}`
- `Certification.cert_id` (Prisma Int) ↔ Firestore/RTDB path segment `{cert_id}` (often stringified in path)
- `ExamAttempt.exam_id` (Prisma) ↔
  - RTDB `exam_plans/{exam_id}`
  - Firestore `.../exam_reports/{exam_id}`
- Stripe projection uses Firestore `accounts/{api_user_id}` with `stripe_*` reference fields.

---

## 6) Practical guidance for AI assistants

When implementing data changes:

1. **Start with Prisma schema** for relational truth and enum rules.
2. For exam generation/progress work, inspect **RTDB `exam_plans/{exam_id}`** first.
3. For analytics/report features, inspect Firestore under
   - `users/{user_id}/certs/{cert_id}/exam_reports/*`
   - `users/{user_id}/certs/{cert_id}/summaries/cert_summary`
   - `users/{user_id}/certs/{cert_id}` → `knowledge_pooling`
4. For billing/subscription features, use Firestore `accounts/{api_user_id}` and treat it as minimal Stripe projection.

---

## 7) Source files (verification anchors)

- Prisma schema: `functions/prisma/schema.prisma`
- RTDB types: `functions/src/types/genkit.ts`
- RTDB operations: `functions/src/services/firebase/rtdb.ts`
- Exam plan RTDB operations: `functions/src/delegators/tasks/buildExam/rtdb.ts`
- Live status progress read: `functions/src/endpoints/api/users/exams/getExamLiveStatus.ts`
- Exam reports Firestore: `functions/src/services/firebase/examReportFirestore.ts`
- Cert summary Firestore: `functions/src/services/firebase/certSummaryFirestore.ts`
- Knowledge pooling Firestore: `functions/src/services/firestore/examKnowledgePoolingFirestoreService.ts`
- Stripe Firestore projection: `functions/src/endpoints/stripe/db/types.ts`, `functions/src/endpoints/stripe/db/account.ts`
