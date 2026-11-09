import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '../../../core/config/app-config';
import { flightFixture, pageOf } from '../testing/flight.fixture';
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

  it('searches airports by text with a limit', () => {
    TestBed.inject(AirportsApi).search('eze', 15).subscribe();

    const request = http.expectOne(
      (req) => req.url === 'http://api.test/airports' && req.method === 'GET',
    );
    expect(request.request.params.get('search')).toBe('eze');
    expect(request.request.params.get('limit')).toBe('15');
    request.flush([]);
  });
});
