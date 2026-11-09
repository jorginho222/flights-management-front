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
  let updates: Record<'details' | 'schedule' | 'status', Subject<Flight>>;
  let api: Record<
    'search' | 'create' | 'update' | 'updateSchedule' | 'updateStatus',
    ReturnType<typeof vi.fn>
  >;
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
    updates = { details: new Subject(), schedule: new Subject(), status: new Subject() };
    api = {
      update: vi.fn(() => updates.details),
      updateSchedule: vi.fn(() => updates.schedule),
      updateStatus: vi.fn(() => updates.status),
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
      store.create({ input, onSuccess });
      expect(store.saving().create).toBe(true);
      expect(api.create).toHaveBeenCalledExactlyOnceWith(input);

      const saved = flightFixture({ id: input.id });
      created[0].next(saved);
      expect(store.saving().create).toBe(false);
      expect(onSuccess).toHaveBeenCalledExactlyOnceWith(saved);
      expect(store.entities()).toEqual([]);
    });

    it('ignores a second submit while the first is saving', () => {
      store.create({ input, onSuccess: vi.fn() });
      store.create({ input, onSuccess: vi.fn() });
      expect(api.create).toHaveBeenCalledTimes(1);
    });

    it('keeps the API messages on error, and resetForm clears them', () => {
      const onSuccess = vi.fn();
      store.create({ input, onSuccess });
      created[0].error(
        new HttpErrorResponse({
          status: 400,
          error: { message: 'Origin and destination must be different' },
        }),
      );
      expect(store.saving().create).toBe(false);
      expect(store.saveErrors().create).toEqual({
        status: 400,
        messages: ['Origin and destination must be different'],
      });
      expect(onSuccess).not.toHaveBeenCalled();

      store.resetForm();
      expect(store.saveErrors()).toEqual({});
    });
  });

  describe('editing', () => {
    const flight = flightFixture();

    /** Puts the flight in the store the way the list does: as a search result. */
    function searchAndSelect() {
      store.search(filters);
      respond(0, pageOf([flight]));
      store.loadOne(flight.id);
    }

    it('selects a flight from the last search, or reports it missing', () => {
      searchAndSelect();
      expect(store.selected()).toEqual(flight);
      expect(store.selectedMissing()).toBe(false);

      store.loadOne('55555555-5555-4555-8555-555555555555');
      expect(store.selected()).toBeNull();
      expect(store.selectedMissing()).toBe(true);
    });

    it('replaces the flight with what PUT returns, such as a new code', () => {
      searchAndSelect();
      const onSuccess = vi.fn();
      const { id, ...body } = { id: flight.id, ...toUpdate(flight) };
      store.updateDetails({ input: { id, ...body }, onSuccess });
      expect(api.update).toHaveBeenCalledExactlyOnceWith(flight.id, body);
      expect(store.saving().details).toBe(true);

      const saved = flightFixture({ code: { prefix: 'AR', correlative: 9 }, version: 4 });
      updates.details.next(saved);
      expect(store.selected()).toEqual(saved);
      expect(store.entityMap()[flight.id]).toEqual(saved);
      expect(store.saving().details).toBe(false);
      expect(onSuccess).toHaveBeenCalledExactlyOnceWith(saved);
    });

    it('merges only the schedule, status and version from a PATCH, which lacks relations', () => {
      searchAndSelect();
      const onSuccess = vi.fn();
      const schedule = {
        id: flight.id,
        departure: '2026-12-01T15:00:00.000Z',
        arrival: '2026-12-02T05:00:00.000Z',
      };
      store.updateSchedule({ input: schedule, onSuccess });
      expect(api.updateSchedule).toHaveBeenCalledExactlyOnceWith(schedule);

      const bare: Partial<Flight> = flightFixture({ ...schedule, status: 'delayed', version: 4 });
      for (const relation of ['airline', 'airplane', 'origin', 'destination'] as const) {
        delete bare[relation];
      }
      updates.schedule.next(bare as Flight);

      const expected = { ...flight, ...schedule, status: 'delayed', version: 4 };
      expect(store.selected()).toEqual(expected);
      expect(store.entityMap()[flight.id]).toEqual(expected);
      expect(onSuccess).toHaveBeenCalledExactlyOnceWith(expected);
    });

    it('saves the status, and keeps the error of each section apart', () => {
      searchAndSelect();
      store.updateStatus({ input: { id: flight.id, status: 'boarding' }, onSuccess: vi.fn() });
      expect(api.updateStatus).toHaveBeenCalledExactlyOnceWith({
        id: flight.id,
        status: 'boarding',
      });
      updates.status.error(new HttpErrorResponse({ status: 500 }));

      expect(store.saveErrors()).toEqual({ status: { status: 500, messages: [] } });
      expect(store.selected()).toEqual(flight);

      store.loadOne(flight.id);
      expect(store.saveErrors()).toEqual({});
    });

    it('lets different sections save at once, but ignores a repeat of a running one', () => {
      searchAndSelect();
      const input = { id: flight.id, status: 'boarding' as const };
      store.updateStatus({ input, onSuccess: vi.fn() });
      store.updateStatus({ input, onSuccess: vi.fn() });
      store.updateDetails({ input: { id: flight.id, ...toUpdate(flight) }, onSuccess: vi.fn() });

      expect(api.updateStatus).toHaveBeenCalledTimes(1);
      expect(api.update).toHaveBeenCalledTimes(1);
      expect(store.saving()).toEqual({ status: true, details: true });
    });
  });
});

function toUpdate(flight: Flight) {
  const { airline, airplane, origin, destination, basePrice, version } = flight;
  return { airline, airplane, origin, destination, basePrice, version };
}
