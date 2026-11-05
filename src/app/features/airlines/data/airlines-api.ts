import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config';
import { Airline } from './airline.model';

@Injectable({ providedIn: 'root' })
export class AirlinesApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.config.apiUrl}/airlines`;
  }

  list(): Observable<Airline[]> {
    return this.http.get<Airline[]>(this.baseUrl);
  }

  get(id: string): Observable<Airline> {
    return this.http.get<Airline>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  create(airline: Airline): Observable<void> {
    return this.http.post<void>(this.baseUrl, airline);
  }

  // The API has no PUT: POST /airlines upserts by the id in the body
  update(airline: Airline): Observable<void> {
    return this.http.post<void>(this.baseUrl, airline);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }
}
