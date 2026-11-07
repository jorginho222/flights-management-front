import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ezeiza } from '../testing/flight.fixture';
import { Airport } from './airport.model';
import { AIRPORT_SEARCH_DEBOUNCE_MS, AirportSearchStore } from './airport-search.store';
import { AirportsApi } from './airports-api';

describe('AirportSearchStore', () => {
  let responses: Subject<Airport[]>[];
  let api: { search: ReturnType<typeof vi.fn> };
  let store: InstanceType<typeof AirportSearchStore>;

  beforeEach(() => {
    vi.useFakeTimers();
    responses = [];
    api = {
      search: vi.fn(() => {
        const response = new Subject<Airport[]>();
        responses.push(response);
        return response;
      }),
    };
    TestBed.configureTestingModule({
      providers: [AirportSearchStore, { provide: AirportsApi, useValue: api }],
    });
    store = TestBed.inject(AirportSearchStore);
  });

  afterEach(() => vi.useRealTimers());

  const type = (text: string) => {
    store.search(text);
    vi.advanceTimersByTime(AIRPORT_SEARCH_DEBOUNCE_MS);
  };

  it('waits for 3 characters, ignoring surrounding spaces', () => {
    type('ez');
    type('  ez ');
    expect(api.search).not.toHaveBeenCalled();

    type(' eze ');
    expect(api.search).toHaveBeenCalledExactlyOnceWith('eze', 15);
  });

  it('only searches the text the user stopped at', () => {
    store.search('eze');
    store.search('ezei');
    vi.advanceTimersByTime(AIRPORT_SEARCH_DEBOUNCE_MS - 1);
    expect(api.search).not.toHaveBeenCalled();

    store.search('ezeiz');
    vi.advanceTimersByTime(AIRPORT_SEARCH_DEBOUNCE_MS);
    expect(api.search).toHaveBeenCalledExactlyOnceWith('ezeiz', 15);
  });

  it('shows the options, and drops a response to older text', () => {
    type('eze');
    expect(store.loading()).toBe(true);
    type('lon');
    responses[0].next([ezeiza]);
    expect(store.options()).toEqual([]);

    responses[1].next([]);
    expect(store.loading()).toBe(false);
    expect(store.searchedTerm()).toBe('lon');
  });

  it('clears the options when the text gets too short', () => {
    type('eze');
    responses[0].next([ezeiza]);
    type('e');
    expect(store.options()).toEqual([]);
    expect(store.searchedTerm()).toBeNull();
  });

  it('stores the error, and recovers on the next text', () => {
    type('eze');
    responses[0].error(new HttpErrorResponse({ status: 500 }));
    expect(store.error()?.status).toBe(500);
    expect(store.loading()).toBe(false);

    type('ezei');
    expect(store.error()).toBeNull();
    responses[1].next([ezeiza]);
    expect(store.options()).toEqual([ezeiza]);
  });
});
