import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config';
import { PaginatedResult } from '../../../core/http/paginated-result';
import {
  CreateFlightInput,
  Flight,
  FlightScheduleInput,
  FlightSearchCriteria,
  FlightStatusInput,
  UpdateFlightInput,
} from './flight.model';

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

  /** Returns the saved flight, with the code the API assigned. */
  create(flight: CreateFlightInput): Observable<Flight> {
    return this.http.post<Flight>(this.baseUrl, flight);
  }

  /** Returns the saved flight with its relations, and a new code if the airline changed. */
  update(id: string, flight: UpdateFlightInput): Observable<Flight> {
    return this.http.put<Flight>(`${this.baseUrl}/${id}`, flight);
  }

  /** Returns the flight without its relations: airline, airplane and airports are left out. */
  updateSchedule(schedule: FlightScheduleInput): Observable<Flight> {
    return this.http.patch<Flight>(`${this.baseUrl}/schedule`, schedule);
  }

  /** Returns the flight without its relations, like `updateSchedule`. */
  updateStatus(status: FlightStatusInput): Observable<Flight> {
    return this.http.patch<Flight>(`${this.baseUrl}/status`, status);
  }
}
