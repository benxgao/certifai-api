# Public API Documentation

This document describes the public API endpoints for accessing firms and certifications data.

## Authentication

All public API endpoints require JWT authentication. You need to:

1. First obtain a JWT token using the token generation endpoint
2. Include the token in the Authorization header for all requests

### Generate JWT Token

**Endpoint:** `POST /api/auth/generate-token`

**Headers:**

- `Authorization: Bearer <firebase-token>` (Firebase authentication required)
- `Content-Type: application/json`

**Request Body:**

```json
{
  "clientId": "your-client-id",
  "scope": "public:read",
  "expiresIn": "24h"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "type": "Bearer",
    "expiresIn": "24h",
    "scope": "public:read"
  }
}
```

## Public Endpoints

All public endpoints require the JWT token in the Authorization header:

```
Authorization: Bearer <jwt-token>
```

### Firms

#### Get All Firms

**Endpoint:** `GET /api/public/firms`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 10, max: 50)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "firm_id": 1,
      "name": "Amazon Web Services",
      "code": "AWS",
      "description": "Cloud computing platform",
      "website_url": "https://aws.amazon.com",
      "logo_url": "https://example.com/aws-logo.png",
      "created_at": "2024-01-01T00:00:00.000Z",
      "_count": {
        "certifications": 15
      }
    }
  ],
  "meta": {
    "currentPage": 1,
    "pageSize": 10,
    "totalItems": 5,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

#### Get Firm by ID

**Endpoint:** `GET /api/public/firms/:firmId`

**Response:**

```json
{
  "data": {
    "firm_id": 1,
    "name": "Amazon Web Services",
    "code": "AWS",
    "description": "Cloud computing platform",
    "website_url": "https://aws.amazon.com",
    "logo_url": "https://example.com/aws-logo.png",
    "created_at": "2024-01-01T00:00:00.000Z",
    "_count": {
      "certifications": 15
    }
  }
}
```

#### Get Certifications by Firm

**Endpoint:** `GET /api/public/firms/:firmId/certifications`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 10, max: 50)

### Certifications

#### Get All Certifications

**Endpoint:** `GET /api/public/certifications`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 10, max: 50)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "cert_id": 1,
      "name": "AWS Solutions Architect Associate",
      "exam_guide_url": "https://aws.amazon.com/certification/certified-solutions-architect-associate/",
      "min_quiz_counts": 50,
      "max_quiz_counts": 100,
      "pass_score": 72.0,
      "firm": {
        "firm_id": 1,
        "name": "Amazon Web Services",
        "code": "AWS",
        "logo_url": "https://example.com/aws-logo.png"
      }
    }
  ],
  "meta": {
    "currentPage": 1,
    "pageSize": 10,
    "totalItems": 25,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

#### Get Certification by ID

**Endpoint:** `GET /api/public/certifications/:certId`

**Response:**

```json
{
  "data": {
    "cert_id": 1,
    "name": "AWS Solutions Architect Associate",
    "exam_guide_url": "https://aws.amazon.com/certification/certified-solutions-architect-associate/",
    "min_quiz_counts": 50,
    "max_quiz_counts": 100,
    "pass_score": 72.0,
    "firm": {
      "firm_id": 1,
      "name": "Amazon Web Services",
      "code": "AWS",
      "description": "Cloud computing platform",
      "website_url": "https://aws.amazon.com",
      "logo_url": "https://example.com/aws-logo.png"
    }
  }
}
```

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid authorization header"
}
```

### 404 Not Found

```json
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal Server Error",
  "message": "Failed to fetch data"
}
```

## Environment Setup

Add the following environment variable to your `.env` file:

```bash
PUBLIC_JWT_SECRET="your-secret-key-here-minimum-32-characters-long"
```

Make sure the secret is at least 32 characters long for security.

## Usage Example

### 1. Get JWT Token (requires Firebase authentication)

```bash
curl -X POST http://localhost:5001/certifai-prod/us-central1/api/api/auth/generate-token \
  -H "Authorization: Bearer <firebase-token>" \
  -H "Content-Type: application/json" \
  -d '{"clientId": "my-app", "expiresIn": "24h"}'
```

### 2. Use JWT Token to Access Public API

```bash
curl -X GET http://localhost:5001/certifai-prod/us-central1/api/api/public/firms \
  -H "Authorization: Bearer <jwt-token>"
```

### 3. Get Specific Certification

```bash
curl -X GET http://localhost:5001/certifai-prod/us-central1/api/api/public/certifications/1 \
  -H "Authorization: Bearer <jwt-token>"
```
