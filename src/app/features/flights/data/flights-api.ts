import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config';
import { PaginatedResult } from '../../../core/http/paginated-result';
import { Flight, FlightSearchCriteria } from './flight.model';

@Injectable({ providedIn: 'root' })
export class FlightsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.config.apiUrl}/flights`;
  }

  /**
   * There is no GET /flights: search is HTTP QUERY with a JSON body. The API rejects
   * other content types with 415, and HttpClient sends an object body as JSON.
   */
  search(criteria: FlightSearchCriteria): Observable<PaginatedResult<Flight>> {
    return this.http.request<PaginatedResult<Flight>>('QUERY', this.baseUrl, { body: criteria });
  }
}
