import { HttpErrorResponse } from '@angular/common/http';

export interface ApiError {
  /** HTTP status, or 0 when the API could not be reached. */
  status: number;
  /** Messages fit to show users. Empty means the UI should show its generic message. */
  messages: string[];
}

/**
 * Normalizes Nest's `{ statusCode, message, error }` responses, where `message`
 * can be a string or a string[]. Only 4xx messages are kept: a 5xx message such as
 * "Internal server error" doesn't help the user.
 */
export function toApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: 0, messages: [] };
  }

  const isClientError = error.status >= 400 && error.status < 500;
  const message: unknown = error.error?.message;
  const messages = (Array.isArray(message) ? message : [message]).filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  );

  return { status: error.status, messages: isClientError ? messages : [] };
}
