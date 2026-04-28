# Certifai API

Backend for [Certestic](https://certestic.com), a certification training app with AI-powered exam generation, user progress tracking, and community features.

**Tech Stack**: Firebase Functions, Express.js, Prisma, PostgreSQL, Redis, Vertex AI

## Architecture

**Frontend**: `certifai-app` (Next.js 15)  
**Backend**: `certifai-api` (this repo) — Firebase Functions + Express.js

## Getting Started

### Prerequisites

- Node.js v24+
- Firebase CLI
- PostgreSQL
- Redis (Upstash works fine)
- Google Cloud Project with Firebase

## Deployment

Automated deployments via GitHub Actions:

- **Push to `uat`** → Staging
- **Push to `master`** → Production

## Features

- **Exam Generation**: AI-powered questions via Gemini-2.5-flash, adaptive difficulty
- **User Management**: Firebase auth, progress tracking, certification roadmaps
- **Certification Platform**: Multi-vendor support (AWS, Azure, GCP, etc.)
- **Community**: Discussion forums, study groups
- **Performance**: Redis caching, optimized database queries

## API Endpoints

**Authentication**: `POST /api/auth/verify`, `GET /api/users/profile`

**Exams**: `POST /api/exams/generate`, `GET /api/exams/{id}`, `POST /api/exams/{id}/submit`

**Certifications**: `GET /api/certifications`, `POST /api/certifications/{id}/register`

## Infrastructure

**Cloud Tasks** (background jobs): Handles exam generation, email sending, etc. Production only; local dev executes immediately.

```bash
GCP_PROJECT_ID="your-project-id"
GCP_REGION="us-central1"
GCP_TASKS_SERVICE_ACCOUNT="your-sa@your-project.iam.gserviceaccount.com"
GCP_TASKS_HOST="https://us-central1-your-project.cloudfunctions.net"
```

Service account needs: `roles/cloudtasks.enqueuer`, `roles/run.invoker`

Validate: `./scripts/validate-cloud-tasks-auth.sh`

**Redis** (caching): Upstash recommended.

```
REDIS_URL="rediss://..."
REDIS_TOKEN="your-token"
```

**PostgreSQL** (data storage):

```
DATABASE_URL="postgresql://user:pass@host/dbname"
DIRECT_URL="postgresql://..."  # For migrations
```

**Monitoring**: Firebase Functions dashboard, Firestore console, Prisma Studio (`npx prisma studio`)

## License

MPL 2.0 starting from version 2.0.0. Previous versions were MIT. See [LICENSE](LICENSE).
