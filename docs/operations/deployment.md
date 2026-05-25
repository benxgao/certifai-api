# Deployment

> **Source of truth**: `.github/workflows/deployment-uat.yml`, `.github/workflows/deployment-prod.yml`, `firebase.json`, `functions/`
> **Last reviewed**: 2026-05-26
> **Owner**: Backend Team

## Purpose

Document how `certifai-api` deploys Firebase Functions and Firestore rules/indexes via GitHub Actions for UAT and production.

## Environments

- **UAT**: workflow `deployment-uat.yml`, triggered by push to `uat`
- **Production**: workflow `deployment-prod.yml`, triggered by push to `master`

## Pipeline Overview

Both workflows follow the same high-level sequence:

1. Checkout repository
2. Setup Node.js (`node-version: 24`)
3. Cache npm dependencies
4. Install dependencies in `functions/` (`npm ci`)
5. Install Firebase CLI globally
6. Materialize GCP credentials JSON from GitHub Secrets
7. Select Firebase project
8. Enable required GCP APIs
9. Create runtime `.env` file in `functions/` from vars/secrets
10. Deploy Firestore rules/indexes
11. Deploy Firebase Functions

## Required Workflow Inputs

### GitHub Vars (environment-specific)

Examples used by workflows:

- `GCP_PROJECT_ID(_UAT)`
- `GCP_PROJECT_NUMBER(_UAT)`
- `GCP_REGION(_UAT)`
- `GCP_TASKS_HOST(_UAT)`
- `GCP_TASKS_SERVICE_ACCOUNT(_UAT)`
- `FRONTEND_URL(_UAT)`
- `CORS_ALLOWED_ORIGINS(_UAT)`

### GitHub Secrets (environment-specific)

Examples used by workflows:

- `GCP_CREDENTIALS_JSON(_UAT)`
- `DATABASE_URL(_UAT)`
- `DIRECT_URL(_UAT)`
- `PUBLIC_JWT_SECRET(_UAT)`
- `UPSTASH_REDIS_REST_URL(_UAT)`
- `UPSTASH_REDIS_REST_TOKEN(_UAT)`
- `STRIPE_SECRET_KEY(_UAT)`
- `STRIPE_WEBHOOK_SECRET(_UAT)`
- `RESEND_API_KEY(_UAT)`

## Required GCP APIs

Workflows explicitly enable:

- `cloudfunctions.googleapis.com`
- `cloudbuild.googleapis.com`
- `artifactregistry.googleapis.com`
- `eventarc.googleapis.com`
- `run.googleapis.com`
- `logging.googleapis.com`
- `firestore.googleapis.com`

## Deployment Notes

- Firestore rules and indexes are deployed before functions.
- Function deploy command currently uses `npm run deploy -- --force` from `functions/`.
- Credentials are written to `functions/gcp_credentials.json` during workflow execution.

## Rollback / Recovery Considerations

- Re-run last known good workflow commit for same branch/environment.
- If deploy failure is config-related, correct vars/secrets and re-trigger.
- Keep rules/index changes coupled with app expectations to avoid runtime access regressions.

## Dangerous Areas / Anti-patterns

- Missing/incorrect environment variables causing runtime failures post-deploy.
- Deploying with mismatched Firebase project selection.
- Skipping Firestore rules/index deployment when schema-dependent behavior changed.
- Storing credentials outside CI secret flow.

## Related Docs

- [Prisma Patterns](../database/prisma-patterns.md) – DB behavior assumptions in deployed runtime
- [Redis Patterns](../cache/redis-patterns.md) – cache env dependencies
- [Service Catalog](../services/service-catalog.md) – infra-facing services
- [Repository Map](../ai/repo-map.md) – system boundary overview
