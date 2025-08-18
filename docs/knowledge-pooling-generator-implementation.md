# Knowledge Pooling Generator

## Overview

The Knowledge Pooling Generator is an AI-powered feature that analyzes a user's incorrect answers across all completed exams for a specific certification and generates targeted learning insights and tips. This helps users understand their knowledge gaps and provides actionable advice to avoid similar mistakes in future exams.

## Architecture

### Data Flow

1. **Data Collection**: Fetch all incorrect answers from completed exams for a specific user and certification
2. **AI Analysis**: Use Genkit AI to analyze patterns in incorrect answers and generate knowledge insights
3. **Data Storage**: Store generated insights in Firestore for quick retrieval
4. **API Response**: Return structured knowledge insights to frontend

### Key Components

- **Service Layer**: `knowledgePoolingGenerator.ts` - AI service using Genkit
- **Data Layer**: `knowledgePoolingDataService.ts` - Database queries for incorrect answers
- **Storage Layer**: `knowledgePoolingFirestoreService.ts` - Firestore operations
- **API Layer**: `knowledgePoolingGenerator.ts` - Express route handler
- **Types**: `knowledgePooling.ts` - TypeScript type definitions

## API Endpoint

### POST `/api/ai/knowledge-pooling`

Generates knowledge pooling insights based on user's exam history.

#### Request Body

```json
{
  "cert_id": 123,
  "cert_name": "AWS Solutions Architect", // optional
  "user_id": "user_uuid_here",
  "force_regenerate": false // optional, default false
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "knowledge_insights": [
      {
        "topic": "VPC and Networking",
        "insights": [
          {
            "insight": "Remember that NAT Gateways are managed AWS services that provide high availability",
            "context": "You confused NAT instances with NAT Gateways. NAT Gateways are fully managed and automatically handle failover within an AZ."
          }
        ]
      }
    ],
    "summary": "Focus on VPC concepts, especially NAT Gateway vs NAT Instance differences, and review IAM policy structure.",
    "generated_at": "2025-08-18T10:30:00.000Z",
    "cert_id": 123,
    "certification_name": "AWS Solutions Architect",
    "total_incorrect_answers": 15,
    "topics_analyzed": 3
  },
  "message": "Knowledge pooling generated successfully",
  "cached": false
}
```

#### Error Responses

- **400 Bad Request**: Missing required fields
- **401 Unauthorized**: Invalid or missing authentication
- **404 Not Found**: Certification not found
- **500 Internal Server Error**: AI generation or database errors

## Data Structure

### Firestore Storage

Data is stored in Firestore at path: `users/{api_user_id}/certs/{cert_id}`

```json
{
  "knowledge_pooling": {
    "knowledge_insights": [...],
    "summary": "...",
    "generated_at": "2025-08-18T10:30:00.000Z",
    "last_updated": "2025-08-18T10:30:00.000Z",
    "cert_id": 123,
    "certification_name": "AWS Solutions Architect",
    "total_incorrect_answers": 15,
    "topics_analyzed": 3
  }
}
```

### Database Queries

The service queries the following tables:

- `ExamUserAnswer` - User's answers to questions
- `ExamAttempt` - Exam attempts and submission status
- `QuizQuestion` - Question details and topics
- `AnswerOption` - Answer choices and correct answers

## Features

### Intelligent Analysis

- **Topic Grouping**: Groups incorrect answers by exam topic
- **Difficulty Analysis**: Analyzes mistakes across different difficulty levels
- **Pattern Recognition**: Identifies common misconceptions and error patterns
- **Contextual Insights**: Provides specific tips based on actual mistakes made

### Caching Strategy

- **Smart Caching**: Automatically caches results for 7 days
- **Force Regeneration**: Option to force fresh analysis
- **Firestore Integration**: Uses Firestore for persistent storage
- **Performance Optimization**: Returns cached data when available

### Error Handling

- **Graceful Degradation**: Handles cases with no incorrect answers
- **Validation**: Comprehensive input validation
- **Logging**: Detailed logging for debugging and monitoring
- **Fallback**: Returns structured empty response when no mistakes found

## Usage Examples

### Generate Fresh Knowledge Pooling

```bash
curl -X POST "/api/ai/knowledge-pooling" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "cert_id": 123,
    "user_id": "user_uuid",
    "force_regenerate": true
  }'
```

### Get Cached Knowledge Pooling

```bash
curl -X POST "/api/ai/knowledge-pooling" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "cert_id": 123,
    "user_id": "user_uuid"
  }'
```

## Integration Points

### With Exam Report Generator

The Knowledge Pooling Generator complements the Exam Report Generator:

- **Exam Report**: Analyzes single exam performance
- **Knowledge Pooling**: Analyzes patterns across all exam history

### With Frontend Display

The frontend can use this data to:

- Display topic-specific learning tips
- Show progress in addressing knowledge gaps
- Provide focused study recommendations
- Track improvement over time

## Performance Considerations

- **Database Optimization**: Uses indexed queries for efficient data retrieval
- **AI Token Management**: Optimized prompts to minimize AI token usage
- **Caching**: Reduces repeated AI calls for same data
- **Pagination**: Handles large datasets efficiently

## Security

- **Authentication Required**: All requests must include valid JWT token
- **User Isolation**: Users can only access their own data
- **Input Validation**: Comprehensive validation of all inputs
- **Error Sanitization**: No sensitive data exposed in error messages

## Monitoring and Logging

- **Generation Tracking**: Logs start/completion of AI generation
- **Performance Metrics**: Tracks generation time and success rates
- **Error Logging**: Detailed error logging for troubleshooting
- **Usage Analytics**: Tracks API usage patterns

## Future Enhancements

1. **Real-time Updates**: Update knowledge pooling when new exams are completed
2. **Difficulty Progression**: Track improvement in specific difficulty levels
3. **Study Plan Integration**: Generate study plans based on knowledge gaps
4. **Comparative Analysis**: Compare performance with other users (anonymized)
5. **Export Options**: Allow users to export their knowledge insights
