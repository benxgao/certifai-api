# Product Glossary

> **Source of truth**: Product requirements and engineering consensus
> **Last reviewed**: 2026-05-26
> **Owner**: Product + Engineering

## Purpose

This glossary defines shared terminology used across product, engineering, and AI contexts. Use this to ensure consistent language when building features, writing code, and communicating with stakeholders.

## Core Terms

### Certification
A professional credential (e.g., AWS Solutions Architect Associate, CompTIA Security+, Azure Fundamentals) that candidates study for and test on. Certifai covers 100+ certifications across multiple vendors (AWS, Azure, GCP, CompTIA, Cisco, etc.).

### Exam
A practice test with a fixed set of questions that a user completes in one sitting. Users can take multiple exams per certification. Each exam has a status (QUESTIONS_GENERATING, READY, STARTED, COMPLETED) and tracks performance.

**Related**: Topic, Adaptive Exam, Exam Report

### Adaptive Exam (Generation)
An automatically generated practice exam tailored to a user's performance history. The system analyzes previous exams to identify weak, average, and mastered topics, then allocates questions to focus study on knowledge gaps.

**Related**: Exam, Topic, Knowledge Pooling

### Topic
A subject area within a certification (e.g., "IAM" for AWS, "Network Architecture" for CompTIA). Questions are categorized by topic to enable adaptive exam generation and performance analysis.

**Related**: Certification, Exam, Question

### Question
A single test item with multiple choice answers. Questions are stored in Firestore and tagged with certification, topic, difficulty, and correct answer(s). Each question has explanations.

**Related**: Topic, Exam, Exam Report

### Exam Report
A detailed post-exam analysis including correct/incorrect answers, topic performance breakdown, time spent, and learning insights. Stored in Firestore for historical analysis and knowledge pooling.

**Related**: Exam, Exam Result, Knowledge Pooling

### Exam Result
The outcome of a completed exam: pass/fail status, score, metrics (time per question, topic accuracy), and timestamp. Used for progress tracking and adaptive generation.

**Related**: Exam, Exam Report

### Knowledge Pooling
A system feature that consolidates mistake patterns and learning insights across all exams in a certification level. Identifies recurring gaps and surfaces targeted learning recommendations.

**Features**:
- Analyzes all exam reports within a certification
- Identifies common mistakes and weak topics
- Generates AI-powered learning insights
- Caches insights for 7 days or longer

**Related**: Exam Report, Learning Insights, Topic

### Learning Insights
AI-generated guidance on what to study next based on mistake patterns. Derived from knowledge pooling analysis; refreshed on a 7-day cycle or on-demand.

**Related**: Knowledge Pooling, Exam Report

### Rate Limit (Exam Generation)
A system constraint that limits exam generation to 3 exams per user per 24 hours. Prevents cost overruns and ensures fair resource allocation.

**Related**: Exam, Adaptive Exam

### Cloud Tasks
Google Cloud's asynchronous task queue service. Used to enqueue long-running jobs (exam generation, knowledge pooling analysis) so the API can respond quickly without waiting.

**Behavior**:
- **Local dev**: Tasks execute immediately (synchronously)
- **Production**: Tasks execute asynchronously in a queue

**Related**: Exam Generation, Async Processing

### Genkit
Open-source framework by Google for building AI-powered applications. Integrates with Vertex AI for LLM calls (question generation, explanation synthesis, learning insights).

**Related**: Vertex AI, Exam Generation, AI Services

### Vertex AI
Google Cloud's AI service providing LLM endpoints (PaLM 2, Gemini), embeddings, and model hosting. Certifai uses Vertex AI via Genkit for exam and insight generation.

**Related**: Genkit, AI Services

### Prisma
Object-Relational Mapping (ORM) tool for Node.js/TypeScript. Certifai uses Prisma to interact with PostgreSQL, providing type-safe queries and migrations.

**Related**: PostgreSQL, Database, Type Safety

### Redis / Upstash
In-memory caching layer providing fast key-value storage. Certifai uses Upstash (Redis as a service) for L2 cache layer to reduce database load.

**Related**: Cache, Performance, Database

### Firestore
Google's document-oriented NoSQL database. Stores questions, exam reports, and topic performance data. Different from PostgreSQL (which stores exam metadata and user accounts).

**Related**: Database, Questions, Exam Reports

### PostgreSQL
Relational database for user accounts, exam metadata, certification mappings, and other structured data. Accessed via Prisma ORM.

**Related**: Prisma, Database, Exam Metadata

### Credit Token
Spendable account balance used by Certifai to gate exam usage. New users start with `300` credit tokens, the profile API exposes the balance as `credit_tokens`, and the finalized exam flow decrements the balance when an exam is submitted.

**Related**: User (Database), Exam, Token Economy

### Energy Token
Reward balance earned from correct exam answers. New users start with `0` energy tokens, the profile API exposes the balance as `energy_tokens`, and the finalized exam flow increments the balance after successful submission.

**Related**: User (Database), Exam Result, Token Economy

### Token Economy
The paired credit/energy system used across Certifai. Credit tokens gate exam usage, while energy tokens capture earned progress and engagement. This is distinct from authentication tokens and rate-limit tokens.

**Related**: Credit Token, Energy Token, Exam, User (Database)

### Firebase Auth
Google's authentication service. Handles user sign-up, login, and token management. Certifai frontend (Next.js) uses Firebase Auth SDK; backend verifies tokens via custom JWT middleware.

**Related**: Authentication, JWT, Token

### JWT Token
JSON Web Token issued by Firebase Auth and verified by the backend. Contains user identity and is passed in API requests to authenticate endpoints.

**Format**: `Authorization: Bearer <jwt_token>`

**Related**: Firebase Auth, Authentication

### API Response Envelope
Standard response format for all API endpoints:
```
{
  success: boolean,
  data?: any,       // On success
  error?: string,   // On error
  code?: string     // Error code
}
```

**Related**: API Design, Endpoints

### Express.js
Minimalist Node.js web framework. Certifai backend is built on Express.js running in Firebase Functions.

**Key concepts**: Routing, Middleware, Request/Response handling

**Related**: Backend, Firebase Functions

### Firebase Functions
Google Cloud's serverless compute service. Certifai backend runs as Firebase Functions (HTTP endpoints and background workers).

**Related**: Serverless, Backend, Cloud Tasks

### User (Database)
A record in PostgreSQL representing an authenticated user. Contains `user_id` (Prisma primary key), `firebase_user_id` (from Firebase Auth), and profile info (email, name, avatar).

**Related**: Firebase Auth, PostgreSQL, Prisma

### User Session
Temporary state tracking a user's current activity (logged-in status, exam in progress, etc.). Cached in Redis for fast lookups.

**Related**: Redis, Cache, Authentication

### Idempotency
A property of operations where retrying the same operation multiple times produces the same result as running it once. Critical for async Cloud Tasks which may retry on failure.

**Example**: "Insert user if not exists" is idempotent. "Increment counter by 1" is not.

**Related**: Cloud Tasks, Async Processing

### L1 / L2 / L3 Cache
Layered caching strategy:
- **L1 Memory**: Hot data in memory (10-20ms latency)
- **L2 Redis**: Upstash cache (50-100ms latency)
- **L3 Database**: Source of truth (200-500ms latency)

Data is promoted based on usage patterns and demoted to save memory.

**Related**: Redis, Caching, Performance

### Service Catalog
Inventory of 20+ reusable services in `functions/src/services/` (Prisma, Redis, Genkit, Cloud Tasks, JWT, Firebase, etc.). Each service encapsulates domain logic and external integrations.

**Related**: Architecture, Services, Boundaries

### Type Safety
Practice of leveraging TypeScript's type system to catch errors at compile-time rather than runtime. Certifai prioritizes type safety: no `any` types, all Prisma results typed, all API requests/responses typed.

**Related**: TypeScript, Prisma, API

### Migration (Database)
A versioned change to the PostgreSQL schema using Prisma. Migrations are applied sequentially to ensure consistent database state across environments.

**Related**: Prisma, PostgreSQL, Database

### Rollout
A planned, phased deployment of a feature or change to production. Includes testing, monitoring, and rollback strategy.

**Related**: Deployment, Operations

---

## Related Docs

- [API Response Envelope](../api/response-envelope.md) – Details of the ApiResponse structure
- [Architecture Overview](../architecture/firebase-functions-structure.md) – System context and core components
- [Repository Map](../ai/repo-map.md) – System boundaries and structure
- [Token Economy](./token-economy.md) – credit and energy balance rules used across exam flows
