import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { Observable, of, throwError } from 'rxjs';
import { translocoTesting } from '../../../core/i18n/transloco-testing';
import { PaginatedResult } from '../../../core/http/paginated-result';
import { AirlinesApi } from '../../airlines/data/airlines-api';
import { airlineFixture } from '../../airlines/testing/airline.fixture';
import { AirportsApi } from '../data/airports-api';
import { Flight } from '../data/flight.model';
import { FlightsApi } from '../data/flights-api';
import { FlightsStore } from '../data/flights.store';
import { ezeiza, flightFixture, heathrow, pageOf } from '../testing/flight.fixture';
import { FlightList } from './flight-list';

describe('FlightList', () => {
  let api: { search: ReturnType<typeof vi.fn> };

  async function render(
    result: Observable<PaginatedResult<Flight>> = of(pageOf([flightFixture()])),
  ) {
    api.search.mockReturnValue(result);
    const fixture = TestBed.createComponent(FlightList);
    await settle(fixture);
    return {
      fixture,
      el: fixture.nativeElement as HTMLElement,
      form: fixture.componentInstance['form'],
    };
  }

  async function settle(fixture: ComponentFixture<unknown>) {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const rows = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('tr[mat-row]')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) =>
        cell.textContent?.replace(/\s+/g, ' ').trim(),
      ),
    );

  const button = (el: HTMLElement, text: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((candidate) =>
      candidate.textContent?.trim().endsWith(text),
    )!;

  beforeEach(() => {
    api = { search: vi.fn() };
    TestBed.configureTestingModule({
      imports: [FlightList, translocoTesting()],
      providers: [
        FlightsStore,
        provideNativeDateAdapter(),
        { provide: FlightsApi, useValue: api },
        { provide: AirlinesApi, useValue: { list: () => of([airlineFixture()]) } },
        { provide: AirportsApi, useValue: { search: () => of([]) } },
      ],
    });
  });

  it('opens with upcoming flights: departing from the start of today, page 1', async () => {
    await render();
    const today = new Date();
    expect(api.search).toHaveBeenCalledExactlyOnceWith({
      departureFrom: new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString(),
      page: 1,
      limit: 20,
    });
  });

  it('shows code, route, airline, translated status and price', async () => {
    const { el } = await render(of(pageOf([flightFixture({ status: 'inAir' })])));
    const headers = Array.from(el.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual([
      'Code',
      'Origin',
      'Destination',
      'Departure',
      'Arrival',
      'Airline',
      'Status',
      'Base price',
    ]);
    const [cells] = rows(el);
    expect(cells[0]).toBe('LG1132');
    // IATA code above the city
    expect(cells[1]).toMatch(/^EZE\s*Ezeiza$/);
    expect(cells[2]).toMatch(/^LHR\s*London$/);
    expect(cells[5]).toBe('Aerolineas Lagarza');
    expect(cells[6]).toBe('In the air');
    expect(cells[7]).toBe('850.50');
  });

  it('submits every filter, mapped to the API criteria', async () => {
    const { fixture, el, form } = await render();
    form.setValue({
      origin: ezeiza,
      destination: heathrow,
      departureFrom: null,
      departureTo: null,
      status: 'delayed',
      airlineCode: 'LG',
    });
    button(el, 'Search').click();
    await settle(fixture);

    expect(api.search).toHaveBeenLastCalledWith({
      origin: 'EZE',
      destination: 'LHR',
      status: 'delayed',
      airlineCode: 'LG',
      page: 1,
      limit: 20,
    });
  });

  it('lists the airlines by name and code in the airline filter', async () => {
    const { fixture, el } = await render();
    el.querySelectorAll<HTMLElement>('mat-select')[1].click();
    await settle(fixture);
    const options = Array.from(document.querySelectorAll('mat-option')).map((option) =>
      option.textContent?.trim(),
    );
    expect(options).toEqual(['Any airline', 'Aerolineas Lagarza (LG)']);
  });

  it('swaps origin and destination', async () => {
    const { el, form } = await render();
    form.patchValue({ origin: ezeiza, destination: heathrow });
    el.querySelector<HTMLButtonElement>(
      'button[aria-label="Swap origin and destination"]',
    )!.click();
    expect(form.getRawValue()).toMatchObject({ origin: heathrow, destination: ezeiza });
  });

  it('pages on the server with the same filters', async () => {
    const flights = Array.from({ length: 20 }, (_, index) => flightFixture({ id: `${index}` }));
    const { fixture, el } = await render(of(pageOf(flights, 1, 20, 45)));
    expect(el.textContent).toContain('1 – 20 of 45');

    api.search.mockReturnValue(of(pageOf(flights.slice(0, 5), 3, 20, 45)));
    el.querySelector<HTMLButtonElement>('button[aria-label="Last page"]')!.click();
    await settle(fixture);

    expect(api.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ departureFrom: expect.any(String), page: 3, limit: 20 }),
    );
    expect(el.textContent).toContain('41 – 45 of 45');
  });

  it('shows the empty state, whose Clear restores the default search', async () => {
    const { fixture, el, form } = await render(of(pageOf([])));
    expect(el.textContent).toContain('No flights match these filters.');

    form.patchValue({ status: 'cancelled' });
    api.search.mockClear();
    el.querySelector<HTMLButtonElement>('.state button')!.click();
    await settle(fixture);
    expect(form.getRawValue().status).toBeNull();
    expect(api.search).toHaveBeenCalledOnce();
  });

  it('shows an error with a retry', async () => {
    const { fixture, el } = await render(throwError(() => new HttpErrorResponse({ status: 500 })));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load flights.");

    api.search.mockReturnValue(of(pageOf([flightFixture()])));
    button(el, 'Retry').click();
    await settle(fixture);
    expect(rows(el)).toHaveLength(1);
  });

  it('shows the API message for a rejected search', async () => {
    const { el } = await render(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: 'departureFrom must not be after departureTo' },
          }),
      ),
    );
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'departureFrom must not be after departureTo',
    );
  });
});
