import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, toApiError } from '../../../core/http/api-error';
import { AirlineImportRowError } from './airline.model';

export interface AirlineImportError extends ApiError {
  /** Per-row problems, present when the API rejected rows of the file. */
  rows: AirlineImportRowError[];
}

const isRowError = (value: unknown): value is AirlineImportRowError =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as AirlineImportRowError).row === 'number' &&
  typeof (value as AirlineImportRowError).column === 'string' &&
  Array.isArray((value as AirlineImportRowError).messages);

/** Adds the `errors` array that POST /airlines/import returns for invalid rows. */
export function toAirlineImportError(error: unknown): AirlineImportError {
  const apiError = toApiError(error);
  const errors: unknown =
    error instanceof HttpErrorResponse && apiError.status === 400 ? error.error?.errors : undefined;
  return { ...apiError, rows: Array.isArray(errors) ? errors.filter(isRowError) : [] };
}
