import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { setAllEntities, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap, of, pipe, switchMap, tap } from 'rxjs';
import { ApiError, toApiError } from '../../../core/http/api-error';
import { PaginationMeta } from '../../../core/http/paginated-result';
import { Airline } from '../../airlines/data/airline.model';
import { AirlinesApi } from '../../airlines/data/airlines-api';
import { Airplane } from '../../airplanes/data/airplane.model';
import { AirplanesApi } from '../../airplanes/data/airplanes-api';
import { FlightSearchFilters, toSearchCriteria } from './flight-search.mapper';
import { CreateFlightInput, Flight } from './flight.model';
import { FlightsApi } from './flights-api';

export const DEFAULT_PAGE_SIZE = 20;

interface FlightsState {
  /** The last submitted filters, so the screen can restore them when reopened. */
  filters: FlightSearchFilters | null;
  page: number;
  limit: number;
  meta: PaginationMeta | null;
  searching: boolean;
  searchError: ApiError | null;
  airlines: Airline[];
  airlinesLoading: boolean;
  airlinesError: ApiError | null;
  airplanes: Airplane[];
  airplanesLoading: boolean;
  airplanesError: ApiError | null;
  saving: boolean;
  saveError: ApiError | null;
}

const initialState: FlightsState = {
  filters: null,
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  meta: null,
  searching: false,
  searchError: null,
  airlines: [],
  airlinesLoading: false,
  airlinesError: null,
  airplanes: [],
  airplanesLoading: false,
  airplanesError: null,
  saving: false,
  saveError: null,
};

interface SearchRequest {
  filters: FlightSearchFilters;
  page: number;
  limit: number;
}

export interface CreateFlightRequest {
  flight: CreateFlightInput;
  /** Gets the saved flight, which carries the code the API assigned. */
  onSuccess: (flight: Flight) => void;
}

export const FlightsStore = signalStore(
  withEntities<Flight>(),
  withState(initialState),
  withMethods(
    (
      store,
      api = inject(FlightsApi),
      airlinesApi = inject(AirlinesApi),
      airplanesApi = inject(AirplanesApi),
    ) => {
      /** switchMap: only the latest search's response is shown. */
      const query = rxMethod<SearchRequest>(
        pipe(
          tap(({ filters, page, limit }) =>
            patchState(store, { filters, page, limit, searching: true, searchError: null }),
          ),
          switchMap(({ filters, page, limit }) => {
            const criteria = toSearchCriteria(filters);
            return api.search({ ...criteria, page, limit }).pipe(
              // A page past the end (results shrank since the pager was drawn) shows the last one
              switchMap((result) =>
                result.items.length === 0 &&
                page > result.meta.totalPages &&
                result.meta.totalPages > 0
                  ? api.search({ ...criteria, page: result.meta.totalPages, limit })
                  : of(result),
              ),
              tapResponse({
                next: ({ items, meta }) =>
                  patchState(store, setAllEntities(items), {
                    meta,
                    page: meta.page,
                    searching: false,
                  }),
                error: (error) =>
                  patchState(store, { searching: false, searchError: toApiError(error) }),
              }),
            );
          }),
        ),
      );

      return {
        /** A new search starts at page 1. */
        search(filters: FlightSearchFilters): void {
          query({ filters, page: 1, limit: store.limit() });
        },

        /** Keeps the last submitted filters. `page` starts at 1. */
        goToPage(page: number, limit: number): void {
          const filters = store.filters();
          if (filters) query({ filters, page: limit === store.limit() ? page : 1, limit });
        },

        /** Re-runs the last search on the same page, such as after an error. */
        reload(): void {
          const filters = store.filters();
          if (filters) query({ filters, page: store.page(), limit: store.limit() });
        },

        loadAirlines: rxMethod<void>(
          pipe(
            tap(() => patchState(store, { airlinesLoading: true, airlinesError: null })),
            switchMap(() =>
              airlinesApi.list().pipe(
                tapResponse({
                  next: (airlines) => patchState(store, { airlines, airlinesLoading: false }),
                  error: (error) =>
                    patchState(store, { airlinesLoading: false, airlinesError: toApiError(error) }),
                }),
              ),
            ),
          ),
        ),

        loadAirplanes: rxMethod<void>(
          pipe(
            tap(() => patchState(store, { airplanesLoading: true, airplanesError: null })),
            switchMap(() =>
              airplanesApi.list().pipe(
                tapResponse({
                  next: (airplanes) => patchState(store, { airplanes, airplanesLoading: false }),
                  error: (error) =>
                    patchState(store, {
                      airplanesLoading: false,
                      airplanesError: toApiError(error),
                    }),
                }),
              ),
            ),
          ),
        ),

        /** Starts a create form session. */
        resetForm(): void {
          patchState(store, { saving: false, saveError: null });
        },

        /**
         * exhaustMap ignores repeat submits while a save is running. The shown page is left
         * alone: the list re-runs its search when reopened, which picks up the new flight.
         */
        create: rxMethod<CreateFlightRequest>(
          pipe(
            exhaustMap(({ flight, onSuccess }) => {
              patchState(store, { saving: true, saveError: null });
              return api.create(flight).pipe(
                tapResponse({
                  next: (saved) => {
                    patchState(store, { saving: false });
                    onSuccess(saved);
                  },
                  error: (error) =>
                    patchState(store, { saving: false, saveError: toApiError(error) }),
                }),
              );
            }),
          ),
        ),
      };
    },
  ),
);
