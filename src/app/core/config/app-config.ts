import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

interface AppConfig {
  apiUrl: string;
}

/** Runtime settings from config.json, so one build can target any API. */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly http = inject(HttpClient);
  private config?: AppConfig;

  get apiUrl(): string {
    if (!this.config) {
      throw new Error('AppConfigService.load() must finish before reading the config');
    }
    return this.config.apiUrl.replace(/\/+$/, '');
  }

  load(): Observable<void> {
    return this.http.get<AppConfig>('config.json').pipe(
      tap((config) => (this.config = config)),
      map(() => undefined),
    );
  }
}
