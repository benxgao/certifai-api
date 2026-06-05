# Product Plan: Cached Questions for Instant Demo + Faster Exam Start

## ROI-First rollout to improve conversion, speed, and AI unit economics

---

**Version:** 1.3 (Fast GTM Revision)
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

This is also a **marketing-integration feature**: trial traffic should flow naturally into signup with lightweight CTAs first, while advanced gates/restrictions are deferred to later stages.

**Expected business result** (if staged correctly):

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
   - Public pages are directly integrated with cached trial questions as trial exams.
   - Keep explanation handling simple in MVP (basic explanation display allowed, no hard lock required).
   - Keep condition checks/restrictions minimal in MVP for speed.

2. **Registered Shared Starter Pool (Stage 4)**
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
- Visitors can see basic explanations in MVP if available.
- Signup CTA is shown at key points (especially post-trial), but strict explanation gating is deferred.
- Trial-to-user linking remains a Stage 3+ enhancement.
- Usage caps, anti-abuse constraints, and advanced condition checks are deferred to later stages.

---

## 3. Proposed architecture fit with current stack

This plan intentionally reuses existing `certifai-api` architecture:

- **API layer:** add endpoints under current REST conventions (`functions/src/endpoints/api/`).
- **Service layer:** orchestrate via existing services (`genkit`, `cloudTasks`, `prisma`, `redis`, `cache`).
- **Generation pipeline:** reuse current exam-generation flow and queue patterns for pre-generation jobs.
- **Caching + storage:** use centralized Redis patterns (`RedisService`, `CacheManager`, standardized key prefixes/TTL), with Firestore as source of truth for trial datasets and PostgreSQL as source of truth for registered datasets.
- **Frontend:** integrate in `certifai-app` public pages using existing SWR/API envelope patterns.
- **Data isolation:** keep trial datasets logically isolated from registered datasets; controlled linkage can be introduced in later stages.

### Recommended high-level flow

1. Stage 1 ships a pre-generated public demo pool for selected certifications.
2. Stage 2 adds scheduled refresh jobs so expired/retired questions are replaced automatically.
3. Questions are stored with metadata (certification, pool type, freshness window, generation version).
4. Public page fetches demo pool via public endpoint.
5. Stage 4 exam creation endpoint optionally hydrates first N questions from registered shared pool.
6. Existing generation workflow fills remaining questions asynchronously.

**MVP operating assumptions:** global pool distribution first (no regional partitioning), no anti-replay controls for demo submission, and no dedicated anti-scraping layer in MVP beyond standard platform protections.

### Trial-domain isolation principle (MVP-light)

- Start with a lightweight trial exam domain for public usage (`trialExam` + trial answers + attribution).
- Avoid coupling anonymous trial activity with registered-user exam tables.
- Full one-way linking flow to registered users is deferred to Stage 3+.
- Preserve attribution metadata from day 1 (`campaign`, `landing_page`, `utm_*`, `referrer`).

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

### Trial entities and linking model (recommended, staged)

- `trialUser`
  - anonymous identifier (cookie/device/session-based)
  - attribution metadata (`utm_source`, `utm_campaign`, etc.)
  - lifecycle status (`ANONYMOUS`, `LINKED`, `EXPIRED`)
  - trial lifecycle expiry set to 90 days
- `trialExam`
  - belongs to `trialUser`
  - certification reference + question set reference
  - score summary fields (score %, total correct, completed_at)
  - explanation access policy kept simple in MVP; lock/unlock states can be added later
- `trialExamAnswer`
  - trial answer records separated from registered answer records
- `trialUserLink`
   - mapping between `trialUser` and registered `user_id`
   - created after signup/auth verification (Stage 3+)

**Isolation rule:** trial tables/collections should be separated from current registered datasets as much as possible to reduce coupling, simplify retention rules, and avoid accidental cross-tenant leakage.

**Linking rule:** defer linkage implementation until Stage 3+; MVP can remain anonymous and decoupled.

---

## 5. 4-stage rollout plan (fast go-to-market)

### Stage 1 (Weeks 1-2): MVP public demo cache (ship fast)

- Launch on top 3-5 highest-traffic certification pages first.
- Keep static pool size (10) and prepare initial question sets up front for quick launch.
- Integrate cached trial exams directly into public certification pages with minimal checks.
- Add strict fallback: if no valid pool, return a friendly unavailable state.
- Track baseline funnel events: `demo_started`, `demo_completed`, `signup_clicked`.

**Exit criteria**

- First-question latency for demo <$1s p50 (target).
- Demo completion and CTA click metrics flowing.
- MVP is production-ready with minimal operational overhead.

### Stage 2 (Weeks 2-4): scheduler + infrastructure hardening

- Add schedulers/workers to generate replacement questions when expired pools are retired.
- Enforce rotation/expiry policy (90 days) automatically for `DEMO_PUBLIC` across certifications.
- Define and finalize pool schema + key naming + TTL policy in shared config.
- Add basic observability fields (`cache_hit`, `pool_age_hours`, `fallback_reason`) and dashboards.
- Add/validate feature flags:
  - `public_demo_cache_enabled`
  - `registered_starter_cache_enabled`
- Ensure pre-generation jobs are idempotent (upsert/version-safe).

**Exit criteria**

- Expired pools are automatically retired and replenished.
- Can measure hit/miss/fallback/freshness with logs and metrics.
- On-call runbook exists for scheduler failure and low-coverage alerts.

### Stage 3 (Weeks 4-6): advanced controls and safeguards

- Introduce advanced gates/restrictions (explanation lock, usage caps, anti-abuse checks) as needed.
- Add anti-replay and abuse-monitoring controls for public trial submissions.
- Add light quality controls for pooled questions (sampling, complaint thresholds).
- Enable optional trial-linking and post-signup unlock flow if conversion data supports it.

**Exit criteria**

- Restriction controls are feature-flagged and measurable.
- Abuse/error guardrails remain within acceptable thresholds.
- Quality and trust metrics remain stable during rollout.

### Stage 4 (Week 6+): registered-user cached starter pool

- Serve first 10 questions from `REGISTERED_SHARED` pool at registered exam creation.
- Generate remaining questions through existing async pipeline.
- Gradual release: 10% → 50% → 100% via feature flag.
- Expand cert coverage and tune pool size by demand tiers (e.g., 10/20/30).

**Exit criteria**

- Exam start latency reduced materially (target <3s for cached segment).
- AI token usage per exam decreases vs baseline.
- Registered-user cache path is stable and rollback-tested.

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

### Mandatory attribution events (MVP baseline)

- `demo_started`
- `demo_completed`
- `signup_clicked`

### Extended attribution events (Stage 3+)

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
- Trial-to-registered linkage success rate (Stage 3+)

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
3. Add scheduler-based refresh and infrastructure hardening.
4. Add advanced restrictions only after baseline conversion and reliability are proven.
5. Add registered shared starter pool behind flag.
6. Scale breadth only after unit economics and quality are validated.

If speed is the priority, avoid overbuilding personalization in cached questions during first release.

---

## 10. Definition of done for initial launch

- Public demo cache live on selected certification landing pages.
- Median demo first-question latency is near-instant.
- End-to-end event tracking confirms funnel performance.
- Mandatory attribution events are flowing for MVP: `demo_started`, `demo_completed`, `signup_clicked`.
- Runbook exists for refresh failures and cache misses.
- Flag-controlled rollback path tested.

---

## 11. Summary

This revised plan keeps the original vision, but sequences work for **fast ROI** and **low maintenance risk**:

- Start with public demo caching (highest conversion upside).
- Reuse existing service and workflow architecture.
- Add scheduler/infra automation immediately after Stage 1 MVP proves demand.
- Add explanation locking, strict restrictions, and trial-user linking in Stage 3 only if metrics justify complexity.
- Add registered starter caching in Stage 4 after stability and instrumentation are proven.
- Scale only when metrics confirm value.

This gives us a practical path to ship quickly, learn quickly, and avoid architectural debt.

---

## 12. `certifai-app` frontend implementation plan (copy-ready)

This section is intentionally separated so it can be copied into `certifai-app` planning docs with minimal edits.

### Frontend goals

- Let visitors start a trial instantly from marketing pages.
- Show final score after trial completion.
- Keep explanation and restriction logic simple in MVP.
- Add signup-linking and gated explanation flows in later stages.

### Frontend implementation by stage

1. **Stage 1 (MVP): instant trial entry + completion**
   - Add “Try 10 Questions Instantly” CTA to selected certification public pages.
   - Pass cert slug/id and attribution params into trial start flow.
   - Build dedicated public trial route: question pager, optional timer, progress bar.
   - Submit flow returns score summary and displays post-trial signup CTA.
   - Keep explanation display simple (no strict lock required).

2. **Stage 2: scheduler-aware UX + reliability instrumentation**
   - Handle stale/retired pool responses gracefully with a friendly unavailable state.
   - Surface lightweight status/fallback messaging tied to backend freshness logic.
   - Validate analytics instrumentation and metadata capture quality for operational dashboards.

3. **Stage 3: advanced conversion and restriction UX**
   - Add explanation lock/unlock UX, usage caps messaging, and abuse-throttle messaging (feature-flagged).
   - Add signup + trial-linking flow: on signup success, call linking endpoint and redirect to unlocked review/onboarding.
   - Add post-signup review experience with detailed rationale and CTA to generate a full exam.

4. **Stage 4: registered-user cached exam start**
   - Integrate registered exam creation flow with `REGISTERED_SHARED` cached starter questions.
   - Ensure seamless handoff from cached starter segment to async-generated remaining questions.
   - Instrument exam-start latency and cache-hit metrics in authenticated flows.

### Suggested frontend state model

- `trialSession`
  - `trialUserId`
  - `trialExamId`
  - `certificationId`
  - `status` (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `LINKED`)
- `trialResult`
  - score summary fields
   - `isExplanationUnlocked` (optional, Stage 3+)

Persist lightweight session identifier in cookie/local storage with expiration.

### Suggested frontend API integrations

- `POST /public/trials` → create trial user/session + trial exam
- `GET /public/trials/:trial_exam_id/questions` → fetch trial questions
- `POST /public/trials/:trial_exam_id/submit` → submit and return score summary
- `POST /users/:user_id/trials/link` (protected, Stage 3+) → link anonymous trial to registered account
- `GET /users/:user_id/trials/:trial_exam_id/review` (protected, Stage 3+) → unlocked explanations
- `POST /users/:user_id/exams` with starter cache metadata (protected, Stage 4) → start registered exam with cached first segment

Use existing SWR patterns and API envelope contract (`{ success, data, meta? }`).

### UI/UX notes for conversion

- Keep UX simple and fast in MVP; avoid heavy lock/restriction logic in initial release.
- Use clear but lightweight signup CTA messaging after trial completion.
- After showing score, use one primary CTA and one secondary CTA (continue browsing).
- Keep trial completion screen lightweight and mobile-first.

### Frontend analytics events

- `trial_cta_clicked`
- `trial_started`
- `trial_question_answered`
- `trial_completed`
- `trial_score_viewed`
- `trial_explanation_unlock_clicked` (Stage 3+)
- `trial_signup_completed`
- `trial_link_success` (Stage 3+)
- `registered_exam_started_with_cache` (Stage 4)

### Frontend 4-stage rollout

- **Stage 1:** one certification page, internal QA traffic, then top 3-5 pages for MVP trial flow.
- **Stage 2:** full scheduler/fallback handling rollout for selected marketing pages.
- **Stage 3:** progressive rollout of restriction and linking UX via feature flags.
- **Stage 4:** gradual rollout of registered cached exam start (10% → 50% → 100%).

### Frontend done criteria

- Visitor can complete trial and see score without account creation.
- Public pages are integrated with cached trial exams and remain fast under normal traffic.
- Explanation lock/unlock and trial-linking are explicitly deferred to Stage 3.
- Registered-user cached starter flow is explicitly deferred to Stage 4.
- Event tracking is complete and validated in analytics dashboard.
