import { Request, Response, NextFunction } from 'express';
import {
  extractPaginationParams,
  PaginationOptions,
} from '../utils/pagination';

/**
 * Middleware to extract and validate pagination parameters
 * Adds pagination parameters to req.pagination for use in route handlers
 */
export interface RequestWithPagination extends Request {
  pagination: {
    page: number;
    pageSize: number;
    skip: number;
    take: number;
  };
}

export function paginationMiddleware(options: PaginationOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const paginationParams = extractPaginationParams(req, options);
    (req as RequestWithPagination).pagination = paginationParams;
    next();
  };
}

/**
 * Pre-configured pagination middleware for different use cases
 */
export const smallPagePagination = paginationMiddleware({
  defaultPageSize: 5,
  maxPageSize: 20,
});

export const mediumPagePagination = paginationMiddleware({
  defaultPageSize: 10,
  maxPageSize: 50,
});

export const largePagePagination = paginationMiddleware({
  defaultPageSize: 20,
  maxPageSize: 100,
});

export const defaultPagination = mediumPagePagination;
