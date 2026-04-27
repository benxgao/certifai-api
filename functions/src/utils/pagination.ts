import { Request } from 'express';

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T;
  meta: PaginationMeta;
}

export interface PaginationOptions {
  defaultPageSize?: number;
  maxPageSize?: number;
  minPageSize?: number;
}

/**
 * Extracts and validates pagination parameters from request query
 */
export function extractPaginationParams(
  req: Request,
  options: PaginationOptions = {},
): PaginationParams {
  const { defaultPageSize = 10, maxPageSize = 100, minPageSize = 1 } = options;

  const pageParam = (typeof req.query.page === 'string' ? req.query.page : Array.isArray(req.query.page) ? req.query.page[0] : '') as string;
  const pageSizeParam = (typeof req.query.pageSize === 'string' ? req.query.pageSize : Array.isArray(req.query.pageSize) ? req.query.pageSize[0] : '') as string;

  let page = parseInt(pageParam, 10);
  let pageSize = parseInt(pageSizeParam, 10);

  // Validate and set defaults
  if (isNaN(page) || page <= 0) {
    page = 1;
  }

  if (isNaN(pageSize) || pageSize <= 0) {
    pageSize = defaultPageSize;
  }

  // Enforce limits
  if (pageSize > maxPageSize) {
    pageSize = maxPageSize;
  }

  if (pageSize < minPageSize) {
    pageSize = minPageSize;
  }

  const skip = (page - 1) * pageSize;
  const take = pageSize;

  return {
    page,
    pageSize,
    skip,
    take,
  };
}

/**
 * Creates pagination metadata
 */
export function createPaginationMeta(
  totalItems: number,
  currentPage: number,
  pageSize: number,
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };
}

/**
 * Creates a paginated response structure
 */
export function createPaginatedResponse<T>(
  data: T,
  totalItems: number,
  paginationParams: PaginationParams,
): PaginatedResponse<T> {
  const meta = createPaginationMeta(
    totalItems,
    paginationParams.page,
    paginationParams.pageSize,
  );

  return {
    success: true,
    data,
    meta,
  };
}

/**
 * Prisma pagination helper that includes both data and count
 */
export interface PrismaFindManyWithCount<T> {
  data: T[];
  total: number;
}

/**
 * Helper function to execute Prisma findMany with count in parallel
 */
export async function findManyWithCount<T>(
  findManyPromise: Promise<T[]>,
  countPromise: Promise<number>,
): Promise<PrismaFindManyWithCount<T>> {
  const [data, total] = await Promise.all([findManyPromise, countPromise]);
  return { data, total };
}
