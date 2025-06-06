# Exam Question Generation Refactoring

## Overview

This refactoring transforms the exam creation process from synchronous to asynchronous by introducing a message queue-based architecture for generating exam questions. The system now creates exams immediately and generates questions asynchronously using Google's Genkit AI service.

## Architecture

```
Client Request → Create Exam API → Pub/Sub Message → Cloud Function → AI Generation → Database Storage
```

### Components

1. **Create Exam API** (`createExam.ts`)

   - Creates exam record with `PENDING_QUESTIONS` status
   - Publishes message to Pub/Sub topic for question generation
   - Returns immediately with exam ID

2. **Pub/Sub Topic**: `generate-exam-questions-topic`

   - Decouples exam creation from question generation
   - Enables scaling and fault tolerance

3. **Cloud Function** (`generateAndStoreExamQuestions`)

   - Triggered by Pub/Sub messages
   - Handles question generation and storage

4. **Question Generation Handler** (`examQuestionsHandler.ts`)
   - Uses Genkit AI to generate questions
   - Handles batching for large question counts
   - Stores questions and creates exam-question relationships

## Database Schema Changes

### New Exam Status Enum

```prisma
enum ExamStatus {
  PENDING_QUESTIONS
  QUESTIONS_GENERATING
  READY
  IN_PROGRESS
  COMPLETED
  QUESTION_GENERATION_FAILED
}
```

### Updated Exams Model

```prisma
model Exams {
  exam_id String @id @default(uuid())
  user_id String
  cert_id Int

  exam_status      ExamStatus @default(PENDING_QUESTIONS)
  total_questions  Int?
  score            Float?
  started_at       DateTime  @default(now())
  submitted_at     DateTime?

  // ... relations
}
```

### Updated QuizQuestions Model

- Removed direct `exam_id` foreign key
- Made `topic_id` and `difficulty` optional
- Questions are now linked to exams via `ExamUserAnswers`

## API Flow

### 1. Create Exam

```
POST /api/users/{user_id}/exams
{
  "cert_id": 1,
  "numberOfQuestions": 50
}
```

**Response (202 Accepted):**

```json
{
  "success": true,
  "message": "Exam creation initiated. Questions are being generated asynchronously.",
  "data": {
    "exam_id": "uuid",
    "user_id": "user_uuid",
    "cert_id": 1,
    "status": "PENDING_QUESTIONS",
    "total_questions": 50
  }
}
```

### 2. Check Exam Status

The client can poll the existing exam endpoints to check when `exam_status` becomes `READY`.

### 3. Get Exam Questions

```
GET /api/users/{user_id}/exams/{exam_id}/questions?page=1&pageSize=20
```

This endpoint remains unchanged but now works with the new async-generated questions.

## Message Queue Processing

### Message Format

```typescript
interface QuestionGenerationMessage {
  exam_id: string;
  cert_id: number;
  certification_name: string;
  number_of_questions_to_generate: number;
}
```

### Processing Steps

1. **Receive Message**: Cloud Function triggered by Pub/Sub
2. **Update Status**: Set exam status to `QUESTIONS_GENERATING`
3. **Generate Questions**: Call Genkit AI in batches (max 50 per batch)
4. **Store Questions**: Save to database with proper relationships
5. **Update Status**: Set exam status to `READY` or `QUESTION_GENERATION_FAILED`

## Scalability Features

### Batching

- Questions generated in batches of up to 50
- For 100+ questions, multiple AI calls are made automatically
- Each batch is processed sequentially to avoid rate limits

### Error Handling

- Failed generations update exam status to `QUESTION_GENERATION_FAILED`
- Pub/Sub retries failed messages automatically
- Detailed logging for debugging

### Topic Management

- Automatically creates topics for new question subjects
- Links topics to certifications via `CertTopic` junction table

## Deployment

### Prerequisites

1. **Pub/Sub Topic**: Ensure `generate-exam-questions-topic` exists
2. **IAM Permissions**: Service account needs Pub/Sub publish/subscribe permissions
3. **Environment Variables**: `GOOGLE_GENAI_API_KEY` must be configured

### Firebase Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

### Database Migration

```bash
cd functions
npx prisma migrate deploy
```

## Configuration

### Pub/Sub Settings

- **Acknowledgment Deadline**: 10 minutes (600 seconds)
- **Max Delivery Attempts**: 5
- **Retry Policy**: Exponential backoff

### AI Generation Limits

- **Max Questions per Batch**: 50
- **Temperature**: 0.7 (balanced creativity/consistency)
- **Model**: Gemini 2.0 Flash

## Monitoring

### Exam Status Tracking

Monitor exam status distribution:

- `PENDING_QUESTIONS`: Just created, waiting for processing
- `QUESTIONS_GENERATING`: Currently being processed
- `READY`: Available for user to start
- `QUESTION_GENERATION_FAILED`: Requires manual intervention

### Metrics to Monitor

1. **Queue Depth**: Messages waiting in Pub/Sub topic
2. **Processing Time**: Time from exam creation to READY status
3. **Success Rate**: Percentage of successful question generations
4. **AI API Usage**: Genkit API calls and costs

## Error Recovery

### Common Issues

1. **AI Service Timeout**: Automatic retry via Pub/Sub
2. **Database Connection Issues**: Function will retry automatically
3. **Invalid Certification**: Exam marked as failed, manual review needed

### Manual Recovery

For failed exams, you can:

1. Check logs for specific error details
2. Re-publish message to topic manually
3. Update exam status and retry generation

## Benefits

1. **Improved Response Time**: Exams created instantly
2. **Better Scalability**: Can handle concurrent exam creations
3. **Fault Tolerance**: Failed generations don't block exam creation
4. **Resource Efficiency**: AI processing happens asynchronously
5. **Better User Experience**: No waiting for question generation

## Migration Notes

- Existing exams continue to work without changes
- `getExamQuestions.ts` updated to handle nullable fields
- All new exams use the async generation process
- Database supports both old and new question structures during transition
