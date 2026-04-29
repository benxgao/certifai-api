# Compliance-Aware AI-Powered Exam Simulation Plan

## Executive Summary

**Goal:** Manage hundreds of certification questions across 50+ firms with **transparent, compliance-aware AI** instead of pure black-box generation. Generate realistic exam questions grounded in public materials, validate quality with verifiable metrics, and maintain complete audit trails for regulatory transparency.

**Key Principle:** Document → Retrieved Ground Truth → AI Generation → Multi-Layer Validation → Transparent Storage → User Visibility

---

## Problem Statement

1. **Scale Challenge:** 100s-1000s questions across 50+ certifications with no manual management capacity
2. **Quality Concern:** Pure AI generation produces hallucinations; need verified, factual questions
3. **Compliance Requirement:** Public data only (legally searchable); no proprietary cert materials
4. **Audit Requirement:** Full transparency—why was each question generated, how was it validated?

---

## Solution Overview

Build a **Source-Grounded Question Generation Pipeline** with four stages:

```
Stage 1: Material Ingestion
  ↓ (Fetch public docs, APIs, guides)
  ↓
Stage 2: Material-Grounded Generation
  ↓ (Retrieve relevant facts → Inject into AI prompt)
  ↓
Stage 3: Multi-Layer Validation
  ↓ (Correctness, Difficulty, Diversity, Bias checks)
  ↓
Stage 4: Audit-Logged Storage
  ↓ (Store question + prompt + materials + scores)
  ↓
User Transparency
  (Audit trail visible to users & regulators)
```

### Why Not Pure RAG?

We **avoid mandatory vector embeddings** to reduce complexity:

- **MVP Strategy:** Keyword + semantic chunking for retrieval
- **Fallback:** If retrieval latency becomes bottleneck, add embeddings in Phase 4
- **Reasoning:** Simpler to audit, cheaper, and works well for 50-200 certs

---

## Architecture Design

### 1. **Material Ingestion Service**

**Purpose:** Fetch and parse public certification materials

**Components:**

- `material-ingestion/fetcher.ts` — HTTP fetch + parser for:
  - Official documentation (Kubernetes, AWS, GCP official docs)
  - Public repositories (GitHub, GitLab)
  - Community wikis (StackOverflow, confluence wikis)
  - API endpoints (if cert providers expose them)

- `material-ingestion/parser.ts` — Extract structured facts:
  - Definitions, concepts, relationships
  - Section hierarchy
  - Code examples, architectural patterns

- `material-ingestion/chunker.ts` — Segment by topic:
  - Split large docs into 300-500 token chunks
  - Preserve section context
  - Tag each chunk with topic (e.g., "Kubernetes Networking", "AWS IAM")

**Storage:**

- PostgreSQL table `CertificationMaterial` (Prisma) → Tracks source metadata
- PostgreSQL table `MaterialChunk` (Prisma) → Parsed, chunked content
- Optional future: Vector embeddings if Phase 4 semantic search needed

**Data Model:**

```prisma
CertificationMaterial {
  material_id: String
  cert_id: Int
  source_url: String
  source_type: OFFICIAL_GUIDE | OFFICIAL_DOCS | PUBLIC_API | PUBLIC_REPO | COMMUNITY_WIKI
  authority_level: OFFICIAL | SECONDARY | COMMUNITY
  copyright_status: PROPRIETARY | CC_LICENSED | FAIR_USE | PUBLIC_DOMAIN
  title, description, last_fetched, last_updated
}

MaterialChunk {
  chunk_id: String
  material_id: String
  chunk_text: String
  topic: String (e.g., "Kubernetes Networking")
  chunk_index: Int
}
```

---

### 2. **Question Generation with Material Grounding**

**Purpose:** Generate questions based on retrieved facts (not pure hallucination)

**Process:**

1. User initiates exam generation for cert X
2. System identifies weak topics from previous performance
3. For each topic:
   - Query `MaterialChunk` table for 5-10 relevant chunks
   - (Keyword match on topic initially; semantic search in Phase 4)
4. **Build grounded prompt:**

   ```
   Topic: "Kubernetes Pod Networking"

   Ground Truth Materials:
   - [Fact 1 from official K8s docs]
   - [Fact 2 from K8s networking guide]

   Generate 1 multiple-choice question where:
   • Correct answer is verifiable from materials above
   • All incorrect options are plausible but factually wrong
   • Explanation cites which material verifies the answer
   • Difficulty level: ADVANCED
   ```

5. Call Genkit (gemini-2.5-flash) with grounded prompt
6. Return question with `source_material_id` reference

**Key Differences from Current System:**

- ✅ Currently: Pure prompt + topic → AI generates questions
- ✨ New: Material facts injected into prompt → AI grounds generation
- ✅ Currently: Adaptive difficulty based on performance
- ✨ New: Material sources explicitly stored for audit

---

### 3. **Multi-Layer Validation Pipeline**

**Purpose:** Quality gates to filter low-confidence questions

**Four Independent Validators:**

#### 3.1 **Correctness Validator**

- **Input:** Generated question + correct answer + retrieved materials
- **Process:** Use GPT-4 or Claude to verify:
  - Is the correct answer actually correct per materials?
  - Are incorrect options plausible but wrong?
  - No factual errors in question text?
- **Output:** `correctness_score` (0–1.0)
- **Cost:** ~$0.05 per question (GPT-4) or ~$0.02 (Claude)

#### 3.2 **Difficulty Analyzer**

- **Input:** Question + exam_topic + cert_level
- **Process:** Map question difficulty to cert level:
  - Easy questions for foundational certs
  - Advanced/Expert for high-level certs
  - Check if question complexity matches stated difficulty
- **Output:** `difficulty_score` (0–1.0)
- **Cost:** Gemini-2.5-flash, ~$0.005 per question

#### 3.3 **Diversity Checker**

- **Input:** New question + all recent questions for cert
- **Process:** Semantic similarity check:
  - Avoid duplicate concepts across questions
  - Ensure topic variety
  - Prevent repetitive explanation patterns
- **Output:** `diversity_score` (0–1.0)
- **Cost:** Lightweight (string matching + basic NLP), ~$0.001 per question

#### 3.4 **Bias Detector**

- **Input:** Question text + all options
- **Process:** Check for:
  - Culturally stereotyped language
  - Gender/ethnicity assumptions
  - Inaccessible terminology
- **Output:** `bias_score` (0–1.0)
- **Cost:** Local model (no API), ~$0.0001 per question

**Combined Score:**

```
quality_confidence = (
  correctness * 0.5 +
  difficulty * 0.25 +
  diversity * 0.15 +
  bias * 0.1
)
```

**Filtering Rules (by Strategy):**

- **Strategy A (High Confidence):** Keep only if `quality_confidence >= 0.85`
- **Strategy B (Balanced):** Keep only if `quality_confidence >= 0.70`
- **Strategy C (Volume):** Keep only if `quality_confidence >= 0.65` (manual review batch after)

---

### 4. **Audit Trail & Storage**

**Purpose:** Maintain complete transparency for compliance

**Extended `QuizQuestion` Schema:**

```prisma
QuizQuestion {
  quiz_question_id: String
  cert_id: Int
  source_material_id: String  // FK to CertificationMaterial

  // Generation metadata
  generation_prompt: String      // Full prompt sent to AI
  validation_scores: Json        // {correctness: 0.92, difficulty: 0.88, ...}
  quality_confidence: Float      // Overall score (0–1.0)

  // Verification
  is_verified: Boolean           // Reviewed by human?
  verified_by: String            // User ID of reviewer
  verification_notes: String     // Reviewer feedback

  // ... existing fields
}

QuestionValidationLog {
  log_id: String
  quiz_question_id: String
  cert_id: Int
  validator_type: CORRECTNESS|DIFFICULTY|DIVERSITY|BIAS
  score: Float
  details: Json                  // Detailed feedback from validator
  created_at: DateTime
}
```

**Audit Endpoints:**

- `GET /api/questions/:questionId/audit-trail`
  - Returns: generation_prompt, source_material_id, validation_scores, verified_by
  - **Use Case:** User/regulator verifies question integrity
- `GET /api/certifications/:certId/material-sources`
  - Returns: List of all source materials for cert
  - **Use Case:** Transparency on what materials ground the exam
- `GET /api/questions/low-quality` (admin only)
  - Returns: Questions with `quality_confidence < 0.7`
  - **Use Case:** Admin review queue

**Logging & Compliance:**

- All generation/validation events logged to Cloud Logging
- 90-day retention in Firestore `question_validation_logs` collection
- Immutable hash trail for tamper detection (Phase 3+)

---

## Three Implementation Strategies

### Strategy A: High Confidence (High-Stakes Certs)

**When to use:** AWS, GCP, Kubernetes, Azure (industry-critical)

| Factor              | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| **Retrieval**       | Deep analysis—all relevant source materials per topic  |
| **Validators**      | All 4 (correctness, difficulty, diversity, bias)       |
| **Threshold**       | `quality_confidence >= 0.85`                           |
| **Review**          | Automatic + optional expert review for < 0.80          |
| **Timeline**        | ~2 min per question                                    |
| **Cost**            | ~$0.08 per question (correctness validation expensive) |
| **Questions/Month** | 50-100 per cert                                        |

**Process:**

1. Retrieve 10+ relevant materials per topic
2. Run all 4 validators (quality-over-speed)
3. Filter to >= 0.85 confidence
4. Flag 0.80-0.85 for human review queue
5. Publish after expert approval or auto-publish if >= 0.85

---

### Strategy B: Balanced Speed (Most Certs)

**When to use:** Most certifications (IT, business, professional)

| Factor              | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| **Retrieval**       | Top 3 relevant materials per topic (keyword + topic match) |
| **Validators**      | Correctness + Difficulty (skip diversity initially)        |
| **Threshold**       | `quality_confidence >= 0.70`                               |
| **Review**          | None—auto-publish                                          |
| **Timeline**        | ~45 sec per question                                       |
| **Cost**            | ~$0.03 per question                                        |
| **Questions/Month** | 200-300 per cert                                           |

**Process:**

1. Keyword search on topic in `MaterialChunk` table
2. Return top 3 chunks
3. Run correctness + difficulty validators
4. Auto-publish if >= 0.70

---

### Strategy C: Volume Focus (New Certs / Rapid Expansion)

**When to use:** New certifications, fast scaling, initial question pool

| Factor              | Value                                        |
| ------------------- | -------------------------------------------- |
| **Retrieval**       | Auto-selected materials (keyword match only) |
| **Validators**      | Correctness only                             |
| **Threshold**       | `quality_confidence >= 0.65`                 |
| **Review**          | Batch manual review 48 hours later           |
| **Timeline**        | ~20 sec per question                         |
| **Cost**            | ~$0.01 per question                          |
| **Questions/Month** | 500+ per cert                                |

**Process:**

1. Simple keyword retrieval
2. Run correctness validator only
3. Auto-publish if >= 0.65 (published but marked "pending_review")
4. Batch 50-100 questions for manual review next day
5. Unpublish any failed reviews

**Admin Configuration:**

```prisma
Certification {
  generation_strategy: HIGH_CONFIDENCE | BALANCED_SPEED | VOLUME_FOCUS
}
```

---

## Three Audit Compliance Levels

### Level 1: Transparent Trail (MVP)

**For:** Early-stage, internal use

- ✅ Every question stores: `generation_prompt`, `source_material_id`, `validation_scores`
- ✅ Audit trail accessible via endpoint
- ✅ 30-day log retention in Firestore
- ✅ Admin dashboard shows all metadata
- ❌ No immutable hash chain
- ❌ No regulatory certifications

**Cost:** ~$50-100/month (Firestore storage)

---

### Level 2: Expert Review

**For:** Regulated or high-stakes certifications

- ✅ All Level 1 features
- ✅ Low-confidence questions route to review queue
- ✅ Domain experts approve/reject before publishing
- ✅ Reviewer feedback stored in `verification_notes`
- ✅ Toggle `is_verified` flag
- ❌ Not immutable (reviewer can change notes)

**Cost:** ~$100-200/month (storage + human workflow)

---

### Level 3: Full Compliance (Advanced)

**For:** Regulatory environments, audit trails for legal review

- ✅ All Level 2 features
- ✅ Immutable audit log (Cloud Audit Logs)
- ✅ Hash chain to detect tampering
- ✅ Monthly compliance certification reports
- ✅ Access control logs (who viewed what, when)
- ✅ Regulatory export format (standardized JSON)

**Cost:** ~$500-1000/month (advanced tooling + compliance overhead)

---

## Data Flow Diagram

```
┌──────────────────────────────┐
│ 1. Material Ingestion        │
│ (Scheduled nightly)          │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ PostgreSQL Tables:               │
│ - CertificationMaterial          │
│ - MaterialChunk                  │
│ (Indexed by cert_id, topic)      │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 2. User initiates exam generation    │
│ (getExamQuestions endpoint)          │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 3. Topic retrieval + grounding       │
│ - Fetch materials from MaterialChunk │
│ - Build prompt with facts            │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 4. Call Genkit (gemini-2.5-flash)    │
│ with grounded prompt                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 5. Run validation pipeline           │
│ - Correctness (GPT-4)                │
│ - Difficulty (Gemini)                │
│ - Diversity (Local)                  │
│ - Bias (Local)                       │
└──────────────┬──────────────────────┘
               │
               ▼
         ┌──────────────┐
         │ score >= 0.7?│
         └──────┬───────┘
                │
         ┌──────┴──────┐
         │             │
        ✅YES         ❌NO
         │             │
         ▼             ▼
      Store       Log failure
      Question    + Optionally retry
                  with materials
         │
         ▼
┌──────────────────────────────────────┐
│ 6. Store in QuizQuestion table:      │
│ - question_text, exam_topic          │
│ - source_material_id (FK)            │
│ - generation_prompt                  │
│ - validation_scores (JSON)           │
│ - quality_confidence (Float)         │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Users take exam                      │
│ → See question + explanation         │
│ → Can click "View audit trail"       │
│ → See: materials used, why generated │
└──────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (2–3 weeks)

1. **Extend Prisma schema:**
   - Add audit fields to `QuizQuestion`
   - Create `CertificationMaterial`, `MaterialChunk`, `QuestionValidationLog` tables
   - Add `generation_strategy` to `Certification`

2. **Build material ingestion MVP:**
   - `fetcher.ts` for HTTP fetch + basic parsing
   - `chunker.ts` for topic-based segmentation
   - Scheduled job for daily refresh (Cloud Scheduler)

3. **Implement validation validators:**
   - `correctnessValidator.ts` (GPT-4 API)
   - `difficultyAnalyzer.ts` (Gemini)
   - `diversityChecker.ts` (local string similarity)
   - `biasDetector.ts` (local)

4. **Write unit tests** for each validator

---

### Phase 2: Integration (2–3 weeks)

5. **Extend `quizGenerator.ts`:**
   - Add material retrieval step (query `MaterialChunk` by topic)
   - Inject facts into generation prompt
   - Pass `source_material_id` to output

6. **Integrate validation pipeline:**
   - Hook validators into `questionGeneration.ts`
   - Implement filtering by `quality_confidence` threshold
   - Log results to `QuestionValidationLog` table

7. **Create audit trail endpoints:**
   - `GET /api/questions/:id/audit-trail`
   - `GET /api/certifications/:id/material-sources`
   - Admin dashboard for low-quality questions

8. **Integration testing:**
   - Generate 10-question sample exam per cert
   - Verify audit metadata is complete
   - Test filtering by strategy

---

### Phase 3: Scaling & Optimization (1–2 weeks)

9. **Implement three strategies (A/B/C):**
   - Store strategy config in `Certification.generation_strategy`
   - Adjust retrieval depth, validator selection, thresholds per strategy
   - Document tradeoffs in decision tree

10. **Scale material ingestion:**
    - Handle 50+ certs with concurrent fetches
    - Implement deprecation alerts
    - Add material freshness monitoring

11. **Add compliance levels:**
    - Level 1 (MVP): Basic audit trail
    - Level 2: Expert review queue UI
    - Level 3 (Phase 4): Immutable hash chain

12. **Performance & cost optimization:**
    - Monitor question generation latency per strategy
    - Track validation costs (correctness validation most expensive)
    - Optimize material chunking for faster retrieval

---

### Phase 4: Advanced Features (Future)

13. **Semantic search optimization** (if retrieval phase is bottleneck):
    - Add OpenAI embeddings (text-embedding-3-small)
    - Store vectors in PostgreSQL (pgvector extension)
    - Replace keyword search with semantic similarity ranking

14. **Cross-certification knowledge mapping:**
    - Identify skill overlaps across certs
    - Reuse validated questions across similar domains
    - Build prerequisite graph

15. **Human-in-the-loop review UI:**
    - Frontend dashboard for domain experts
    - Approve/reject/edit questions before publishing
    - Feedback loop to improve generation

16. **Full compliance (Level 3):**
    - Immutable audit logs (Cloud Audit Logs)
    - Hash chain for tamper detection
    - Regulatory export format
    - Compliance certification reports

---

## Key Decisions & Tradeoffs

| Decision                              | Rationale                                                     | Alternative                                    |
| ------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| **No mandatory RAG/vectors**          | Simpler to audit, cheaper MVP. Add in Phase 4 if needed.      | Full RAG day 1: higher complexity, $200+/month |
| **Material-grounded, not pure AI**    | Filters hallucinations. Auditable sources.                    | Black-box generation: faster, less trustworthy |
| **Three weighted strategies (A/B/C)** | Different certs have different needs. Admin chooses per cert. | One-size-fits-all: slower or lower quality     |
| **Public data only**                  | Avoids licensing violations. Legally searchable compliance.   | Include proprietary materials: legal risk      |
| **Transparent audit trail**           | Enables regulator review without reverse-engineering.         | Opaque generation: hard to verify compliance   |
| **Modular validators**                | Each independent—swappable/upgradeable.                       | Monolithic pipeline: hard to iterate           |
| **Correctness = GPT-4/Claude**        | More reliable than Gemini for fact-checking.                  | All Gemini: cheaper but less accurate          |
| **Diversity check (optional in B/C)** | Saves cost in fast strategies. Worth it for Strategy A.       | Always run: higher cost, diminishing returns   |

---

## Further Considerations

### 1. Copyright & Legal Ownership

**Issue:** Generated questions inspired by public materials—legal ownership unclear

**Recommendation:**

- Tag all generated questions with `source_material_id` + generation timestamp
- Store `copyright_status` (PROPRIETARY | CC_LICENSED | FAIR_USE | PUBLIC_DOMAIN)
- If cert provider claims copyright, can retract with full traceability
- Document legal basis in `CertificationMaterial.copyright_status`

### 2. Correctness Validation at Scale

**Issue:** 600 questions/month × $0.05/Q = ~$30/month (small) but adds 2min latency per question

**Recommendation:**

- Use gemini-2.5-flash for generation (faster, cheaper)
- Use GPT-4/Claude only for validation (better reasoning) OR
- Batch validations async at night (reduce real-time latency)
- Cost-optimize: Process 100 questions nightly for $5/night

### 3. Material Freshness & Staleness

**Issue:** Official docs update monthly; generated questions become outdated (AWS docs change constantly)

**Recommendation:**

- Track `last_updated` per `MaterialChunk`
- Alert if material > 3 months old
- Auto-regenerate questions when material refreshes
- Implement `deprecated_at` field for versioning old questions

### 4. Material Retrieval Latency

**Issue:** Keyword search across 1000s of chunks could be slow

**Recommendation (Phase 4):**

- Add semantic embeddings if retrieval > 1 sec
- OpenAI text-embedding-3-small: ~$0.02 per 1M tokens (~$10-20/month)
- Store in PostgreSQL pgvector for fast similarity search
- Keep keyword fallback for cost optimization

### 5. Scaling to 50+ Certs

**Issue:** Material fetching, parsing, ingestion could be serial bottleneck

**Recommendation:**

- Parallel material ingestion (5-10 certs concurrently)
- Incremental updates (only new/changed materials)
- Use Cloud Tasks for distributed processing

---

## Success Metrics

| Metric                       | Target                                               | How to Measure                           |
| ---------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| **Generation latency**       | < 1 min per question (Strategy B)                    | Track `questionGeneration.ts` duration   |
| **Validation accuracy**      | > 90% of auto-published questions pass expert review | Spot-check 50 random questions monthly   |
| **Material freshness**       | > 90% of materials < 3 months old                    | Monitor `last_updated` field             |
| **Audit trail completeness** | 100% of questions have prompt + materials + scores   | Spot-check `audit-trail` endpoint        |
| **Cost per question**        | < $0.05 avg (Strategy B: $0.03)                      | Track validator API costs                |
| **Coverage**                 | Generate 100+ questions/month per cert               | Monitor `QuizQuestion.created_at` counts |
| **Quality confidence**       | > 70% of published questions >= 0.70 confidence      | Histogram of `quality_confidence`        |

---

## Conclusion

This plan balances **transparency**, **compliance**, and **scale** by:

1. ✅ **Grounding generation** in public materials (no hallucinations)
2. ✅ **Validating quality** with verifiable metrics (auditable)
3. ✅ **Automating at scale** (hundreds of questions/month)
4. ✅ **Remaining flexible** (three strategies for different needs)
5. ✅ **Supporting compliance** (full audit trail for regulators)

The phased approach starts simple (MVP) and adds complexity only when needed (Phase 4 embeddings), keeping initial development fast and reducing risk.
