import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { translocoTesting } from '../../../core/i18n/transloco-testing';
import { Airplane } from '../data/airplane.model';
import { AirplanesApi } from '../data/airplanes-api';
import { AirplanesStore } from '../data/airplanes.store';
import { airplaneFixture } from '../testing/airplane.fixture';
import { AirplaneList } from './airplane-list';

describe('AirplaneList', () => {
  const embraer = airplaneFixture({
    id: 'e',
    brand: 'embraer',
    model: 'E190',
    passengersCapacity: 100,
    seatsConfig: [{ class: 'economy', rowsQuantity: 25, columnsQuantity: 4 }],
  });
  const boeing = airplaneFixture({ id: 'b' });

  let api: { list: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let afterClosed: Subject<boolean | number | string | undefined>;
  let snackOpen: ReturnType<typeof vi.fn>;

  async function render(result: ReturnType<AirplanesApi['list']> = of([embraer, boeing])) {
    api.list.mockReturnValue(result);
    const fixture = TestBed.createComponent(AirplaneList);
    await settle(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const rows = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('tr[mat-row]')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim()),
    );

  const clickDelete = (el: HTMLElement, name: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="Delete ${name}"]`)!.click();

  const clickImport = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'upload_file Import')!
      .click();

  beforeEach(() => {
    api = { list: vi.fn(), delete: vi.fn() };
    afterClosed = new Subject();
    snackOpen = vi.fn();
    TestBed.configureTestingModule({
      imports: [AirplaneList, translocoTesting()],
      providers: [
        provideRouter([]),
        AirplanesStore,
        { provide: AirplanesApi, useValue: api },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => afterClosed }) } },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
      ],
    });
  });

  it('shows brand, model, capacity and classes, sorted by brand ignoring case', async () => {
    const { el } = await render();
    const headers = Array.from(el.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Brand', 'Model', 'Capacity', 'Seat classes', 'Actions']);
    expect(rows(el).map((cells) => cells.slice(0, 4))).toEqual([
      ['Boeing', '737-800', '166', 'Economy, Business'],
      ['embraer', 'E190', '100', 'Economy'],
    ]);
  });

  it('paginates on the client at 10 rows', async () => {
    const many: Airplane[] = Array.from({ length: 12 }, (_, index) =>
      airplaneFixture({ id: `${index}`, model: `M${index}` }),
    );
    const { el } = await render(of(many));
    expect(rows(el)).toHaveLength(10);
    expect(el.textContent).toContain('1 – 10 of 12');
  });

  it('shows the empty state', async () => {
    const { el } = await render(of([]));
    expect(el.textContent).toContain('There are no airplanes yet.');
    expect(el.querySelector('table')).toBeNull();
  });

  it('shows the error state, and retry reloads', async () => {
    const { fixture, el } = await render(throwError(() => new HttpErrorResponse({ status: 500 })));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'The airplanes could not be loaded.',
    );

    api.list.mockReturnValue(of([boeing]));
    el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle(fixture);
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(rows(el)).toHaveLength(1);
  });

  it('reloads the list and notifies after an import', async () => {
    const { fixture, el } = await render();
    clickImport(el);
    afterClosed.next(4);
    await fixture.whenStable();

    expect(snackOpen.mock.calls[0][0]).toBe('Airplanes imported: 4');
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['the Cancel button', ''],
    ['Escape or a backdrop click', undefined],
  ])('does nothing when the import dialog is closed with %s', async (_, result) => {
    const { el } = await render();
    clickImport(el);
    afterClosed.next(result);
    expect(api.list).toHaveBeenCalledOnce();
    expect(snackOpen).not.toHaveBeenCalled();
  });

  it('deletes after confirmation and notifies', async () => {
    api.delete.mockReturnValue(of(undefined));
    const { fixture, el } = await render();
    clickDelete(el, 'Boeing 737-800');
    afterClosed.next(true);
    await settle(fixture);

    expect(api.delete).toHaveBeenCalledWith('b');
    expect(rows(el)).toHaveLength(1);
    expect(snackOpen.mock.calls[0][0]).toBe('Boeing 737-800 was deleted.');
  });

  it('does not delete when the dialog is cancelled', async () => {
    const { el } = await render();
    clickDelete(el, 'Boeing 737-800');
    afterClosed.next(undefined);
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('keeps the row and displays the backend message when delete fails', async () => {
    const message = 'Airplane b is used by 2 flight(s) of Sky Air and cannot be deleted';
    api.delete.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message } })),
    );
    const { fixture, el } = await render();
    clickDelete(el, 'Boeing 737-800');
    afterClosed.next(true);
    await fixture.whenStable();

    expect(rows(el)).toHaveLength(2);
    expect(snackOpen.mock.calls[0][0]).toBe(message);
  });

  describe('filters', () => {
    const a320 = airplaneFixture({ id: 'a1', brand: 'Airbus', model: 'A320neo' });
    const a350 = airplaneFixture({ id: 'a2', brand: 'Airbus', model: 'A350-900' });
    const b737 = airplaneFixture({ id: 'b1', brand: 'Boeing', model: '737-800' });
    const b787 = airplaneFixture({ id: 'b2', brand: 'Boeing', model: '787-9' });
    const all = [b787, a350, embraer, b737, a320];

    const models = (el: HTMLElement) => rows(el).map((cells) => cells[1]);

    async function chooseBrand(fixture: ComponentFixture<AirplaneList>, label: string) {
      fixture.nativeElement.querySelector('.mat-mdc-select-trigger').click();
      await settle(fixture);
      Array.from(document.querySelectorAll<HTMLElement>('mat-option'))
        .find((option) => option.textContent?.trim() === label)!
        .click();
      await settle(fixture);
    }

    async function typeModel(fixture: ComponentFixture<AirplaneList>, text: string) {
      const input = fixture.nativeElement.querySelector('.filters input') as HTMLInputElement;
      input.value = text;
      input.dispatchEvent(new Event('input'));
      await settle(fixture);
    }

    it('offers each brand once, sorted ignoring case, after "All brands"', async () => {
      const { fixture } = await render(of(all));
      fixture.nativeElement.querySelector('.mat-mdc-select-trigger').click();
      await settle(fixture);
      const options = Array.from(document.querySelectorAll('mat-option')).map((option) =>
        option.textContent?.trim(),
      );
      expect(options).toEqual(['All brands', 'Airbus', 'Boeing', 'embraer']);
    });

    it('filters by brand, and shows all again with "All brands"', async () => {
      const { fixture, el } = await render(of(all));
      await chooseBrand(fixture, 'Boeing');
      expect(models(el)).toEqual(['737-800', '787-9']);

      await chooseBrand(fixture, 'All brands');
      expect(rows(el)).toHaveLength(5);
    });

    it('filters by part of the model, ignoring case and spaces', async () => {
      const { fixture, el } = await render(of(all));
      await typeModel(fixture, ' a3 ');
      expect(models(el)).toEqual(['A320neo', 'A350-900']);
    });

    it('combines both filters', async () => {
      const { fixture, el } = await render(of(all));
      await chooseBrand(fixture, 'Boeing');
      await typeModel(fixture, '8');
      expect(models(el)).toEqual(['737-800', '787-9']);
      await typeModel(fixture, '-9');
      expect(models(el)).toEqual(['787-9']);
    });

    it('says when nothing matches, and can clear the filters', async () => {
      const { fixture, el } = await render(of(all));
      await chooseBrand(fixture, 'Airbus');
      await typeModel(fixture, '737');
      expect(rows(el)).toEqual([]);
      expect(el.textContent).toContain('No airplanes match these filters.');

      Array.from(el.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'Clear filters')!
        .click();
      await settle(fixture);
      expect(rows(el)).toHaveLength(5);
      expect(el.querySelector<HTMLInputElement>('.filters input')!.value).toBe('');
    });

    it('goes back to the first page when a filter changes', async () => {
      const many = Array.from({ length: 25 }, (_, index) =>
        airplaneFixture({ id: `${index}`, model: `M${String(index).padStart(2, '0')}` }),
      );
      const { fixture, el } = await render(of(many));
      el.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
      await settle(fixture);
      expect(el.textContent).toContain('11 – 20 of 25');

      await typeModel(fixture, 'm');
      expect(el.textContent).toContain('1 – 10 of 25');
    });

    it('shows all brands again once the chosen brand has no airplanes left', async () => {
      api.delete.mockReturnValue(of(undefined));
      const { fixture, el } = await render(of(all));
      await chooseBrand(fixture, 'embraer');
      clickDelete(el, 'embraer E190');
      afterClosed.next(true);
      await settle(fixture);
      await settle(fixture);

      expect(rows(el)).toHaveLength(4);
    });
  });
});
