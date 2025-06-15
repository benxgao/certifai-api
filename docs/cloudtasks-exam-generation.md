# Exam Question Generation with Cloud Tasks

This implementation uses Google Cloud Tasks to recursively generate exam questions in batches.

## How it works

1. **Exam Creation**: When a user creates an exam via `POST /api/users/{user_id}/exams`, the system:

   - Creates an exam record with status `QUESTIONS_GENERATING`
   - Calculates the number of batches needed (10 questions per batch)
   - Creates the first Cloud Task to generate the first batch

2. **Recursive Generation**: The task handler at `/delegators/tasks/take`:

   - Generates a batch of questions using the AI quiz generator
   - Stores the questions and answer options in the database
   - If more batches are needed, creates the next Cloud Task
   - If all batches are complete, updates exam status to `READY`

3. **Error Handling**: If any step fails, the exam status is updated to `QUESTION_GENERATION_FAILED`

## Configuration

- **Questions per batch**: 10 (configurable via `QUESTIONS_PER_BATCH` constant)
- **Queue name**: `exam-questions-queue`
- **Queue rate**: 10 tasks/second
- **Retry policy**: Up to 3 retries with exponential backoff

## Deployment

1. Deploy the queue:

   ```bash
   ./scripts/deploy-queues.sh
   ```

2. Deploy your Cloud Functions with the updated code

## API Usage

```javascript
// Create an exam with 50 questions
POST /api/users/{user_id}/exams
{
  "cert_id": 1,
  "numberOfQuestions": 50
}

// Response
{
  "success": true,
  "message": "Exam creation initiated. Questions are being generated asynchronously.",
  "data": {
    "exam_id": "uuid",
    "user_id": "uuid",
    "cert_id": 1,
    "status": "QUESTIONS_GENERATING",
    "total_questions": 50,
    "total_batches": 5
  }
}
```

The exam will be processed in 5 batches of 10 questions each. The client can poll the exam status to check when it's ready.

## Benefits

- **Scalable**: Can handle large numbers of questions without timeouts
- **Resilient**: Built-in retry mechanisms for failed tasks
- **Non-blocking**: API responds immediately while processing happens asynchronously
- **Configurable**: Easy to adjust batch sizes and queue settings
