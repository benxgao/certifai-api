# Pagination Implementation Guide

This document explains the pagination system implemented across all API endpoints that return lists of data.

## Overview

The pagination system provides:

- Consistent pagination parameters across all endpoints
- Standardized response format with metadata
- Configurable page sizes and limits
- Optimized database queries with parallel count operations

## Pagination Response Format

All paginated endpoints now return data in this standardized format:

```json
{
  "success": true,
  "data": [...], // Your actual data array or object containing data
  "meta": {
    "currentPage": 1,
    "pageSize": 10,
    "totalItems": 150,
    "totalPages": 15,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

## Query Parameters

All paginated endpoints accept these query parameters:

- `page` (optional): Page number (starts from 1, defaults to 1)
- `pageSize` (optional): Number of items per page (defaults vary by endpoint, max is typically 50-100)

Example: `GET /api/certifications?page=2&pageSize=20`

## Endpoints with Pagination

### 1. Certifications

- **GET** `/api/certifications`
- Default page size: 10
- Max page size: 50
- Ordered by: `cert_id` (ascending)

### 2. User Certifications

- **GET** `/api/users/:user_id/certifications`
- Default page size: 10
- Max page size: 50
- Ordered by: `assigned_at` (descending)

### 3. User Exams

- **GET** `/api/users/:user_id/exams`
- Default page size: 10
- Max page size: 50
- Ordered by: `started_at` (descending)
- Additional filter: `cert_id` query parameter to filter by certification

### 4. Exam Questions

- **GET** `/api/users/:user_id/exams/:exam_id/questions`
- Default page size: 10
- Max page size: 100
- Ordered by: question creation date (ascending)

## Implementation Details

### Utilities Used

The pagination system uses several reusable utilities:

#### 1. `extractPaginationParams(req, options)`

Extracts and validates pagination parameters from request query strings.

#### 2. `createPaginatedResponse(data, totalItems, paginationParams)`

Creates the standardized paginated response format.

#### 3. `findManyWithCount(findManyPromise, countPromise)`

Executes Prisma findMany and count operations in parallel for optimal performance.

### Middleware

Pre-configured pagination middleware is available:

- `smallPagePagination`: 5 items/page (max 20)
- `mediumPagePagination`: 10 items/page (max 50)
- `largePagePagination`: 20 items/page (max 100)

### Example Usage in Route Handlers

```typescript
import {
  extractPaginationParams,
  createPaginatedResponse,
  findManyWithCount,
} from '../../../utils/pagination';

const handler = async (req: Request, res: Response) => {
  // Extract pagination parameters
  const paginationParams = extractPaginationParams(req, {
    defaultPageSize: 10,
    maxPageSize: 50,
  });

  // Execute query with pagination
  const { data, total } = await findManyWithCount(
    prisma.model.findMany({
      skip: paginationParams.skip,
      take: paginationParams.take,
      orderBy: { created_at: 'desc' },
    }),
    prisma.model.count(),
  );

  // Create paginated response
  const response = createPaginatedResponse(data, total, paginationParams);
  res.status(200).json(response);
};
```

## Error Handling

- Invalid page numbers (< 1) default to page 1
- Invalid page sizes (< 1) default to the endpoint's default page size
- Page sizes exceeding the maximum are capped at the maximum allowed
- Empty results return an empty array with appropriate metadata

## Performance Considerations

- Database queries use `skip` and `take` for efficient pagination
- Count operations run in parallel with data fetching
- Consistent ordering ensures stable pagination

## Migration from Old Format

Existing endpoints that returned simple arrays have been updated to return the new paginated format. Frontend applications should be updated to handle the new structure:

**Old format:**

```json
{
  "success": true,
  "data": [...]
}
```

**New format:**

```json
{
  "success": true,
  "data": [...],
  "meta": { ... }
}
```

## Future Enhancements

Potential improvements to consider:

1. **Cursor-based pagination** for large datasets
2. **Search and filtering** integration
3. **Sorting parameter** support
4. **Custom pagination configurations** per user/tenant
5. **Response caching** for frequently accessed pages
