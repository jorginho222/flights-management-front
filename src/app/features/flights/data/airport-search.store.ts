import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { debounceTime, distinctUntilChanged, EMPTY, map, pipe, switchMap } from 'rxjs';
import { ApiError, toApiError } from '../../../core/http/api-error';
import { Airport } from './airport.model';
import { AIRPORT_SEARCH_MIN_LENGTH, AirportsApi } from './airports-api';

export const AIRPORT_SEARCH_DEBOUNCE_MS = 300;
export const AIRPORT_SEARCH_LIMIT = 15;

interface AirportSearchState {
  options: Airport[];
  /** The term the options answer, or null when there are none to show. */
  searchedTerm: string | null;
  loading: boolean;
  error: ApiError | null;
}

const initialState: AirportSearchState = {
  options: [],
  searchedTerm: null,
  loading: false,
  error: null,
};

/**
 * Suggestions for one airport field. Provided by each `AirportAutocomplete`,
 * so origin and destination keep separate options.
 */
export const AirportSearchStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(AirportsApi)) => ({
    /** Takes the text as typed. switchMap drops responses to older text. */
    search: rxMethod<string>(
      pipe(
        map((text) => text.trim()),
        debounceTime(AIRPORT_SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap((term) => {
          if (term.length < AIRPORT_SEARCH_MIN_LENGTH) {
            patchState(store, initialState);
            return EMPTY;
          }
          patchState(store, { loading: true, error: null });
          return api.search(term, AIRPORT_SEARCH_LIMIT).pipe(
            tapResponse({
              next: (options) => patchState(store, { options, searchedTerm: term, loading: false }),
              error: (error) =>
                patchState(store, {
                  options: [],
                  searchedTerm: null,
                  loading: false,
                  error: toApiError(error),
                }),
            }),
          );
        }),
      ),
    ),
  })),
);
