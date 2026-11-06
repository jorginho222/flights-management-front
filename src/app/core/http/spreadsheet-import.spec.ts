import { HttpErrorResponse } from '@angular/common/http';
import { toImportError } from './spreadsheet-import';

describe('toImportError', () => {
  it('reads the per-row errors of a rejected file', () => {
    const rows = [
      { row: 2, column: 'name', messages: ['name must be longer than or equal to 3 characters'] },
      { row: 5, column: 'code', messages: ['code LA is already used in row 2'] },
    ];
    const error = new HttpErrorResponse({
      status: 400,
      error: { message: 'The file has invalid rows, so nothing was imported', errors: rows },
    });

    expect(toImportError(error)).toEqual({
      status: 400,
      messages: ['The file has invalid rows, so nothing was imported'],
      rows,
    });
  });

  it('has no rows for whole-file errors such as missing columns', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { message: 'The file is missing these columns: code' },
    });
    expect(toImportError(error)).toEqual({
      status: 400,
      messages: ['The file is missing these columns: code'],
      rows: [],
    });
  });

  it('skips malformed row entries', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { errors: [{ row: 2, column: 'code', messages: ['bad'] }, { row: 'x' }, null] },
    });
    expect(toImportError(error).rows).toEqual([{ row: 2, column: 'code', messages: ['bad'] }]);
  });

  it('handles unknown errors', () => {
    expect(toImportError(new Error('boom'))).toEqual({ status: 0, messages: [], rows: [] });
  });
});
