/**
 * Simple test utilities for pagination functions
 * This can be used to manually test pagination utilities
 */

import {
  extractPaginationParams,
  createPaginatedResponse,
  createPaginationMeta,
} from './pagination';

// Mock Express Request object for testing
interface MockRequest {
  query: { [key: string]: string | undefined };
}

export function testPaginationExtraction() {
  console.log('Testing pagination parameter extraction...');

  // Test 1: Default values
  const req1: MockRequest = { query: {} };
  const params1 = extractPaginationParams(req1 as any);
  console.log('Test 1 (defaults):', params1);
  // Expected: { page: 1, pageSize: 10, skip: 0, take: 10 }

  // Test 2: Valid parameters
  const req2: MockRequest = { query: { page: '3', pageSize: '20' } };
  const params2 = extractPaginationParams(req2 as any);
  console.log('Test 2 (valid params):', params2);
  // Expected: { page: 3, pageSize: 20, skip: 40, take: 20 }

  // Test 3: Invalid parameters
  const req3: MockRequest = { query: { page: 'invalid', pageSize: '-5' } };
  const params3 = extractPaginationParams(req3 as any);
  console.log('Test 3 (invalid params):', params3);
  // Expected: { page: 1, pageSize: 10, skip: 0, take: 10 }

  // Test 4: Exceeding limits
  const req4: MockRequest = { query: { page: '1', pageSize: '200' } };
  const params4 = extractPaginationParams(req4 as any, { maxPageSize: 50 });
  console.log('Test 4 (exceeding limits):', params4);
  // Expected: { page: 1, pageSize: 50, skip: 0, take: 50 }
}

export function testPaginationMeta() {
  console.log('\nTesting pagination meta creation...');

  // Test 1: First page with results
  const meta1 = createPaginationMeta(100, 1, 10);
  console.log('Test 1 (first page):', meta1);
  // Expected: { currentPage: 1, pageSize: 10, totalItems: 100, totalPages: 10, hasNextPage: true, hasPreviousPage: false }

  // Test 2: Middle page
  const meta2 = createPaginationMeta(100, 5, 10);
  console.log('Test 2 (middle page):', meta2);
  // Expected: { currentPage: 5, pageSize: 10, totalItems: 100, totalPages: 10, hasNextPage: true, hasPreviousPage: true }

  // Test 3: Last page
  const meta3 = createPaginationMeta(100, 10, 10);
  console.log('Test 3 (last page):', meta3);
  // Expected: { currentPage: 10, pageSize: 10, totalItems: 100, totalPages: 10, hasNextPage: false, hasPreviousPage: true }

  // Test 4: Empty results
  const meta4 = createPaginationMeta(0, 1, 10);
  console.log('Test 4 (empty results):', meta4);
  // Expected: { currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false }
}

export function testPaginatedResponse() {
  console.log('\nTesting paginated response creation...');

  const mockData = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
    { id: 3, name: 'Item 3' },
  ];

  const paginationParams = {
    page: 2,
    pageSize: 3,
    skip: 3,
    take: 3,
  };

  const response = createPaginatedResponse(mockData, 25, paginationParams);
  console.log('Paginated response:', JSON.stringify(response, null, 2));
  // Expected: Proper structure with success: true, data: mockData, and meta with pagination info
}

// Uncomment to run tests
// testPaginationExtraction();
// testPaginationMeta();
// testPaginatedResponse();
