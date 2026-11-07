import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { PaginatedResult } from '../../../core/http/paginated-result';
import { Airline } from '../../airlines/data/airline.model';
import { AirlinesApi } from '../../airlines/data/airlines-api';
import { airlineFixture } from '../../airlines/testing/airline.fixture';
import { ezeiza, flightFixture, pageOf } from '../testing/flight.fixture';
import { emptyFilters } from './flight-search.mapper';
import { Flight } from './flight.model';
import { FlightsApi } from './flights-api';
import { FlightsStore } from './flights.store';

describe('FlightsStore', () => {
  let responses: Subject<PaginatedResult<Flight>>[];
  let airlines$: Subject<Airline[]>;
  let api: { search: ReturnType<typeof vi.fn> };
  let airlinesApi: { list: ReturnType<typeof vi.fn> };
  let store: InstanceType<typeof FlightsStore>;

  const filters = { ...emptyFilters(), origin: ezeiza };
  const respond = (index: number, result: PaginatedResult<Flight>) => responses[index].next(result);

  beforeEach(() => {
    responses = [];
    airlines$ = new Subject();
    api = {
      search: vi.fn(() => {
        const response = new Subject<PaginatedResult<Flight>>();
        responses.push(response);
        return response;
      }),
    };
    airlinesApi = { list: vi.fn(() => airlines$) };
    TestBed.configureTestingModule({
      providers: [
        FlightsStore,
        { provide: FlightsApi, useValue: api },
        { provide: AirlinesApi, useValue: airlinesApi },
      ],
    });
    store = TestBed.inject(FlightsStore);
  });

  it('searches page 1 with the mapped criteria and stores items and meta', () => {
    store.search(filters);
    expect(store.searching()).toBe(true);
    expect(api.search).toHaveBeenCalledWith({ origin: 'EZE', page: 1, limit: 20 });

    const flight = flightFixture();
    respond(0, pageOf([flight], 1, 20, 41));
    expect(store.searching()).toBe(false);
    expect(store.entities()).toEqual([flight]);
    expect(store.meta()).toEqual({ page: 1, limit: 20, totalItems: 41, totalPages: 3 });
  });

  it('pages with the last submitted filters, and a new search goes back to page 1', () => {
    store.search(filters);
    respond(0, pageOf([flightFixture()], 1, 20, 41));

    store.goToPage(3, 20);
    expect(api.search).toHaveBeenLastCalledWith({ origin: 'EZE', page: 3, limit: 20 });

    store.search(emptyFilters());
    expect(api.search).toHaveBeenLastCalledWith({ page: 1, limit: 20 });
  });

  it('goes back to page 1 when the page size changes', () => {
    store.search(filters);
    store.goToPage(2, 50);
    expect(api.search).toHaveBeenLastCalledWith({ origin: 'EZE', page: 1, limit: 50 });
    expect(store.limit()).toBe(50);
  });

  it('shows the last page when the requested one is past the end', () => {
    store.search(filters);
    store.goToPage(5, 20);
    respond(1, { items: [], meta: { page: 5, limit: 20, totalItems: 30, totalPages: 2 } });

    expect(api.search).toHaveBeenLastCalledWith({ origin: 'EZE', page: 2, limit: 20 });
    const flight = flightFixture();
    respond(2, pageOf([flight], 2, 20, 30));
    expect(store.page()).toBe(2);
    expect(store.entities()).toEqual([flight]);
  });

  it('ignores the response of a superseded search', () => {
    store.search(filters);
    store.search(emptyFilters());
    respond(0, pageOf([flightFixture({ id: 'stale' })]));
    expect(store.entities()).toEqual([]);
    expect(store.searching()).toBe(true);
  });

  it('keeps the shown flights on error, and reload retries the same page', () => {
    store.search(filters);
    respond(0, pageOf([flightFixture()], 1, 20, 41));
    store.goToPage(2, 20);
    responses[1].error(new HttpErrorResponse({ status: 500 }));

    expect(store.searching()).toBe(false);
    expect(store.searchError()?.status).toBe(500);
    expect(store.entities()).toHaveLength(1);

    store.reload();
    expect(store.searchError()).toBeNull();
    expect(api.search).toHaveBeenLastCalledWith({ origin: 'EZE', page: 2, limit: 20 });
  });

  it('loads the airlines for the airline filter', () => {
    store.loadAirlines();
    expect(store.airlinesLoading()).toBe(true);
    airlines$.next([airlineFixture()]);
    expect(store.airlines()).toEqual([airlineFixture()]);
    expect(store.airlinesLoading()).toBe(false);
  });
});
