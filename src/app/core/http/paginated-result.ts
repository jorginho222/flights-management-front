/** Mirrors the API's `PaginatedResult` (`src/shared/pagination/` in the backend). */
export interface PaginationMeta {
  /** Current page, from 1. */
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}
