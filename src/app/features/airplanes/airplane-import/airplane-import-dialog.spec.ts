import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { MAX_IMPORT_FILE_BYTES } from '../../../core/http/spreadsheet-import';
import { translocoTesting } from '../../../core/i18n/transloco-testing';
import { AirplanesApi } from '../data/airplanes-api';
import { AirplanesStore } from '../data/airplanes.store';
import { AirplaneImportDialog } from './airplane-import-dialog';

describe('AirplaneImportDialog', () => {
  let import$: Subject<{ imported: number }>;
  let api: { importFile: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean | undefined };
  let fixture: ComponentFixture<AirplaneImportDialog>;
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

  const xlsx = (size = 10, name = 'airplanes.xlsx') => new File([new Uint8Array(size)], name);
  const importButton = () =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button')).find(
      (button) => button.textContent?.trim() === 'Import',
    )!;

  beforeEach(async () => {
    import$ = new Subject();
    api = { importFile: vi.fn(() => import$) };
    dialogRef = { close: vi.fn(), disableClose: undefined };
    TestBed.configureTestingModule({
      imports: [AirplaneImportDialog, translocoTesting()],
      providers: [
        AirplanesStore,
        { provide: AirplanesApi, useValue: api },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    fixture = TestBed.createComponent(AirplaneImportDialog);
    el = fixture.nativeElement;
    await settle();
  });

  it('lists the columns the API requires, with a pair per class', () => {
    expect(el.textContent).toContain('Import airplanes');
    expect(el.textContent).toContain(
      'brand, model, passengersCapacity, economyRows, economyColumns, premiumEconomyRows, ' +
        'premiumEconomyColumns, businessRows, businessColumns, firstRows, firstColumns',
    );
    expect(importButton().disabled).toBe(true);
  });

  it('rejects a file that is not .xlsx, or is too large, without uploading', async () => {
    await choose(xlsx(10, 'airplanes.csv'));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('ending in .xlsx');
    await choose(xlsx(MAX_IMPORT_FILE_BYTES + 1));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('larger than 1 MB');
    expect(importButton().disabled).toBe(true);
  });

  it('uploads, blocks closing while uploading, then closes with the count', async () => {
    const file = xlsx();
    await choose(file);
    importButton().click();
    await settle();

    expect(api.importFile).toHaveBeenCalledWith(file);
    expect(dialogRef.disableClose).toBe(true);

    import$.next({ imported: 7 });
    await settle();
    expect(dialogRef.close).toHaveBeenCalledWith(7);
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
            { row: 2, column: 'passengersCapacity', messages: ['must equal the 150 seats'] },
            { row: 3, column: 'model', messages: ['model A320 is already used in row 2'] },
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
      ['2', 'passengersCapacity', 'must equal the 150 seats'],
      ['3', 'model', 'model A320 is already used in row 2'],
    ]);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
