import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideRouter } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { translocoTesting } from '../../../core/i18n/transloco-testing';
import { PaginatedResult } from '../../../core/http/paginated-result';
import { AirlinesApi } from '../../airlines/data/airlines-api';
import { airlineFixture } from '../../airlines/testing/airline.fixture';
import { AirplanesApi } from '../../airplanes/data/airplanes-api';
import { AirportsApi } from '../data/airports-api';
import { Flight, FlightLiveEvent } from '../data/flight.model';
import { FlightsApi } from '../data/flights-api';
import { FlightsStore } from '../data/flights.store';
import { ezeiza, flightFixture, heathrow, pageOf } from '../testing/flight.fixture';
import { FlightList } from './flight-list';

describe('FlightList', () => {
  let api: { search: ReturnType<typeof vi.fn>; updates: ReturnType<typeof vi.fn> };
  let live$: Subject<FlightLiveEvent>;

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
    live$ = new Subject();
    api = { search: vi.fn(), updates: vi.fn(() => live$) };
    TestBed.configureTestingModule({
      imports: [FlightList, translocoTesting()],
      providers: [
        provideRouter([]),
        FlightsStore,
        provideNativeDateAdapter(),
        { provide: FlightsApi, useValue: api },
        { provide: AirlinesApi, useValue: { list: () => of([airlineFixture()]) } },
        { provide: AirportsApi, useValue: { search: () => of([]) } },
        { provide: AirplanesApi, useValue: { list: () => of([]) } },
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

  describe('live updates', () => {
    const badges = (el: HTMLElement) =>
      Array.from(el.querySelectorAll<HTMLElement>('th .live')).map((badge) => ({
        column: badge.closest('th')!.textContent!.replace(badge.textContent!, '').trim(),
        state: badge.dataset['state'],
        label: badge.textContent?.trim(),
      }));
    const chip = (el: HTMLElement) => el.querySelector<HTMLElement>('td .status')!;
    const labels = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('td .rescheduled')).map((label) => label.textContent?.trim());
    const dateCells = (el: HTMLElement) =>
      Array.from(el.querySelectorAll<HTMLElement>('td .live-value'));
    const liveUpdate = (changes: Partial<Flight>): FlightLiveEvent => {
      const { id, departure, arrival, status, wasRescheduled, version } = flightFixture();
      return {
        type: 'updated',
        flight: {
          id,
          departure,
          arrival,
          status,
          wasRescheduled,
          version: version + 1,
          ...changes,
        },
      };
    };

    it('shows a badge below departure, arrival and status that follows the connection', async () => {
      const { fixture, el } = await render();
      expect(badges(el)).toEqual(
        ['Departure', 'Arrival', 'Status'].map((column) => ({
          column,
          state: 'connecting',
          label: 'Connecting…',
        })),
      );

      live$.next({ type: 'connected', reconnect: false });
      await settle(fixture);
      expect(badges(el).map(({ state, label }) => [state, label])).toEqual([
        ['connected', 'Live'],
        ['connected', 'Live'],
        ['connected', 'Live'],
      ]);

      live$.next({ type: 'disconnected' });
      await settle(fixture);
      expect(badges(el)[0]).toMatchObject({ state: 'reconnecting', label: 'Reconnecting…' });
    });

    it('hides the badges when the stream fails', async () => {
      const { fixture, el } = await render();
      live$.error(new Error('closed'));
      await settle(fixture);
      expect(badges(el)).toEqual([]);
    });

    it('shows a live status change and flashes it until the animation ends', async () => {
      const { fixture, el } = await render();
      expect(chip(el).classList).not.toContain('changed');

      live$.next(liveUpdate({ status: 'boarding' }));
      await settle(fixture);
      expect(rows(el)[0][6]).toBe('Boarding');
      expect(chip(el).classList).toContain('changed');
      expect(dateCells(el).map((cell) => cell.classList.contains('changed'))).toEqual([
        false,
        false,
      ]);

      chip(el).dispatchEvent(new Event('animationend'));
      await settle(fixture);
      expect(chip(el).classList).not.toContain('changed');
    });

    it('flashes only the departure or arrival that changed, each until its animation ends', async () => {
      const { fixture, el } = await render();

      live$.next(liveUpdate({ departure: '2026-12-01T15:00:00.000Z', status: 'gateChanged' }));
      await settle(fixture);
      const [departure, arrival] = dateCells(el);
      expect(departure.classList).toContain('changed');
      expect(arrival.classList).not.toContain('changed');
      expect(chip(el).classList).toContain('changed');

      departure.dispatchEvent(new Event('animationend'));
      await settle(fixture);
      expect(dateCells(el)[0].classList).not.toContain('changed');
      expect(chip(el).classList).toContain('changed');
    });

    it('shows the rescheduled label under departure and arrival once a live update sets it', async () => {
      const { fixture, el } = await render();
      expect(labels(el)).toEqual([]);

      live$.next(liveUpdate({ departure: '2026-12-01T15:00:00.000Z', wasRescheduled: true }));
      await settle(fixture);
      expect(labels(el)).toEqual(['Rescheduled', 'Rescheduled']);
      expect(rows(el)[0][3]).toMatch(/Rescheduled$/);
      expect(rows(el)[0][4]).toMatch(/Rescheduled$/);
    });

    it('does not flash an update that leaves the values alone', async () => {
      const { fixture, el } = await render();
      live$.next(liveUpdate({}));
      await settle(fixture);
      expect(el.querySelectorAll('.changed')).toHaveLength(0);
    });

    it('disconnects when the screen closes', async () => {
      const { fixture } = await render();
      expect(api.updates).toHaveBeenCalledTimes(1);
      expect(live$.observed).toBe(true);

      fixture.destroy();
      expect(live$.observed).toBe(false);
      expect(TestBed.inject(FlightsStore).live()).toBe('off');
    });
  });

  it('links to the create form', async () => {
    const { el } = await render();
    const link = Array.from(el.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('New flight'),
    );
    expect(link?.getAttribute('href')).toBe('/new');
  });

  it('links each flight to its edit form', async () => {
    const { el } = await render();
    const edit = el.querySelector<HTMLAnchorElement>('td.row-actions a')!;
    expect(edit.getAttribute('href')).toBe(`/${flightFixture().id}/edit`);
    expect(edit.getAttribute('aria-label')).toBe('Edit flight LG1132');
  });

  it('shows no rescheduled label for a flight that keeps its schedule', async () => {
    const { el } = await render();
    expect(el.querySelectorAll('td .rescheduled')).toHaveLength(0);
  });

  it('labels a rescheduled flight in its departure and arrival', async () => {
    const { el } = await render(of(pageOf([flightFixture({ wasRescheduled: true })])));
    const cells = Array.from(el.querySelectorAll('td .rescheduled')).map((label) =>
      label.closest('td')!.classList.contains('mat-column-departure') ? 'departure' : 'arrival',
    );
    expect(cells).toEqual(['departure', 'arrival']);
  });

  it('shows code, route, airline, translated status and price', async () => {
    const { el } = await render(of(pageOf([flightFixture({ status: 'inAir' })])));
    // Without the live badges, which the next tests cover
    const headers = Array.from(el.querySelectorAll('th')).map((th) =>
      th.textContent?.replace(th.querySelector('.live')?.textContent ?? '', '').trim(),
    );
    expect(headers).toEqual([
      'Code',
      'Origin',
      'Destination',
      'Departure',
      'Arrival',
      'Airline',
      'Status',
      'Base price',
      'Actions',
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
      status: 'gateChanged',
      airlineCode: 'LG',
    });
    button(el, 'Search').click();
    await settle(fixture);

    expect(api.search).toHaveBeenLastCalledWith({
      origin: 'EZE',
      destination: 'LHR',
      status: 'gateChanged',
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
