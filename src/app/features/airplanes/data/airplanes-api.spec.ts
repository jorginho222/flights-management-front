import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '../../../core/config/app-config';
import { airplaneFixture, airplaneInputFixture } from '../testing/airplane.fixture';
import { AirplanesApi } from './airplanes-api';

describe('AirplanesApi', () => {
  const baseUrl = 'http://api.test/airplanes';
  let api: AirplanesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiUrl: 'http://api.test' } },
      ],
    });
    api = TestBed.inject(AirplanesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists airplanes', () => {
    const airplanes = [airplaneFixture()];
    let result: unknown;
    api.list().subscribe((value) => (result = value));

    const request = http.expectOne(baseUrl);
    expect(request.request.method).toBe('GET');
    request.flush(airplanes);
    expect(result).toEqual(airplanes);
  });

  it('creates and updates with the upsert POST and the full body, including the id', () => {
    const airplane = airplaneInputFixture();
    api.create(airplane).subscribe();
    api.update(airplane).subscribe();

    const requests = http.match(baseUrl);
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(airplane);
      request.flush(airplaneFixture(), { status: 201, statusText: 'Created' });
    }
  });

  it('uploads an import file as multipart form data in the "file" field', () => {
    const file = new File(['data'], 'airplanes.xlsx');
    let result: unknown;
    api.importFile(file).subscribe((value) => (result = value));

    const request = http.expectOne(`${baseUrl}/import`);
    expect(request.request.method).toBe('POST');
    expect((request.request.body as FormData).get('file')).toBe(file);
    request.flush({ imported: 3 }, { status: 201, statusText: 'Created' });
    expect(result).toEqual({ imported: 3 });
  });

  it('deletes with DELETE', () => {
    api.delete('p-1').subscribe();
    const request = http.expectOne(`${baseUrl}/p-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
  });
});
