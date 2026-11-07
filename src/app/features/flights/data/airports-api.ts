import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config';
import { Airport } from './airport.model';

/** The API rejects a search shorter than this with 400. */
export const AIRPORT_SEARCH_MIN_LENGTH = 3;

/** `GET /airports` is a typeahead: ranked matches, no paging. */
@Injectable({ providedIn: 'root' })
export class AirportsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  search(term: string, limit: number): Observable<Airport[]> {
    return this.http.get<Airport[]>(`${this.config.apiUrl}/airports`, {
      params: { search: term, limit },
    });
  }
}
