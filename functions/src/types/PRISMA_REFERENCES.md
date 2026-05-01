# Prisma Type References

This document maps TypeScript type definitions to Prisma schema sources.
Use it to quickly detect drift after schema migrations.

Last updated: 2026-05-02

## Enums

| TS Enum             | Prisma Schema File | Line | Last Verified | Status |
| ------------------- | ------------------ | ---- | ------------- | ------ |
| `CertificationStatus` | `prisma/schema.prisma` | 18 | 2026-05-02 | ✅ In Sync |
| `ExamStatus`          | `prisma/schema.prisma` | 28 | 2026-05-02 | ✅ In Sync |
| `DifficultyLevel`     | `prisma/schema.prisma` | 37 | 2026-05-02 | ✅ In Sync |

## Models (Re-exported in `src/types/prisma.ts`)

| TS Type              | Prisma Model         | Schema Line | Fields Count | Last Verified |
| -------------------- | -------------------- | ----------- | ------------ | ------------- |
| `Firm`               | `Firm`               | 43          | 9            | 2026-05-02    |
| `Certification`      | `Certification`      | 59          | 12           | 2026-05-02    |
| `User`               | `User`               | 81          | 8            | 2026-05-02    |
| `UserCertification`  | `UserCertification`  | 96          | 7            | 2026-05-02    |
| `QuizQuestion`       | `QuizQuestion`       | 112         | 13           | 2026-05-02    |
| `AnswerOption`       | `AnswerOption`       | 134         | 7            | 2026-05-02    |
| `ExamAttempt`        | `ExamAttempt`        | 149         | 14           | 2026-05-02    |
| `ExamUserAnswer`     | `ExamUserAnswer`     | 170         | 8            | 2026-05-02    |

## Drift Detection Checklist

When `functions/prisma/schema.prisma` changes:

1. Update `src/types/enums.ts` when enum values change.
2. Update `src/types/prisma.ts` if model names change or are added/removed.
3. Re-verify line numbers and field counts in this file.
4. Search for impacted endpoint/service response contracts and document breaking changes in:
   - `certifai-api/docs/plans/type-enforcement.md`
   - `certifai-app/docs/plans/type-enforce.md` (if frontend impact exists)
