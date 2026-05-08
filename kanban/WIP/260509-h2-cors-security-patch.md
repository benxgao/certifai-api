# Rollout: H2 CORS Security Hardening

## Summary

Fix the H2 finding by replacing permissive CORS behavior (`!origin` allowed + empty allowlist) with explicit, environment-driven origin policy. The goal is to ensure only approved origins are accepted in production, while preserving controlled local development workflows and improving observability for blocked requests.

## Scope

- Estimated files to modify: 4-6
- Estimated files to create: 1-2
- Risk level: **Medium** (cross-origin behavior changes can impact frontend and integrations)

## Problem Statement (H2)

Current CORS implementation in `functions/src/endpoints/index.ts`:

- uses an empty hardcoded `allowedOrigins` array,
- allows requests when `!origin || allowedOrigins.includes(origin)`,
- effectively permits no-origin requests broadly,
- logs but does not enforce a robust environment-specific policy.

This weakens boundary controls and can unintentionally expand access from non-browser clients or misconfigured origins.

## Target State

1. Production/staging accepts only explicitly configured origins.
2. No-origin requests are denied by default except where explicitly enabled for local/dev.
3. CORS policy is configured via environment variables, not commented code.
4. Blocked-origin events are observable with structured logs and counters.
5. Behavior is covered by tests for both allowed and denied scenarios.

## Phases

### Phase 1: Policy & Config Foundation (independently testable)

**Goal:** Introduce clear CORS policy configuration and safe defaults.

**Files:**

- `functions/src/endpoints/index.ts` — modify — replace static/commented origin list with env-driven config.
- `functions/.env.sample` — modify — add CORS config vars and secure examples.
- `functions/src/config/cors.ts` — create — centralized CORS parsing/validation helper.

**Implementation details:**

- Add env vars:
  - `CORS_ALLOWED_ORIGINS` (comma-separated exact origins)
  - `CORS_ALLOW_NO_ORIGIN` (`true|false`, default `false`)
  - `CORS_LOG_BLOCKED_ORIGINS` (`true|false`, default `true`)
- Parse and normalize origins (trim, dedupe, reject invalid URL forms).
- Fail closed when allowlist is empty in non-dev environments.

**Verification:**

- Startup logs confirm loaded origin count and mode.
- In non-dev with empty allowlist, service either fails fast or rejects all cross-origin requests (chosen policy documented).

---

### Phase 2: Runtime Enforcement Hardening (independently testable)

**Goal:** Enforce strict request-time decisions for origin/no-origin cases.

**Files:**

- `functions/src/endpoints/index.ts` — modify — apply strict origin callback logic.

**Implementation details:**

- Allow request only if:
  1.  `origin` exists **and** is in `CORS_ALLOWED_ORIGINS`, or
  2.  `origin` missing **and** `CORS_ALLOW_NO_ORIGIN=true` (expected only in controlled local/dev use).
- Remove implicit `!origin` allow path.
- Replace `console.log` with structured logger fields:
  - `origin`, `path`, `method`, `decision`, `reason`.

**Verification:**

- Manual checks:
  - Allowed origin receives success + proper CORS headers.
  - Unknown origin is rejected.
  - No-origin request rejected unless explicit flag enabled.

---

### Phase 3: Test Coverage & Regression Protection (independently testable)

**Goal:** Ensure policy remains stable and future-safe.

**Files:**

- `functions/__tests__/endpoints/cors-policy.test.ts` — create — CORS decision tests.
- `functions/jest.config.js` — modify (if needed) — include new test path.

**Test matrix:**

- Allowed origin → pass.
- Disallowed origin → blocked.
- No origin + flag false → blocked.
- No origin + flag true → pass.
- Empty allowlist in production mode → fail closed behavior validated.

**Verification:**

- `npm test` (or targeted jest run) passes for new tests.

---

### Phase 4: Deployment Safety, Monitoring, and Rollout (independently testable)

**Goal:** Roll out with low blast radius and quick rollback path.

**Files:**

- `docs/security/260509-scan-report.md` — optional update — mark H2 remediation status.
- Deployment env configs (CI/CD / runtime secrets) — update — set CORS env vars per environment.

**Rollout sequence:**

1. Deploy to UAT with explicit UAT frontend origins.
2. Validate browser flows + API clients.
3. Monitor blocked-origin logs for 24-48h.
4. Promote to production with production origins.

**Verification:**

- No unexpected frontend CORS failures.
- Blocked-origin logs only show non-approved traffic.

## Rollback Plan

1. Revert code changes in `functions/src/endpoints/index.ts` and `functions/src/config/cors.ts`.
2. Restore prior env behavior by removing new CORS vars.
3. Redeploy previous stable functions revision.
4. Keep blocked-origin telemetry for postmortem.

## Open Questions

1. Should no-origin traffic ever be allowed in production for specific machine clients, or should those callers migrate to internal network/IAM-based access only?
2. Should we support wildcard subdomains (e.g., preview environments), and if yes, via strict suffix matching rules rather than naive wildcarding?
3. Should failed CORS checks increment a security metric (e.g., Cloud Monitoring counter) and alert on spikes?

## Acceptance Criteria

- [ ] Production CORS policy is explicit and allowlist-only.
- [ ] No-origin is denied by default outside controlled local/dev usage.
- [ ] CORS decisions are visible in structured logs.
- [ ] Automated tests cover all decision branches.
- [ ] UAT + production rollout completed with no user-impacting regressions.
