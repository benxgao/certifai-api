# Firms and Certifications API - Paginated Endpoints

This document describes the paginated API endpoints for firms and their certifications.

## Overview

All firm-related endpoints now support pagination with consistent response structures. The API provides efficient querying with pagination metadata to help with frontend implementation.

## Firms Endpoints

### 1. Get All Firms (Paginated)

**Endpoint:** `GET /api/firms`

**Authentication:** Not required

**Features:**

- Supports pagination with configurable page size
- Optional certification counts via `includeCount=true` query parameter
- Returns paginated response with metadata

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Number of items per page (default: 10, max: 50)
- `includeCount` (optional): Include certification counts for each firm (default: false)

**Response Example:**

```json
{
  "data": [
    {
      "firm_id": 1,
      "name": "Amazon Web Services",
      "code": "AWS",
      "description": "Leading cloud platform provider",
      "website_url": "https://aws.amazon.com",
      "logo_url": "https://...",
      "created_at": "...",
      "updated_at": "...",
      "_count": {
        "certifications": 15
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

### 2. Search Firms (Paginated)

**Endpoint:** `GET /api/firms/search`

**Authentication:** Not required

**Features:**

- Search by firm name, code, or description
- Supports pagination
- Case-insensitive search

**Query Parameters:**

- `q` (required): Search query string
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Number of items per page (default: 10, max: 50)

**Response Example:**

```json
{
  "data": [
    {
      "firm_id": 1,
      "name": "Amazon Web Services",
      "code": "AWS",
      "description": "Leading cloud platform provider",
      "website_url": "https://aws.amazon.com",
      "logo_url": "https://...",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 3,
    "totalPages": 1
  }
}
```

### 3. Get Firm by ID

**Endpoint:** `GET /api/firms/:firmId`

**Authentication:** Not required

**Features:**

- Get detailed firm information
- Optional certifications via `includeCertifications=true` query parameter
- No pagination (single resource)

**Query Parameters:**

- `includeCertifications` (optional): Include full certifications list (default: false)

**Response Example:**

```json
{
  "success": true,
  "data": {
    "firm_id": 1,
    "name": "Amazon Web Services",
    "code": "AWS",
    "description": "Leading cloud platform provider",
    "website_url": "https://aws.amazon.com",
    "logo_url": "https://...",
    "created_at": "...",
    "updated_at": "...",
    "certifications": [
      {
        "cert_id": 1,
        "name": "AWS Certified Solutions Architect",
        "exam_guide_url": "https://...",
        "min_quiz_counts": 10,
        "max_quiz_counts": 50,
        "pass_score": 75.0
      }
    ]
  }
}
```

## Certifications Endpoints

### 1. Get Certifications by Firm ID (Paginated)

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

### 2. Get Certifications by Firm ID (Alternative Paginated)

**Endpoint:** `GET /api/firms/:firmId/certifications`

**Authentication:** Not required

**Features:**

- Paginated response
- Efficient querying for certifications only
- Faster response for certification lists

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
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 15,
    "totalPages": 2
  }
}
```

## Error Responses

All endpoints return appropriate error responses:

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

1. **`/src/endpoints/api/firms/index.ts`** - Updated with pagination support
2. **`/src/endpoints/api/firms/certifications.ts`** - Updated with pagination support
3. **`/src/endpoints/api/certifications/getByFirmId.ts`** - Paginated endpoint
4. **`/src/services/firms/index.ts`** - Added `getCertificationsByFirmId` method
5. **`/src/endpoints/api/index.ts`** - Route registration with pagination middleware

### Database Queries:

- All endpoints validate parameters and firm existence before querying
- Results are ordered consistently (by name for firms/certifications)
- Efficient count queries for pagination metadata
- Proper indexing is utilized via existing database indexes

## Pagination Consistency

All paginated endpoints follow the same pattern:

1. **Request Parameters:**

   - `page`: Page number (1-based)
   - `pageSize`: Items per page (default: 10, max: 50)

2. **Response Structure:**

   - `data`: Array of results
   - `pagination`: Metadata object with `page`, `pageSize`, `total`, `totalPages`

3. **Error Handling:**
   - Consistent error response format
   - Appropriate HTTP status codes
   - Detailed error logging

## Usage Recommendations

- Use **GET /api/firms** for listing all firms with optional certification counts
- Use **GET /api/firms/search** for searching firms by name, code, or description
- Use **GET /api/firms/:firmId** for detailed firm information with optional certifications
- Use **GET /api/certifications/firms/:firmId** when authentication is available and you need firm details with each certification
- Use **GET /api/firms/:firmId/certifications** for public access to firm certifications only

All paginated endpoints are optimized for performance and provide consistent user experiences across the API.
