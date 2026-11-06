import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { translocoTesting } from '../../../core/i18n/transloco-testing';
import { AirlinesApi } from '../data/airlines-api';
import { AirlinesStore } from '../data/airlines.store';
import { MAX_IMPORT_FILE_BYTES } from '../../../core/http/spreadsheet-import';
import { AirlineImportDialog } from './airline-import-dialog';

describe('AirlineImportDialog', () => {
  let import$: Subject<{ imported: number }>;
  let api: { importFile: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean | undefined };
  let fixture: ComponentFixture<AirlineImportDialog>;
  let el: HTMLElement;

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function choose(file: File) {
    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await settle();
  }

  const xlsx = (size = 10, name = 'airlines.xlsx') => new File([new Uint8Array(size)], name);
  const importButton = () =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button')).find(
      (button) => button.textContent?.trim() === 'Import',
    )!;

  beforeEach(async () => {
    import$ = new Subject();
    api = { importFile: vi.fn(() => import$) };
    dialogRef = { close: vi.fn(), disableClose: undefined };
    TestBed.configureTestingModule({
      imports: [AirlineImportDialog, translocoTesting()],
      providers: [
        AirlinesStore,
        { provide: AirlinesApi, useValue: api },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    fixture = TestBed.createComponent(AirlineImportDialog);
    el = fixture.nativeElement;
    await settle();
  });

  it('lists the required columns and disables import until a file is chosen', () => {
    expect(el.textContent).toContain('name, code, priceHandBaggage');
    expect(el.textContent).toContain('No file chosen');
    expect(importButton().disabled).toBe(true);
  });

  it('rejects a file that is not .xlsx without uploading', async () => {
    await choose(xlsx(10, 'airlines.csv'));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('ending in .xlsx');
    expect(importButton().disabled).toBe(true);
  });

  it('rejects a file over the API limit without uploading', async () => {
    await choose(xlsx(MAX_IMPORT_FILE_BYTES + 1));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('larger than 1 MB');
    expect(importButton().disabled).toBe(true);
  });

  it('accepts a file at the limit, with an uppercase extension', async () => {
    await choose(xlsx(MAX_IMPORT_FILE_BYTES, 'AIRLINES.XLSX'));
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.textContent).toContain('AIRLINES.XLSX');
    expect(importButton().disabled).toBe(false);
  });

  it('uploads, blocks closing while uploading, then closes with the count', async () => {
    const file = xlsx();
    await choose(file);
    importButton().click();
    await settle();

    expect(api.importFile).toHaveBeenCalledWith(file);
    expect(importButton().disabled).toBe(true);
    expect(dialogRef.disableClose).toBe(true);
    expect(el.querySelector('mat-progress-bar')).not.toBeNull();

    import$.next({ imported: 20 });
    await settle();
    expect(dialogRef.close).toHaveBeenCalledWith(20);
  });

  it('shows each row error in a table and keeps the dialog open', async () => {
    await choose(xlsx());
    importButton().click();
    import$.error(
      new HttpErrorResponse({
        status: 400,
        error: {
          message: 'The file has invalid rows, so nothing was imported',
          errors: [
            { row: 2, column: 'name', messages: ['too short', 'not a string'] },
            { row: 4, column: 'code', messages: ['code LA is already used in row 2'] },
          ],
        },
      }),
    );
    await settle();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Fix these 2 problems');
    const cells = Array.from(el.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim()),
    );
    expect(cells).toEqual([
      ['2', 'name', 'too short; not a string'],
      ['4', 'code', 'code LA is already used in row 2'],
    ]);
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(dialogRef.disableClose).toBe(false);
  });

  it('shows whole-file errors from the API, and clears them when a new file is chosen', async () => {
    await choose(xlsx());
    importButton().click();
    import$.error(
      new HttpErrorResponse({
        status: 400,
        error: { message: 'The file is missing these columns: redeemFee' },
      }),
    );
    await settle();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'missing these columns: redeemFee',
    );
    expect(el.querySelector('table')).toBeNull();

    await choose(xlsx(10, 'fixed.xlsx'));
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows a generic message for a server failure', async () => {
    await choose(xlsx());
    importButton().click();
    import$.error(new HttpErrorResponse({ status: 500 }));
    await settle();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Something went wrong');
  });
});
