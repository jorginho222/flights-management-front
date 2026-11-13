import { inject, Injector } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { setAllEntities, updateEntity, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  catchError,
  EMPTY,
  exhaustMap,
  finalize,
  Observable,
  of,
  pipe,
  switchMap,
  tap,
} from 'rxjs';
import { ApiError, toApiError } from '../../../core/http/api-error';
import { PaginationMeta } from '../../../core/http/paginated-result';
import { Airline } from '../../airlines/data/airline.model';
import { AirlinesApi } from '../../airlines/data/airlines-api';
import { Airplane } from '../../airplanes/data/airplane.model';
import { AirplanesApi } from '../../airplanes/data/airplanes-api';
import { FlightSearchFilters, toSearchCriteria } from './flight-search.mapper';
import {
  CreateFlightInput,
  Flight,
  FlightLiveEvent,
  FlightLiveState,
  FlightScheduleInput,
  FlightStatusInput,
  UpdateFlightInput,
} from './flight.model';
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
  /** The flight the edit screen shows, kept apart so a list reload can't drop it. */
  selected: Flight | null;
  /** There is no `GET /flights/:id`, so a flight the store lacks (after a reload) can't load. */
  selectedMissing: boolean;
  /** Each save runs on its own, so one section saving doesn't block another. */
  saving: Partial<Record<FlightSaveSection, boolean>>;
  saveErrors: Partial<Record<FlightSaveSection, ApiError>>;
  /** The connection behind live updates, for the list's indicator. */
  live: FlightLiveState;
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
  selected: null,
  selectedMissing: false,
  saving: {},
  saveErrors: {},
  live: 'off',
};

interface SearchRequest {
  filters: FlightSearchFilters;
  page: number;
  limit: number;
}

/** The create form, then the edit screen's three tabs, each with its own endpoint. */
export type FlightSaveSection = 'create' | 'details' | 'schedule' | 'status';

export interface SaveFlightRequest<T> {
  input: T;
  /** Gets the flight as stored after the save, such as with the code the API assigned. */
  onSuccess: (flight: Flight) => void;
}

/** The PATCH endpoints send the flight back without its relations, so only these are kept. */
const patchedFields = ({
  departure,
  arrival,
  status,
  wasRescheduled,
  isDelayed,
  version,
}: Flight) => ({ departure, arrival, status, wasRescheduled, isDelayed, version });

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
      /**
       * A save for one section. exhaustMap ignores repeat submits while it runs. On success,
       * `changes` picks what to merge into the edited flight and its row in the list.
       */
      const saveSection = <T>(
        section: FlightSaveSection,
        call: (input: T) => Observable<Flight>,
        changes: (saved: Flight) => Partial<Flight> | undefined,
      ) =>
        rxMethod<SaveFlightRequest<T>>(
          pipe(
            exhaustMap(({ input, onSuccess }) => {
              patchState(store, (state) => ({
                saving: { ...state.saving, [section]: true },
                saveErrors: { ...state.saveErrors, [section]: undefined },
              }));
              return call(input).pipe(
                tapResponse({
                  next: (saved) => {
                    const merged = changes(saved);
                    const selected = store.selected();
                    if (merged && selected?.id === saved.id) {
                      patchState(store, { selected: { ...selected, ...merged } });
                    }
                    if (merged && store.entityMap()[saved.id]) {
                      patchState(store, updateEntity({ id: saved.id, changes: merged }));
                    }
                    patchState(store, (state) => ({
                      saving: { ...state.saving, [section]: false },
                    }));
                    onSuccess(merged && selected?.id === saved.id ? store.selected()! : saved);
                  },
                  error: (error) =>
                    patchState(store, (state) => ({
                      saving: { ...state.saving, [section]: false },
                      saveErrors: { ...state.saveErrors, [section]: toApiError(error) },
                    })),
                }),
              );
            }),
          ),
        );

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

      const reload = (): void => {
        const filters = store.filters();
        if (filters) query({ filters, page: store.page(), limit: store.limit() });
      };

      /**
       * Patches a shown row when the update is newer than it, which also drops the echo of
       * this panel's own save. Rows are never added or removed, so paging stays put, and
       * `selected` is left alone so an open edit form isn't overwritten.
       */
      const applyLiveEvent = (event: FlightLiveEvent): void => {
        if (event.type === 'connected') {
          patchState(store, { live: 'connected' });
          if (event.reconnect) reload();
          return;
        }
        if (event.type === 'disconnected') {
          patchState(store, { live: 'reconnecting' });
          return;
        }
        const { id, ...changes } = event.flight;
        const shown = store.entityMap()[id];
        if (shown && changes.version > shown.version) {
          patchState(store, updateEntity({ id, changes }));
        }
      };

      /** Given an observable, rxMethod ties that subscription to the caller's injector. */
      const applyUpdates = rxMethod<FlightLiveEvent>(tap(applyLiveEvent));

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
        reload,

        /**
         * Keeps the shown flights current with `GET /flights/events`, and reloads the page
         * after a reconnect. `live` follows the connection. The connection lives as long as `injector`, normally the list
         * screen's, since the store outlives the screen.
         */
        watchUpdates(injector: Injector): void {
          patchState(store, { live: 'connecting' });
          const updates = api.updates().pipe(
            // A closed stream only turns the indicator off; the list keeps working without it
            catchError(() => EMPTY),
            finalize(() => patchState(store, { live: 'off' })),
          );
          applyUpdates(updates, { injector });
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
          patchState(store, { saving: {}, saveErrors: {} });
        },

        /** Starts an edit session with a flight from the last search. */
        loadOne(id: string): void {
          const flight = store.entityMap()[id] ?? null;
          patchState(store, {
            selected: flight,
            selectedMissing: !flight,
            saving: {},
            saveErrors: {},
          });
        },

        /** The shown page is left alone: the list re-runs its search when reopened. */
        create: saveSection<CreateFlightInput>(
          'create',
          (flight) => api.create(flight),
          () => undefined,
        ),

        /** `PUT /flights/:id` returns the whole flight, which may carry a new code. */
        updateDetails: saveSection<UpdateFlightInput & { id: string }>(
          'details',
          ({ id, ...flight }) => api.update(id, flight),
          (saved) => saved,
        ),

        /** The API also sets `wasRescheduled` when a time changes, and leaves the status alone. */
        updateSchedule: saveSection<FlightScheduleInput>(
          'schedule',
          (schedule) => api.updateSchedule(schedule),
          patchedFields,
        ),

        updateStatus: saveSection<FlightStatusInput>(
          'status',
          (status) => api.updateStatus(status),
          patchedFields,
        ),
      };
    },
  ),
);
