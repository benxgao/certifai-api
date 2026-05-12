# Certifai API — Data Structure & PII Compliance Scan Report

**Date:** 2026-05-13  
**Scope:** `certifai-api` backend storage surfaces (Prisma/Postgres, Firestore, RTDB) and deletion/logging/rules patterns.

---

## Executive summary

Static scan found **3 critical/high-risk issues** and several medium-risk design/compliance weaknesses.

- Critical risks are mostly around **PII exposure and retention**:
  1. Over-broad Firestore read permissions for Stripe documents.
  2. Account deletion path misses Stripe Firestore account projection (`accounts/{api_user_id}`), causing PII residue.
  3. Debug logging emits full Stripe/enriched account payloads to logs.

If unaddressed, these can violate least-privilege and data minimization/retention requirements.

---

## Method used

- Reviewed storage architecture and live schema docs:  
  `docs/architecture/database-design.md`
- Reviewed authoritative schema/rules/services:
  - `functions/prisma/schema.prisma`
  - `firestore.rules`
  - `database.rules.json`
  - `functions/src/endpoints/api/users/deleteUser.ts`
  - `functions/src/endpoints/stripe/**/*.ts`
  - `functions/src/services/firebase/*.ts`
- Checked repo tracking status for secret artifacts via git file listing.

---

## Findings (severity-ranked)

## 1) CRITICAL — Firestore rule allows broad authenticated reads on Stripe collections

**Evidence**

- `firestore.rules`:
  - `match /stripe_subscriptions/{subscriptionId}` → `allow read: if request.auth != null;`
  - `match /stripe_invoices/{invoiceId}` → `allow read: if request.auth != null;`

**Why this is critical**

- Any authenticated user can read any subscription/invoice doc in those collections.
- Violates tenant isolation and least privilege for financial metadata.

**Recommended fix**

- Restrict by ownership claims, e.g. verify document owner UID/customer mapping.
- Prefer server-only writes/reads for billing collections where possible.
- Add rule unit tests for cross-user access denial.

---

## 2) CRITICAL — User deletion flow does not delete Firestore `accounts/{api_user_id}` PII projection

**Evidence**

- `functions/src/endpoints/api/users/deleteUser.ts`
  - `deleteUserFirestoreAccount()` deletes `collectionPath: 'users'` doc only.
  - No deletion of `accounts/{api_user_id}` where email/Stripe IDs are stored.
- Stripe account data location:
  - `functions/src/endpoints/stripe/db/account.ts` (`ACCOUNTS_COLLECTION = 'accounts'`)
  - Stored fields include: `email`, `stripe_customer_id`, `stripe_subscription_id`, etc.

**Why this is critical**

- “Delete account” can leave billing-linked PII behind.
- Violates expected data deletion semantics and may violate compliance retention obligations.

**Recommended fix**

- In user deletion flow, delete `accounts/{api_user_id}` in Firestore.
- Add post-delete verification for all PII stores (Prisma + Firestore + RTDB + Auth).
- Add integration test: delete user -> assert account doc no longer exists.

---

## 3) HIGH — Sensitive over-logging of Stripe payloads and enriched account objects

**Evidence**

- `functions/src/endpoints/stripe/snapshotWebhooks/handlers/subscription.ts`
  - Logs full subscription JSON via `JSON.stringify(subscription, null, 2)`.
- `functions/src/endpoints/stripe/db/sync.ts`
  - Logs full subscription JSON (`DEBUG_PERIOD_START`)
  - Logs full `enrichedAccount` JSON (`DEBUG_PERIOD: getEnrichedAccountData`)
- Multiple handlers also log raw email addresses in success/error logs.

**Why this is high risk**

- Logs become secondary PII store and often have broader retention/access.
- Full Stripe payloads may include metadata fields not required for operational logging.

**Recommended fix**

- Replace raw object logging with explicit allowlisted fields.
- Mask email (`a***@domain.com`) and identifiers where possible.
- Disable debug payload logs in production with environment guard.
- Define a centralized log redaction policy.

---

## 4) MEDIUM — Inconsistent `cert_id` typing across Firestore models

**Evidence**

- `functions/src/services/firebase/certSummaryFirestore.ts`: `cert_id: string`
- `functions/src/services/firestore/examKnowledgePoolingFirestoreService.ts`: `cert_id: number`

**Why this matters**

- Type inconsistency increases migration/query mismatch risk.
- Can create subtle bugs in analytics joins and filtering.

**Recommended fix**

- Standardize Firestore `cert_id` representation (prefer one type globally).
- Add serialization helpers at boundaries.

---

## 5) MEDIUM — `User.updated_at` is not auto-maintained in Prisma schema

**Evidence**

- `functions/prisma/schema.prisma`:
  - `User.updated_at DateTime @default(now())` (no `@updatedAt`)

**Why this matters**

- Audit/change tracking on user records can become stale.
- Weakens forensic and compliance evidence quality for account changes.

**Recommended fix**

- Change to `updated_at DateTime @updatedAt` (with safe migration review).

---

## 6) LOW/MEDIUM — Local credential artifact exists in workspace (not tracked by git)

**Evidence**

- File exists: `functions/gcp_credentials.json`
- `.gitignore` excludes `**/*/gcp_credentials.json`
- Git tracked-file scan did **not** list `gcp_credentials.json`.

**Why this matters**

- Good that it is ignored, but local plaintext credentials remain operational risk.

**Recommended fix**

- Keep secrets only in secret managers / env injection.
- Add CI secret scanning + pre-commit checks.

---

## Positive controls observed

- RTDB rules deny all by default:
  - `database.rules.json` -> `".read": false`, `".write": false`
- Firestore has deny-all fallback rule:
  - `match /{document=**} { allow read, write: if false; }`
- Credential file pattern appears in `.gitignore`, reducing accidental commits.

---

## Priority remediation plan (recommended)

1. **Immediate (P0)**
   - Tighten Firestore billing read rules (`stripe_subscriptions`, `stripe_invoices`).
   - Patch account deletion flow to remove `accounts/{api_user_id}` docs.
2. **Short-term (P1)**
   - Remove/mask raw Stripe and email logs; add logging allowlist/redaction.
3. **Near-term (P2)**
   - Normalize `cert_id` types across Firestore schemas.
   - Fix Prisma `User.updated_at` with migration.
4. **Ongoing (P3)**
   - Add automated compliance checks: rules tests, deletion E2E verification, secret scan gates.

---

## Final risk posture

- **Current posture:** Elevated risk due to at least two concrete compliance-critical defects and one high logging exposure pattern.
- **After P0/P1 fixes:** Risk should drop significantly, with residual medium risk around schema consistency/auditability.
