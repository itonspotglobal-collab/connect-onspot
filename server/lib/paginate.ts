/**
 * Pagination helpers — Phase 3 of scalability readiness.
 *
 * Usage (page-based):
 *   const { page, pageSize } = parsePagination(req.query);
 *   const { items, meta } = await paginateQuery({ query, page, pageSize, countQuery });
 *
 * Usage (cursor-based):
 *   const { cursor, pageSize } = parseCursorPagination(req.query);
 *   const { items, nextCursor } = applyCursorPagination(allItems, cursor, pageSize);
 */

import type { Request } from 'express';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PagedResult<T> {
  items: T[];
  meta: PageMeta;
}

export interface CursorResult<T> {
  items: T[];
  nextCursor: string | null;
  pageSize: number;
}

/**
 * Parse and validate page + pageSize from query string.
 * Clamps to safe values — never throws.
 */
export function parsePagination(query: Request['query']): { page: number; pageSize: number } {
  let page = parseInt(String(query.page ?? '1'), 10);
  let pageSize = parseInt(String(query.pageSize ?? String(DEFAULT_PAGE_SIZE)), 10);

  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  return { page, pageSize };
}

/**
 * Apply in-memory page/offset slicing to a full result set.
 * Prefer server-side LIMIT/OFFSET when possible; use this only
 * when you already have a small bounded set.
 */
export function pageSlice<T>(items: T[], page: number, pageSize: number): PagedResult<T> {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const sliced = items.slice(start, start + pageSize);
  return {
    items: sliced,
    meta: { page, pageSize, total, totalPages },
  };
}

/**
 * Parse cursor from query string.
 */
export function parseCursorPagination(query: Request['query']): {
  cursor: string | null;
  pageSize: number;
} {
  const cursor = query.cursor ? String(query.cursor) : null;
  let pageSize = parseInt(String(query.pageSize ?? String(DEFAULT_PAGE_SIZE)), 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;
  return { cursor, pageSize };
}

/**
 * Apply cursor-based pagination to a pre-sorted list (ascending by id or createdAt).
 * Items must be sorted with oldest-first so cursor points to the last seen id.
 */
export function applyCursorPagination<T extends { id: string | number }>(
  items: T[],
  cursor: string | null,
  pageSize: number,
): CursorResult<T> {
  let startIndex = 0;
  if (cursor) {
    const idx = items.findIndex((item) => String(item.id) === cursor);
    startIndex = idx >= 0 ? idx + 1 : 0;
  }
  const page = items.slice(startIndex, startIndex + pageSize);
  const nextCursor = page.length === pageSize ? String(page[page.length - 1].id) : null;
  return { items: page, nextCursor, pageSize };
}

/**
 * Standardise a paginated JSON response shape.
 */
export function paginatedResponse<T>(result: PagedResult<T> | CursorResult<T>) {
  return result;
}
