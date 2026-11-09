import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '../../../core/config/app-config';
import { flightFixture, pageOf } from '../testing/flight.fixture';
import { FlightLiveEvent } from './flight.model';
import { AirportsApi } from './airports-api';
import { FlightsApi } from './flights-api';

describe('FlightsApi and AirportsApi', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiUrl: 'http://api.test' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('searches flights with QUERY and the criteria as a JSON body', () => {
    const result = pageOf([flightFixture()]);
    let response: unknown;
    TestBed.inject(FlightsApi)
      .search({ origin: 'EZE', page: 2, limit: 20 })
      .subscribe((value) => (response = value));

    const request = http.expectOne('http://api.test/flights');
    expect(request.request.method).toBe('QUERY');
    expect(request.request.body).toEqual({ origin: 'EZE', page: 2, limit: 20 });
    expect(request.request.detectContentTypeHeader()).toBe('application/json');
    request.flush(result);
    expect(response).toEqual(result);
  });

  it('creates a flight with POST and returns the saved flight', () => {
    const saved = flightFixture();
    const body = { id: saved.id, basePrice: 10 } as never;
    let response: unknown;
    TestBed.inject(FlightsApi)
      .create(body)
      .subscribe((value) => (response = value));

    const request = http.expectOne('http://api.test/flights');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(body);
    request.flush(saved, { status: 201, statusText: 'Created' });
    expect(response).toEqual(saved);
  });

  it.each([
    [
      'update',
      (api: FlightsApi) => api.update('flight-id', { basePrice: 10 } as never),
      'PUT',
      'http://api.test/flights/flight-id',
      { basePrice: 10 },
    ],
    [
      'updateSchedule',
      (api: FlightsApi) => api.updateSchedule({ id: 'flight-id', departure: 'a', arrival: 'b' }),
      'PATCH',
      'http://api.test/flights/schedule',
      { id: 'flight-id', departure: 'a', arrival: 'b' },
    ],
    [
      'updateStatus',
      (api: FlightsApi) => api.updateStatus({ id: 'flight-id', status: 'boarding' }),
      'PATCH',
      'http://api.test/flights/status',
      { id: 'flight-id', status: 'boarding' },
    ],
  ] as const)(
    '%s sends %s to the right endpoint and returns the flight',
    (_, call, method, url, body) => {
      const saved = flightFixture();
      let response: unknown;
      call(TestBed.inject(FlightsApi)).subscribe((value) => (response = value));

      const request = http.expectOne(url);
      expect(request.request.method).toBe(method);
      expect(request.request.body).toEqual(body);
      request.flush(saved);
      expect(response).toEqual(saved);
    },
  );

  it('searches airports by text with a limit', () => {
    TestBed.inject(AirportsApi).search('eze', 15).subscribe();

    const request = http.expectOne(
      (req) => req.url === 'http://api.test/airports' && req.method === 'GET',
    );
    expect(request.request.params.get('search')).toBe('eze');
    expect(request.request.params.get('limit')).toBe('15');
    request.flush([]);
  });

  describe('updates', () => {
    class FakeEventSource {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSED = 2;
      static last: FakeEventSource;
      readyState = FakeEventSource.CONNECTING;
      readonly listeners: Record<string, (event: { data: string }) => void> = {};
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();

      constructor(readonly url: string) {
        FakeEventSource.last = this;
      }

      addEventListener(type: string, listener: (event: { data: string }) => void) {
        this.listeners[type] = listener;
      }
    }

    beforeEach(() => vi.stubGlobal('EventSource', FakeEventSource));
    afterEach(() => vi.unstubAllGlobals());

    it('streams flight.updated events from the events endpoint', () => {
      const events: FlightLiveEvent[] = [];
      TestBed.inject(FlightsApi)
        .updates()
        .subscribe((event) => events.push(event));
      const source = FakeEventSource.last;
      expect(source.url).toBe('http://api.test/flights/events');

      const flight = {
        id: 'flight-id',
        status: 'delayed',
        departure: '2026-12-01T15:00:00.000Z',
        arrival: '2026-12-02T05:00:00.000Z',
        version: 4,
      };
      source.listeners['flight.updated']({ data: JSON.stringify(flight) });
      expect(events).toEqual([{ type: 'updated', flight }]);
    });

    it('reports each open, and one disconnect per dropped connection', () => {
      const events: FlightLiveEvent[] = [];
      TestBed.inject(FlightsApi)
        .updates()
        .subscribe((event) => events.push(event));
      const source = FakeEventSource.last;

      source.onopen!();
      expect(events).toEqual([{ type: 'connected', reconnect: false }]);

      // The browser keeps retrying, with an error for each failed attempt
      source.onerror!();
      source.onerror!();
      source.onopen!();
      expect(events).toEqual([
        { type: 'connected', reconnect: false },
        { type: 'disconnected' },
        { type: 'connected', reconnect: true },
      ]);
    });

    it('errors when the browser gives up on the stream', () => {
      let failed = false;
      TestBed.inject(FlightsApi)
        .updates()
        .subscribe({ error: () => (failed = true) });
      const source = FakeEventSource.last;

      source.readyState = FakeEventSource.CLOSED;
      source.onerror!();
      expect(failed).toBe(true);
    });

    it('closes the connection on unsubscribe', () => {
      const subscription = TestBed.inject(FlightsApi).updates().subscribe();
      const source = FakeEventSource.last;
      expect(source.close).not.toHaveBeenCalled();

      subscription.unsubscribe();
      expect(source.close).toHaveBeenCalledTimes(1);
    });
  });
});
