import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config';
import { ImportResult } from '../../../core/http/spreadsheet-import';
import { Airplane, AirplaneInput } from './airplane.model';

/** The API has no `GET /airplanes/:id`, so single airplanes come from `list`. */
@Injectable({ providedIn: 'root' })
export class AirplanesApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.config.apiUrl}/airplanes`;
  }

  list(): Observable<Airplane[]> {
    return this.http.get<Airplane[]>(this.baseUrl);
  }

  create(airplane: AirplaneInput): Observable<void> {
    return this.http.post<void>(this.baseUrl, airplane);
  }

  // The API has no PUT: POST /airplanes upserts by the id in the body
  update(airplane: AirplaneInput): Observable<void> {
    return this.http.post<void>(this.baseUrl, airplane);
  }

  /** Uploads an .xlsx file. The API imports every row or none. */
  importFile(file: File): Observable<ImportResult> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<ImportResult>(`${this.baseUrl}/import`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }
}
