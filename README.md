# certifai-api

Firebase Functions backend for the **certifai** AI-powered certification training platform. This API provides exam generation, user management, certification tracking, and community features powered by Google's Vertex AI and Firebase ecosystem.

## Architecture Overview

**certifai** is a dual-repo platform:

- `certifai-app`: Next.js 15 frontend with App Router, TypeScript, Tailwind CSS
- `certifai-api`: Firebase Functions backend with Express.js, Prisma, PostgreSQL, Redis (this repo)

## Getting Started

### Prerequisites

- Node.js v22 or later
- Firebase CLI (`npm install -g firebase-tools`)
- PostgreSQL database (local or cloud)
- Redis instance (Upstash recommended)
- Google Cloud Project with Firebase enabled

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd certifai-api
   ```

2. Install dependencies:

   ```bash
   cd functions
   npm install
   ```

3. Set up environment variables:

   ```bash
   # Copy environment template
   cp .env.example .env

   # Configure required variables:
   # DATABASE_URL, REDIS_URL, FIREBASE_PROJECT_ID, etc.
   ```

4. Set up Prisma:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

### Development

Start the Firebase emulator:

```bash
cd functions
npm run serve
```

This starts the local development server with Firebase Functions emulator on `http://localhost:5001`.

### Deployment

#### Automatic Deployment via GitHub Actions

The project includes GitHub Actions workflows for automatic deployment:

- **UAT Environment**: Deploys on push to `uat` branch
- **Production Environment**: Deploys on push to `master` branch

Both workflows deploy:

1. Firestore Rules and Indexes (fixes query index errors)
2. Firebase Functions

#### Manual Deployment

Deploy Firebase Functions only:

```bash
cd functions
npm run deploy
```

Deploy Firestore Rules and Indexes only:

```bash
cd functions
npm run deploy:firestore
```

Deploy everything (Firestore + Functions):

```bash
cd functions
npm run deploy:all
```

#### Firestore Configuration

The project includes:

- `firestore.rules`: Security rules for Stripe collections
- `firestore.indexes.json`: Composite indexes for efficient queries
- Automatic deployment via GitHub Actions resolves index errors

#### Environment Setup

Ensure these secrets and variables are configured in GitHub:

**UAT Secrets:**

- `GCP_CREDENTIALS_JSON_UAT`
- `DATABASE_URL_UAT`
- `DIRECT_URL_UAT`
- `PUBLIC_JWT_SECRET_UAT`
- `UPSTASH_REDIS_REST_URL_UAT`
- `UPSTASH_REDIS_REST_TOKEN_UAT`
- `STRIPE_SECRET_KEY_UAT`

**UAT Variables:**

- `GCP_PROJECT_ID_UAT`
- `GCP_PROJECT_NUMBER_UAT`
- `GCP_REGION_UAT`
- `GCP_TASKS_HOST_UAT`
- `GCP_TASKS_SERVICE_ACCOUNT_UAT`

(Similar for Production without `_UAT` suffix)

## Core Technologies

- **Firebase Functions**: Serverless backend runtime
- **Express.js**: Web application framework
- **Prisma ORM**: Type-safe database client with PostgreSQL
- **TypeScript**: Type-safe JavaScript development
- **Redis**: High-performance caching (Upstash)
- **Vertex AI**: Google's AI platform for exam generation
- **Firebase Admin SDK**: Authentication and project management

## Project Structure

```bash
functions/
├── src/
│   ├── endpoints/           # Express.js API routes
│   │   ├── api/            # REST API handlers
│   │   └── index.ts        # Express app configuration
│   ├── delegators/         # Background task processors
│   ├── middlewares/        # Authentication & validation
│   ├── services/           # Business logic & external APIs
│   │   ├── prisma/         # Database service
│   │   ├── redis/          # Caching service
│   │   └── vertexai/       # AI exam generation
│   ├── scheduledFunctions/ # Cron jobs & monitoring
│   ├── types/              # TypeScript definitions
│   └── utils/              # Helper functions
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Database migrations
├── docs/                   # Technical documentation
└── package.json            # Dependencies & scripts
```

## Key Features

### Exam Generation

- AI-powered question generation using Vertex AI
- Adaptive difficulty scaling
- Topic-based question categorization
- Performance analytics and reporting

### User Management

- Firebase Authentication integration
- User certification tracking
- Progress monitoring and analytics

### Certification Platform

- Multi-vendor certification support (AWS, GCP, Azure, etc.)
- Exam scheduling and management
- Community features and discussions

### Performance & Caching

- Redis-based caching for optimized performance
- Prisma query optimization
- Background task processing with Cloud Tasks

## API Endpoints

### Authentication

- `POST /api/auth/verify` - Verify Firebase JWT tokens
- `GET /api/users/profile` - Get user profile

### Certifications

- `GET /api/certifications` - List available certifications
- `POST /api/certifications/{id}/register` - Register for certification

### Exams

- `POST /api/exams/generate` - Generate AI-powered exam
- `GET /api/exams/{id}` - Get exam details
- `POST /api/exams/{id}/submit` - Submit exam answers

### Community

- `GET /api/community/groups` - List community groups
- `POST /api/community/groups/{id}/join` - Join group

## Development Workflows

### Database Changes

```bash
# Create and apply migration
npx prisma migrate dev --name "description"

# Regenerate Prisma client
npx prisma generate
```

### Running Tests

```bash
npm test  # Currently configured to skip tests
```

### Code Quality

```bash
npm run lint          # ESLint checking
npm run lint:fix      # Auto-fix linting issues
npm run format        # Prettier formatting
npm run format:check  # Check formatting
```

## Cloud Infrastructure

### Cloud Tasks Authentication

The delegators Cloud Function handles background processing and is protected with authentication. Ensure proper Cloud Tasks setup:

#### Required Environment Variables

```bash
GCP_PROJECT_ID="your-project-id"
GCP_REGION="us-central1"
GCP_TASKS_SERVICE_ACCOUNT="your-service-account@your-project.iam.gserviceaccount.com"
GCP_TASKS_HOST="https://us-central1-your-project.cloudfunctions.net"
```

#### Service Account Permissions

The service account requires these IAM roles:

- `roles/cloudtasks.enqueuer` - Queue background tasks
- `roles/run.invoker` - Invoke Cloud Functions (2nd generation)

#### Validation

Verify your Cloud Tasks configuration:

```bash
cd functions
./scripts/validate-cloud-tasks-auth.sh
```

For complete setup instructions, see [Cloud Tasks Authentication Setup](docs/cloud-tasks-authentication-setup.md).

### Redis Configuration

certifai uses Upstash Redis for high-performance caching:

```bash
# Required environment variables
REDIS_URL="rediss://..."
REDIS_TOKEN="your-redis-token"
```

### Database Configuration

PostgreSQL with Prisma ORM:

```bash
# Required environment variables
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."  # For Prisma migrations
```

## Monitoring & Analytics

- **Firebase Functions Logger**: Structured logging for debugging
- **Exam Generation Metrics**: Automated monitoring of AI performance
- **Performance Indexes**: Optimized database queries (see `prisma/performance_indexes.sql`)
- **Redis Cache Metrics**: Cache hit/miss tracking

## Contributing

1. Follow the coding conventions outlined in `.github/copilot-instructions.md`
2. Use TypeScript for all new code
3. Implement proper error handling and logging
4. Add tests for new features
5. Update documentation for API changes

## Related Documentation

- [Exam Generation Architecture](docs/exam-generation-complete-guide.md)
- [Cache System Guide](docs/cache-system-complete-guide.md)
- [Performance Optimizations](docs/performance-analysis-and-optimization.md)
- [Public API Documentation](docs/public-api.md)
