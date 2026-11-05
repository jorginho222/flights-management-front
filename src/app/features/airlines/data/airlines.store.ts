import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { removeEntity, setAllEntities, setEntity, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { concatMap, exhaustMap, of, pipe, switchMap, tap } from 'rxjs';
import { ApiError, toApiError } from '../../../core/http/api-error';
import { AirlineImportError, toAirlineImportError } from './airline-import-error';
import { Airline } from './airline.model';
import { AirlinesApi } from './airlines-api';

interface AirlinesState {
  listLoading: boolean;
  listError: ApiError | null;
  selected: Airline | null;
  selectedLoading: boolean;
  selectedError: ApiError | null;
  saving: boolean;
  saveError: ApiError | null;
  deletingId: string | null;
  importing: boolean;
  importError: AirlineImportError | null;
}

const initialState: AirlinesState = {
  listLoading: false,
  listError: null,
  selected: null,
  selectedLoading: false,
  selectedError: null,
  saving: false,
  saveError: null,
  deletingId: null,
  importing: false,
  importError: null,
};

export interface SaveAirlineRequest {
  airline: Airline;
  isNew: boolean;
  onSuccess: () => void;
}

export interface ImportAirlinesRequest {
  file: File;
  onSuccess: (imported: number) => void;
}

export interface DeleteAirlineRequest {
  id: string;
  onSuccess: () => void;
  onError: (error: ApiError) => void;
}

/** State changes only after the API confirms, so a failed call never alters the data shown. */
export const AirlinesStore = signalStore(
  withEntities<Airline>(),
  withState(initialState),
  withMethods((store, api = inject(AirlinesApi)) => ({
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { listLoading: true, listError: null })),
        switchMap(() =>
          api.list().pipe(
            tapResponse({
              next: (airlines) =>
                patchState(store, setAllEntities(airlines), { listLoading: false }),
              error: (error) =>
                patchState(store, { listLoading: false, listError: toApiError(error) }),
            }),
          ),
        ),
      ),
    ),

    /** Starts a form session for an existing airline. switchMap discards any older response. */
    loadOne: rxMethod<string>(
      pipe(
        tap(() =>
          patchState(store, {
            selected: null,
            selectedLoading: true,
            selectedError: null,
            saveError: null,
          }),
        ),
        // The list already holds full airlines, so only fetch when opened by URL (empty store)
        switchMap((id) => {
          const cached = store.entityMap()[id];
          return (cached ? of(cached) : api.get(id)).pipe(
            tapResponse({
              next: (airline) => patchState(store, { selected: airline, selectedLoading: false }),
              error: (error) =>
                patchState(store, { selectedLoading: false, selectedError: toApiError(error) }),
            }),
          );
        }),
      ),
    ),

    /** Starts a form session for a new airline. */
    resetForm(): void {
      patchState(store, {
        selected: null,
        selectedLoading: false,
        selectedError: null,
        saveError: null,
      });
    },

    /** exhaustMap ignores repeat submits while a save is running. */
    save: rxMethod<SaveAirlineRequest>(
      pipe(
        exhaustMap(({ airline, isNew, onSuccess }) => {
          patchState(store, { saving: true, saveError: null });
          return (isNew ? api.create(airline) : api.update(airline)).pipe(
            tapResponse({
              next: () => {
                patchState(store, setEntity(airline), { saving: false });
                onSuccess();
              },
              error: (error) => patchState(store, { saving: false, saveError: toApiError(error) }),
            }),
          );
        }),
      ),
    ),

    /** Starts an import session. */
    resetImport(): void {
      patchState(store, { importing: false, importError: null });
    },

    /** The API imports all rows or none, so callers reload the list after a success. */
    importFile: rxMethod<ImportAirlinesRequest>(
      pipe(
        exhaustMap(({ file, onSuccess }) => {
          patchState(store, { importing: true, importError: null });
          return api.importFile(file).pipe(
            tapResponse({
              next: ({ imported }) => {
                patchState(store, { importing: false });
                onSuccess(imported);
              },
              error: (error) =>
                patchState(store, { importing: false, importError: toAirlineImportError(error) }),
            }),
          );
        }),
      ),
    ),

    remove: rxMethod<DeleteAirlineRequest>(
      pipe(
        concatMap(({ id, onSuccess, onError }) => {
          patchState(store, { deletingId: id });
          return api.delete(id).pipe(
            tapResponse({
              next: () => {
                patchState(store, removeEntity(id), { deletingId: null });
                onSuccess();
              },
              error: (error) => {
                patchState(store, { deletingId: null });
                onError(toApiError(error));
              },
            }),
          );
        }),
      ),
    ),
  })),
);
