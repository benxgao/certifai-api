# Certifications by Firm ID - API Endpoints

This document describes the new endpoints created to get certifications based on firm_id.

## Overview

Two new endpoints have been created to provide different ways of retrieving certifications for a specific firm:

## Endpoints

### 1. Paginated Certifications by Firm ID

**Endpoint:** `GET /api/certifications/firms/:firmId`

**Authentication:** Required (Firebase token)

**Features:**

- Supports pagination with configurable page size
- Includes firm information in each certification object
- Returns paginated response with metadata

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Number of items per page (default: 10, max: 50)

**Response Example:**

```json
{
  "data": [
    {
      "cert_id": 1,
      "firm_id": 1,
      "name": "AWS Certified Solutions Architect",
      "exam_guide_url": "https://...",
      "min_quiz_counts": 10,
      "max_quiz_counts": 50,
      "pass_score": 75.0,
      "firm": {
        "firm_id": 1,
        "name": "Amazon Web Services",
        "code": "AWS",
        "description": "...",
        "website_url": "https://aws.amazon.com",
        "logo_url": "https://...",
        "created_at": "...",
        "updated_at": "..."
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 15,
    "totalPages": 2
  }
}
```

### 2. Simple Certifications by Firm ID

**Endpoint:** `GET /api/firms/:firmId/certifications`

**Authentication:** Not required

**Features:**

- Simple, non-paginated response
- Returns all certifications for the firm
- Includes firm information separately
- Faster response for smaller datasets

**Response Example:**

```json
{
  "success": true,
  "data": [
    {
      "cert_id": 1,
      "firm_id": 1,
      "name": "AWS Certified Solutions Architect",
      "exam_guide_url": "https://...",
      "min_quiz_counts": 10,
      "max_quiz_counts": 50,
      "pass_score": 75.0
    },
    {
      "cert_id": 2,
      "firm_id": 1,
      "name": "AWS Certified Developer",
      "exam_guide_url": "https://...",
      "min_quiz_counts": 8,
      "max_quiz_counts": 40,
      "pass_score": 70.0
    }
  ],
  "firm": {
    "firm_id": 1,
    "name": "Amazon Web Services",
    "code": "AWS",
    "description": "...",
    "website_url": "https://aws.amazon.com",
    "logo_url": "https://...",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

## Error Responses

Both endpoints return appropriate error responses:

### 400 Bad Request

```json
{
  "success": false,
  "error": "Invalid firm ID. Must be a number."
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "Firm not found"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Error message details"
}
```

## Implementation Details

### Files Created/Modified:

1. **`/src/endpoints/api/certifications/getByFirmId.ts`** - Paginated endpoint
2. **`/src/endpoints/api/firms/certifications.ts`** - Simple endpoint
3. **`/src/services/firms/index.ts`** - Added `getCertificationsByFirmId` method
4. **`/src/endpoints/api/index.ts`** - Route registration

### Database Queries:

- Both endpoints validate that the firm exists before querying certifications
- Certifications are ordered by name (ascending)
- The paginated endpoint uses efficient count queries
- Proper indexing is utilized via the existing firm_id index on certifications

## Usage Recommendations

- Use the **paginated endpoint** (`/api/certifications/firms/:firmId`) when:

  - You need authentication
  - Working with firms that have many certifications
  - Building user interfaces that need pagination
  - You need firm details included with each certification

- Use the **simple endpoint** (`/api/firms/:firmId/certifications`) when:
  - You don't need authentication
  - Working with firms that have few certifications
  - You need a faster, simpler response
  - You want firm details separate from certifications list
