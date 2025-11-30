/**
 * Pagination Types
 *
 * Standard pagination metadata and response wrappers used across all API endpoints.
 *
 * @module types/api/pagination
 */

/**
 * Pagination metadata for paginated responses
 *
 * Standard pagination information returned with all paginated API responses.
 * Helps clients implement infinite scroll, page navigation, and loading states.
 */
export interface PaginationMetadata {
  /** Current page number (1-indexed) */
  page: number;

  /** Number of items per page */
  perPage: number;

  /** Total number of items across all pages */
  total: number;

  /** Total number of pages */
  totalPages: number;

  /** Whether there are more pages available (page < totalPages) */
  hasMore: boolean;
}

/**
 * Generic paginated response wrapper
 *
 * Wraps any data type with pagination metadata.
 *
 * @template T - The type of data being paginated
 */
export interface PaginatedResponse<T> {
  /** The paginated data */
  data: T;

  /** Pagination metadata */
  pagination: PaginationMetadata;
}

/**
 * Calculate total pages from total items and items per page
 *
 * @param total - Total number of items
 * @param perPage - Items per page
 * @returns Total number of pages (minimum 1)
 */
export function calculateTotalPages(total: number, perPage: number): number {
  if (perPage <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(total / perPage));
}

/**
 * Check if there are more pages
 *
 * @param page - Current page (1-indexed)
 * @param totalPages - Total number of pages
 * @returns True if more pages exist
 */
export function hasMorePages(page: number, totalPages: number): boolean {
  return page < totalPages;
}

/**
 * Create pagination metadata from page parameters
 *
 * @param page - Current page (1-indexed)
 * @param perPage - Items per page
 * @param total - Total number of items
 * @returns Pagination metadata object
 */
export function createPaginationMetadata(
  page: number,
  perPage: number,
  total: number,
): PaginationMetadata {
  const totalPages = calculateTotalPages(total, perPage);
  const hasMore = hasMorePages(page, totalPages);

  return {
    page,
    perPage,
    total,
    totalPages,
    hasMore,
  };
}
