import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '../../../core/config/app-config';
import { airlineFixture } from '../testing/airline.fixture';
import { AirlinesApi } from './airlines-api';

describe('AirlinesApi', () => {
  const baseUrl = 'http://api.test/airlines';
  let api: AirlinesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiUrl: 'http://api.test' } },
      ],
    });
    api = TestBed.inject(AirlinesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists airlines', () => {
    const airlines = [airlineFixture()];
    let result: unknown;
    api.list().subscribe((value) => (result = value));

    const request = http.expectOne(baseUrl);
    expect(request.request.method).toBe('GET');
    request.flush(airlines);
    expect(result).toEqual(airlines);
  });

  it('gets one airline', () => {
    api.get('a-1').subscribe();
    const request = http.expectOne(`${baseUrl}/a-1`);
    expect(request.request.method).toBe('GET');
    request.flush(airlineFixture());
  });

  it('creates with POST and the full body, including the client-generated id', () => {
    const airline = airlineFixture();
    api.create(airline).subscribe();
    const request = http.expectOne(baseUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(airline);
    request.flush(null, { status: 201, statusText: 'Created' });
  });

  it('updates with the upsert POST and the full body, including the id', () => {
    const airline = airlineFixture();
    api.update(airline).subscribe();
    const request = http.expectOne(baseUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(airline);
    request.flush(null, { status: 201, statusText: 'Created' });
  });

  it('deletes with DELETE', () => {
    api.delete('a-1').subscribe();
    const request = http.expectOne(`${baseUrl}/a-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
  });
});
