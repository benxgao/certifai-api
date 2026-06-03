# Product Plan: Cached Questions for Instant Demo + Faster Exam Start

## ROI-First rollout to improve conversion, speed, and AI unit economics

---

**Version:** 1.2 (Revised)
**Date:** June 5, 2026  
**Status:** Draft with resolved implementation decisions  
**Audience:** Product, Marketing, Engineering, Leadership, Customer Success

---

## 1. Why this initiative now

We have a clear growth and efficiency opportunity:

- **Top-of-funnel friction is high**: visitors cannot instantly try product value.
- **Exam generation wait time is long**: users wait before seeing question 1.
- **AI cost scales linearly**: repeated generation for popular certifications increases cost.

This initiative introduces reusable cached question pools so we can ship a fast “try now” journey first, then extend to registered exam creation.

This is also a **marketing-integration feature**: trial traffic should flow naturally into signup with a clear value gate (score now, detailed explanations after registration).

**Expected business result** (if phased correctly):

- Faster demo experience (near-instant first question)
- Better demo-to-signup conversion
- Lower AI cost per completed exam
- Improved reliability under traffic spikes

---

## 2. Scope and product decisions (ROI-first)

### In scope (MVP + near-term)

1. **Public Demo Pool (MVP, highest ROI)**
   - 10 pre-generated questions per high-traffic certification page.
   - No login required.
   - Primary conversion CTA appears immediately after question 10.
   - Trial session returns final score immediately.
   - Show a short explanation preview (1-line hint), while keeping full rationale locked.
   - Detailed explanation/rationale is locked and shown only after signup.
   - Read-only demo session with CTA to register.

2. **Registered Shared Starter Pool (Phase 2)**
   - First N questions (start with 10) from shared cache at exam creation.
   - Remaining questions generated with existing async pipeline.

3. **Freshness + fallback rules**
   - Rotate `DEMO_PUBLIC` trial datasets every 90 days across all certifications.
   - If cache is empty or stale on public pages, return an empty/unavailable state (no on-demand generation in MVP).

### Out of scope (for now)

- Per-user personalization in cached segment.
- Dynamic difficulty adaptation inside shared pool.
- Complex recommendation logic for pool sizing.

Keeping these out of MVP protects time-to-market.

### Trial-to-signup conversion policy (explicit)

- Visitors can complete a trial set and see: score, percentile band (optional), and pass/fail indicator.
- Show a short explanation preview line to guide users without exposing full rationale.
- Visitors cannot see detailed explanation/rationale until they create an account.
- After signup, trial data can be linked to the new user profile and unlocked in-app.
- Apply trial usage caps per device/IP/day before requiring signup.

---

## 3. Proposed architecture fit with current stack

This plan intentionally reuses existing `certifai-api` architecture:

- **API layer:** add endpoints under current REST conventions (`functions/src/endpoints/api/`).
- **Service layer:** orchestrate via existing services (`genkit`, `cloudTasks`, `prisma`, `redis`, `cache`).
- **Generation pipeline:** reuse current exam-generation flow and queue patterns for pre-generation jobs.
- **Caching + storage:** use centralized Redis patterns (`RedisService`, `CacheManager`, standardized key prefixes/TTL), with Firestore as source of truth for trial datasets and PostgreSQL as source of truth for registered datasets.
- **Frontend:** integrate in `certifai-app` public pages using existing SWR/API envelope patterns.
- **Data isolation:** keep trial datasets logically isolated from registered datasets, with controlled linkage only after successful account creation.

### Recommended high-level flow

1. Nightly scheduled job pre-generates pool items for selected certifications.
2. Questions are stored with metadata (certification, pool type, freshness window, generation version).
3. Public page fetches demo pool via public endpoint.
4. Exam creation endpoint optionally hydrates first N questions from registered shared pool.
5. Existing generation workflow fills remaining questions asynchronously.

**MVP operating assumptions:** global pool distribution first (no regional partitioning), no anti-replay controls for demo submission, and no dedicated anti-scraping layer in MVP beyond standard platform protections.

### Trial-domain isolation principle

- Introduce trial-scoped entities (e.g., `trialUser`, `trialExam`, `trialExamAnswer`, `trialAttribution`) in isolated storage boundaries.
- Do not write anonymous trial activity directly into registered-user exam tables.
- Provide a one-way linking flow to attach trial history to a new registered user record after signup verification.
- Preserve audit metadata for attribution (`campaign`, `landing_page`, `utm_*`, `referrer`).

---

## 4. Data and contract design suggestions (simple + maintainable)

### Pool types

- `DEMO_PUBLIC`
- `REGISTERED_SHARED`

### Minimum metadata per cached question set

- `certification_id`
- `pool_type`
- `question_ids` (or embedded payload reference)
- `generated_at`
- `expires_at`
- `generation_model`
- `prompt_version`
- `quality_score` (optional for MVP, recommended soon after)
- `is_active`

### API contract recommendations

- Keep response envelope: `{ success, data, meta? }`
- Public endpoint example intent: “get demo questions for cert”
- Internal endpoint or service method for “fetch starter pool for exam creation”
- Always include `cache_hit` in metadata for observability

### Trial entities and linking model (recommended)

- `trialUser`
  - anonymous identifier (cookie/device/session-based)
  - attribution metadata (`utm_source`, `utm_campaign`, etc.)
  - lifecycle status (`ANONYMOUS`, `LINKED`, `EXPIRED`)
  - trial lifecycle expiry set to 90 days
- `trialExam`
  - belongs to `trialUser`
  - certification reference + question set reference
  - score summary fields (score %, total correct, completed_at)
  - explanation access flag (`LOCKED` until linked signup)
- `trialExamAnswer`
  - trial answer records separated from registered answer records
- `trialUserLink`
  - mapping between `trialUser` and registered `user_id`
  - created after signup/auth verification

**Isolation rule:** trial tables/collections should be separated from current registered datasets as much as possible to reduce coupling, simplify retention rules, and avoid accidental cross-tenant leakage.

**Linking rule:** upon signup, create a linkage record and optional migration projection (not hard move required in MVP).

---

## 5. Rollout plan (fast go-to-market)

### Phase 0 (Week 1): foundations that prevent rework

- Define pool schema + key naming + TTL policy.
- Set trial dataset rotation/expiry to 90 days for all certifications.
- Add basic observability fields (`cache_hit`, `pool_age_hours`, `fallback_reason`).
- Add feature flags:
  - `public_demo_cache_enabled`
  - `registered_starter_cache_enabled`

**Exit criteria**

- Can read/write a demo pool for one certification.
- Can measure hit/miss/fallback with logs/metrics.

### Phase 1 (Weeks 1-2): public demo cache only (highest ROI)

- Launch on top 3-5 highest-traffic certification pages first.
- Keep static pool size (10) and simple nightly refresh.
- Add strict fallback: if no valid pool, return a friendly unavailable state.

**Exit criteria**

- First-question latency for demo <$1s p50 (target).
- Demo completion and CTA click metrics flowing.

### Phase 2 (Weeks 3-4): registered starter cache (controlled rollout)

- Serve first 10 questions from `REGISTERED_SHARED` pool.
- Generate remaining questions through existing async pipeline.
- Gradual release: 10% → 50% → 100% via feature flag.

**Exit criteria**

- Exam start latency reduced materially (target <3s for cached segment).
- AI token usage per exam decreases vs baseline.

### Phase 3 (Week 5+): optimization, not complexity

- Expand cert coverage.
- Tune pool size by demand tiers (e.g., 10/20/30).
- Add smarter refresh for high-consumption pools only.

---

## 6. Maintainability and reuse recommendations

1. **Reuse service boundaries**
   - Keep endpoint handlers thin.
   - Put cache selection/fallback logic in a dedicated domain service (e.g., exam pool service), not in controllers.

2. **Single source for key naming + TTL**
   - Extend existing cache config; avoid ad-hoc keys in handlers.

3. **Version prompt and generation strategy**
   - Store `prompt_version` and `model_version` on every pool item for debugging and rollback.

4. **Idempotent pre-generation jobs**
   - Job reruns should not duplicate active pools; use upsert/versioning semantics.

5. **Feature-flag all rollout steps**
   - Enable instant rollback without redeploy.

6. **Test strategy that matches risk**
   - Unit tests: pool selection + fallback logic.
   - Integration tests: endpoint contracts and cache miss behavior.
   - E2E (frontend): public demo journey + CTA tracking.

7. **Operational playbook**
   - Dashboard for freshness, hit rate, miss reasons, and token savings.
   - Alert on low pool coverage for top certifications.

8. **Strict data-domain boundaries**
   - Keep `trial*` domain logic and repositories separated from registered exam domain services.
   - Share only minimal interfaces (e.g., question payload contract, scoring utility, linking API).

---

## 7. KPI framework (ROI and execution)

### Mandatory attribution events (ROI baseline)

- `demo_started`
- `demo_completed`
- `signup_clicked`
- `trial_user_linked_to_registered_user`

### Primary KPIs

- **Demo-to-signup conversion rate** (target uplift vs baseline)
- **Time-to-first-question** for public demo and registered exam
- **AI cost per exam** and total token consumption trend

### Supporting KPIs

- Cache hit rate by pool type
- Fallback rate and top fallback reasons
- Pool freshness compliance (% within TTL)
- Demo completion rate

### Guardrail metrics

- Question quality rating / complaint rate
- Public endpoint abuse rate
- Error rate for demo and exam creation endpoints
- Trial-to-registered linkage success rate

---

## 8. Risks and mitigations

| Risk                                   | Why it matters                                       | Mitigation                                                                              |
| -------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Stale/over-exposed questions           | Reduced learning value, possible SEO/content leakage | TTL + rotation + multiple variants per cert                                             |
| Cache miss spikes                      | Demo latency regression                              | Graceful fallback + pool coverage alerting                                              |
| Poor question quality in pooled set    | Damages trust early in funnel                        | Light QA gate + quality sampling job                                                    |
| Added complexity in exam creation path | Maintenance burden                                   | Keep cached segment optional behind feature flag                                        |
| Public scraping/abuse                  | Cost and content leakage                             | Accept MVP risk initially; monitor traffic and add controls in next iteration if needed |

---

## 9. Recommended implementation order (what to ship first)

1. **Ship public demo pool for top certifications first** (fastest revenue impact).
2. Add analytics + attribution so conversion impact is provable.
3. Add registered shared starter pool behind flag.
4. Scale breadth only after unit economics and quality are validated.

If speed is the priority, avoid overbuilding personalization in cached questions during first release.

---

## 10. Definition of done for initial launch

- Public demo cache live on selected certification landing pages.
- Median demo first-question latency is near-instant.
- End-to-end event tracking confirms funnel performance.
- Mandatory attribution events are flowing: `demo_started`, `demo_completed`, `signup_clicked`, `trial_user_linked_to_registered_user`.
- Runbook exists for refresh failures and cache misses.
- Flag-controlled rollback path tested.

---

## 11. Summary

This revised plan keeps the original vision, but sequences work for **fast ROI** and **low maintenance risk**:

- Start with public demo caching (highest conversion upside).
- Reuse existing service and workflow architecture.
- Add registered starter caching after instrumentation is proven.
- Scale only when metrics confirm value.

This gives us a practical path to ship quickly, learn quickly, and avoid architectural debt.

---

## 12. `certifai-app` frontend implementation plan (copy-ready)

This section is intentionally separated so it can be copied into `certifai-app` planning docs with minimal edits.

### Frontend goals

- Let visitors start a trial instantly from marketing pages.
- Show final score after trial completion.
- Gate detailed explanations behind signup.
- Preserve trial state and link it after successful registration.

### Suggested page/module plan

1. **Marketing entry integration**
   - Add “Try 10 Questions Instantly” CTA to selected certification public pages.
   - Trigger primary CTA to register immediately after question 10.
   - Pass cert slug/id and attribution params into trial start flow.

2. **Trial exam experience (public)**
   - Dedicated trial route (public): question pager, timer (optional), progress bar.
   - Submit flow computes and displays score summary.
   - Explanation area shown as locked UI with signup CTA.

3. **Signup + post-signup unlock flow**
   - On signup success, call backend linking endpoint to connect `trialUser` with `user_id`.
   - Redirect user to unlocked trial review or onboarding dashboard.

4. **Post-signup review page**
   - Render detailed explanations/rationales for completed trial exam.
   - Add CTA: generate full exam for same certification.

### Suggested frontend state model

- `trialSession`
  - `trialUserId`
  - `trialExamId`
  - `certificationId`
  - `status` (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `LINKED`)
- `trialResult`
  - score summary fields
  - `isExplanationUnlocked`

Persist lightweight session identifier in cookie/local storage with expiration.

### Suggested frontend API integrations

- `POST /public/trials` → create trial user/session + trial exam
- `GET /public/trials/:trial_exam_id/questions` → fetch trial questions
- `POST /public/trials/:trial_exam_id/submit` → submit and return score summary
- `POST /users/:user_id/trials/link` (protected) → link anonymous trial to registered account
- `GET /users/:user_id/trials/:trial_exam_id/review` (protected) → unlocked explanations

Use existing SWR patterns and API envelope contract (`{ success, data, meta? }`).

### UI/UX notes for conversion

- Keep explanation lock state explicit: “Create free account to unlock detailed explanations.”
- Show a 1-line explanation preview hint while full rationale remains locked.
- After showing score, use one primary CTA and one secondary CTA (continue browsing).
- Keep trial completion screen lightweight and mobile-first.

### Frontend analytics events

- `trial_cta_clicked`
- `trial_started`
- `trial_question_answered`
- `trial_completed`
- `trial_score_viewed`
- `trial_explanation_unlock_clicked`
- `trial_signup_completed`
- `trial_link_success`

### Frontend phased rollout

- **Phase A:** one certification page, internal QA traffic.
- **Phase B:** top 3-5 certification pages, 50% traffic split.
- **Phase C:** full rollout to selected marketing pages.

### Frontend done criteria

- Visitor can complete trial and see score without account creation.
- Explanation UI is locked before signup and unlocked after successful link.
- Trial-link failure has safe fallback UX (retry + support path).
- Event tracking is complete and validated in analytics dashboard.
