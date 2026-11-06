import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { translocoTesting } from '../../../core/i18n/transloco-testing';
import { Airline } from '../data/airline.model';
import { AirlinesApi } from '../data/airlines-api';
import { AirlinesStore } from '../data/airlines.store';
import { airlineFixture } from '../testing/airline.fixture';
import { AirlineList } from './airline-list';

describe('AirlineList', () => {
  const zulu = airlineFixture({ id: 'z', name: 'zulu Air', code: 'ZZ' });
  const alpha = airlineFixture({ id: 'a', name: 'Alpha Air', code: 'AA' });

  let api: { list: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let afterClosed: Subject<boolean | number | string | undefined>;
  let snackOpen: ReturnType<typeof vi.fn>;

  async function render(result: ReturnType<AirlinesApi['list']> = of([zulu, alpha])) {
    api.list.mockReturnValue(result);
    const fixture = TestBed.createComponent(AirlineList);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const rows = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('tr[mat-row]')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim()),
    );

  const clickDelete = (el: HTMLElement, name: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="Delete ${name}"]`)!.click();

  beforeEach(() => {
    api = { list: vi.fn(), delete: vi.fn() };
    afterClosed = new Subject();
    snackOpen = vi.fn();
    TestBed.configureTestingModule({
      imports: [AirlineList, translocoTesting()],
      providers: [
        provideRouter([]),
        AirlinesStore,
        { provide: AirlinesApi, useValue: api },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => afterClosed }) } },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
      ],
    });
  });

  it('shows only name and code, sorted by name ignoring case', async () => {
    const { el } = await render();
    const headers = Array.from(el.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Name', 'Code', 'Actions']);
    expect(rows(el).map((cells) => cells.slice(0, 2))).toEqual([
      ['Alpha Air', 'AA'],
      ['zulu Air', 'ZZ'],
    ]);
    expect(el.textContent).not.toContain('12.5');
  });

  it('paginates on the client at 10 rows', async () => {
    const many: Airline[] = Array.from({ length: 12 }, (_, index) =>
      airlineFixture({ id: `${index}`, name: `Airline ${index}`, code: `A${index}` }),
    );
    const { el } = await render(of(many));
    expect(rows(el)).toHaveLength(10);
    expect(el.textContent).toContain('1 – 10 of 12');
    expect(api.list).toHaveBeenCalledOnce();
  });

  it('shows the loading state', async () => {
    const { el } = await render(new Subject<Airline[]>());
    expect(el.querySelector('mat-progress-bar')).not.toBeNull();
    expect(el.textContent).not.toContain('There are no airlines');
  });

  it('shows the empty state', async () => {
    const { el } = await render(of([]));
    expect(el.textContent).toContain('There are no airlines yet.');
    expect(el.querySelector('table')).toBeNull();
  });

  it('shows the error state, and retry reloads', async () => {
    const { fixture, el } = await render(throwError(() => new HttpErrorResponse({ status: 500 })));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'The airlines could not be loaded.',
    );

    api.list.mockReturnValue(of([alpha]));
    el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(rows(el)).toHaveLength(1);
  });

  it('reloads the list and notifies after an import', async () => {
    const { fixture, el } = await render();
    expect(api.list).toHaveBeenCalledOnce();

    const importButton = Array.from(el.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'upload_file Import',
    )!;
    importButton.click();
    afterClosed.next(20);
    await fixture.whenStable();

    expect(snackOpen.mock.calls[0][0]).toBe('Airlines imported: 20');
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['the Cancel button', ''],
    ['Escape or a backdrop click', undefined],
  ])('does nothing when the import dialog is closed with %s', async (_, result) => {
    const { el } = await render();
    Array.from(el.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'upload_file Import')!
      .click();
    afterClosed.next(result);
    expect(api.list).toHaveBeenCalledOnce();
    expect(snackOpen).not.toHaveBeenCalled();
  });

  it('does not delete when the dialog is cancelled', async () => {
    const { el } = await render();
    clickDelete(el, 'Alpha Air');
    afterClosed.next(undefined);
    expect(api.delete).not.toHaveBeenCalled();
    expect(rows(el)).toHaveLength(2);
  });

  it('deletes after confirmation and notifies', async () => {
    api.delete.mockReturnValue(of(undefined));
    const { fixture, el } = await render();
    clickDelete(el, 'Alpha Air');
    afterClosed.next(true);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.delete).toHaveBeenCalledWith('a');
    expect(rows(el)).toHaveLength(1);
    expect(snackOpen.mock.calls[0][0]).toBe('Alpha Air was deleted.');
  });

  it('keeps the row and displays the backend message when delete fails', async () => {
    api.delete.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { message: 'Airline has flights' } }),
      ),
    );
    const { fixture, el } = await render();
    clickDelete(el, 'Alpha Air');
    afterClosed.next(true);
    await fixture.whenStable();

    expect(rows(el)).toHaveLength(2);
    expect(snackOpen.mock.calls[0][0]).toBe('Airline has flights');
  });

  it('falls back to a generic message when delete fails with a 500', async () => {
    api.delete.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const { fixture, el } = await render();
    clickDelete(el, 'Alpha Air');
    afterClosed.next(true);
    await fixture.whenStable();
    expect(snackOpen.mock.calls[0][0]).toBe('Something went wrong. Please try again.');
  });
});
