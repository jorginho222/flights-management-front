import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error';

const response = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('toApiError', () => {
  it('reads message as a string', () => {
    expect(toApiError(response(409, { message: 'Code already exists' }))).toEqual({
      status: 409,
      messages: ['Code already exists'],
    });
  });

  it('reads message as a string array', () => {
    expect(toApiError(response(400, { message: ['a', 'b'] })).messages).toEqual(['a', 'b']);
  });

  it('returns no messages when message is missing or the body is empty', () => {
    expect(toApiError(response(400, {})).messages).toEqual([]);
    expect(toApiError(response(400, null)).messages).toEqual([]);
  });

  it('hides 5xx messages', () => {
    expect(toApiError(response(500, { message: 'Internal server error' }))).toEqual({
      status: 500,
      messages: [],
    });
  });

  it('handles an unreachable API and unknown errors', () => {
    expect(toApiError(response(0, new ProgressEvent('error')))).toEqual({
      status: 0,
      messages: [],
    });
    expect(toApiError(new Error('boom'))).toEqual({ status: 0, messages: [] });
  });
});
