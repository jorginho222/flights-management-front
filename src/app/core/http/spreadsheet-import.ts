import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, toApiError } from './api-error';

/** The API's upload limit for `POST /<resource>/import`. */
export const MAX_IMPORT_FILE_BYTES = 1024 * 1024;

export interface ImportResult {
  imported: number;
}

/** One problem in an uploaded spreadsheet. `row` is the spreadsheet row number. */
export interface ImportRowError {
  row: number;
  column: string;
  messages: string[];
}

export interface ImportError extends ApiError {
  /** Per-row problems, present when the API rejected rows of the file. */
  rows: ImportRowError[];
}

const isRowError = (value: unknown): value is ImportRowError =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ImportRowError).row === 'number' &&
  typeof (value as ImportRowError).column === 'string' &&
  Array.isArray((value as ImportRowError).messages);

/** Adds the `errors` array that the import endpoints return for invalid rows. */
export function toImportError(error: unknown): ImportError {
  const apiError = toApiError(error);
  const errors: unknown =
    error instanceof HttpErrorResponse && apiError.status === 400 ? error.error?.errors : undefined;
  return { ...apiError, rows: Array.isArray(errors) ? errors.filter(isRowError) : [] };
}
