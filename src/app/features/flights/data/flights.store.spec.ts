import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { PaginatedResult } from '../../../core/http/paginated-result';
import { Airline } from '../../airlines/data/airline.model';
import { AirlinesApi } from '../../airlines/data/airlines-api';
import { airlineFixture } from '../../airlines/testing/airline.fixture';
import { Airplane } from '../../airplanes/data/airplane.model';
import { AirplanesApi } from '../../airplanes/data/airplanes-api';
import { airplaneFixture } from '../../airplanes/testing/airplane.fixture';
import { ezeiza, flightFixture, heathrow, pageOf } from '../testing/flight.fixture';
import { emptyFilters } from './flight-search.mapper';
import { CreateFlightInput, Flight } from './flight.model';
import { FlightsApi } from './flights-api';
import { FlightsStore } from './flights.store';

describe('FlightsStore', () => {
  let responses: Subject<PaginatedResult<Flight>>[];
  let airlines$: Subject<Airline[]>;
  let airplanes$: Subject<Airplane[]>;
  let created: Subject<Flight>[];
  let api: { search: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let airlinesApi: { list: ReturnType<typeof vi.fn> };
  let airplanesApi: { list: ReturnType<typeof vi.fn> };
  let store: InstanceType<typeof FlightsStore>;

  const filters = { ...emptyFilters(), origin: ezeiza };
  const respond = (index: number, result: PaginatedResult<Flight>) => responses[index].next(result);

  beforeEach(() => {
    responses = [];
    airlines$ = new Subject();
    airplanes$ = new Subject();
    created = [];
    api = {
      create: vi.fn(() => {
        const response = new Subject<Flight>();
        created.push(response);
        return response;
      }),
      search: vi.fn(() => {
        const response = new Subject<PaginatedResult<Flight>>();
        responses.push(response);
        return response;
      }),
    };
    airlinesApi = { list: vi.fn(() => airlines$) };
    airplanesApi = { list: vi.fn(() => airplanes$) };
    TestBed.configureTestingModule({
      providers: [
        FlightsStore,
        { provide: FlightsApi, useValue: api },
        { provide: AirlinesApi, useValue: airlinesApi },
        { provide: AirplanesApi, useValue: airplanesApi },
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

  it('loads the airplanes for the create form', () => {
    store.loadAirplanes();
    expect(store.airplanesLoading()).toBe(true);
    airplanes$.error(new HttpErrorResponse({ status: 500 }));
    expect(store.airplanesLoading()).toBe(false);
    expect(store.airplanesError()?.status).toBe(500);

    airplanes$ = new Subject();
    store.loadAirplanes();
    expect(store.airplanesError()).toBeNull();
    airplanes$.next([airplaneFixture()]);
    expect(store.airplanes()).toEqual([airplaneFixture()]);
  });

  describe('create', () => {
    const input: CreateFlightInput = {
      id: '44444444-4444-4444-8444-444444444444',
      airline: airlineFixture(),
      airplane: airplaneFixture(),
      origin: ezeiza,
      destination: heathrow,
      departure: '2026-12-01T13:30:00.000Z',
      arrival: '2026-12-02T03:15:00.000Z',
      basePrice: 850.5,
    };

    it('posts the flight and hands the saved one to onSuccess, leaving the shown page alone', () => {
      const onSuccess = vi.fn();
      store.create({ flight: input, onSuccess });
      expect(store.saving()).toBe(true);
      expect(api.create).toHaveBeenCalledExactlyOnceWith(input);

      const saved = flightFixture({ id: input.id });
      created[0].next(saved);
      expect(store.saving()).toBe(false);
      expect(onSuccess).toHaveBeenCalledExactlyOnceWith(saved);
      expect(store.entities()).toEqual([]);
    });

    it('ignores a second submit while the first is saving', () => {
      store.create({ flight: input, onSuccess: vi.fn() });
      store.create({ flight: input, onSuccess: vi.fn() });
      expect(api.create).toHaveBeenCalledTimes(1);
    });

    it('keeps the API messages on error, and resetForm clears them', () => {
      const onSuccess = vi.fn();
      store.create({ flight: input, onSuccess });
      created[0].error(
        new HttpErrorResponse({
          status: 400,
          error: { message: 'Origin and destination must be different' },
        }),
      );
      expect(store.saving()).toBe(false);
      expect(store.saveError()).toEqual({
        status: 400,
        messages: ['Origin and destination must be different'],
      });
      expect(onSuccess).not.toHaveBeenCalled();

      store.resetForm();
      expect(store.saveError()).toBeNull();
    });
  });
});
