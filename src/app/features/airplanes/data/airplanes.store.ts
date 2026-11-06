import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { removeEntity, setAllEntities, setEntity, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { concatMap, exhaustMap, map, Observable, of, pipe, switchMap, tap } from 'rxjs';
import { ApiError, toApiError } from '../../../core/http/api-error';
import { ImportError, toImportError } from '../../../core/http/spreadsheet-import';
import { Airplane, AirplaneInput } from './airplane.model';
import { AirplanesApi } from './airplanes-api';

interface AirplanesState {
  listLoading: boolean;
  listError: ApiError | null;
  selected: Airplane | null;
  selectedLoading: boolean;
  selectedError: ApiError | null;
  saving: boolean;
  saveError: ApiError | null;
  deletingId: string | null;
  importing: boolean;
  importError: ImportError | null;
}

const initialState: AirplanesState = {
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

const NOT_FOUND: ApiError = { status: 404, messages: [] };

export interface SaveAirplaneRequest {
  airplane: AirplaneInput;
  isNew: boolean;
  onSuccess: () => void;
}

export interface ImportAirplanesRequest {
  file: File;
  onSuccess: (imported: number) => void;
}

export interface DeleteAirplaneRequest {
  id: string;
  onSuccess: () => void;
  onError: (error: ApiError) => void;
}

/** State changes only after the API confirms, so a failed call never alters the data shown. */
export const AirplanesStore = signalStore(
  withEntities<Airplane>(),
  withState(initialState),
  withMethods((store, api = inject(AirplanesApi)) => ({
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { listLoading: true, listError: null })),
        switchMap(() =>
          api.list().pipe(
            tapResponse({
              next: (airplanes) =>
                patchState(store, setAllEntities(airplanes), { listLoading: false }),
              error: (error) =>
                patchState(store, { listLoading: false, listError: toApiError(error) }),
            }),
          ),
        ),
      ),
    ),

    /** Starts a form session for an existing airplane. switchMap discards any older response. */
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
        switchMap((id) => {
          const cached = store.entityMap()[id];
          // There is no GET /airplanes/:id, so opening by URL (empty store) loads the whole list
          const airplane$: Observable<Airplane | undefined> = cached
            ? of(cached)
            : api.list().pipe(
                tap((airplanes) => patchState(store, setAllEntities(airplanes))),
                map((airplanes) => airplanes.find((airplane) => airplane.id === id)),
              );
          return airplane$.pipe(
            tapResponse({
              next: (airplane) =>
                patchState(
                  store,
                  airplane
                    ? { selected: airplane, selectedLoading: false }
                    : { selectedLoading: false, selectedError: NOT_FOUND },
                ),
              error: (error) =>
                patchState(store, { selectedLoading: false, selectedError: toApiError(error) }),
            }),
          );
        }),
      ),
    ),

    /** Starts a form session for a new airplane. */
    resetForm(): void {
      patchState(store, {
        selected: null,
        selectedLoading: false,
        selectedError: null,
        saveError: null,
      });
    },

    /** exhaustMap ignores repeat submits while a save is running. */
    save: rxMethod<SaveAirplaneRequest>(
      pipe(
        exhaustMap(({ airplane, isNew, onSuccess }) => {
          patchState(store, { saving: true, saveError: null });
          return (isNew ? api.create(airplane) : api.update(airplane)).pipe(
            tapResponse({
              next: () => {
                // A save never changes the image, so keep the one already stored
                const imageUrl = store.entityMap()[airplane.id]?.imageUrl ?? '';
                patchState(store, setEntity({ ...airplane, imageUrl }), { saving: false });
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
    importFile: rxMethod<ImportAirplanesRequest>(
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
                patchState(store, { importing: false, importError: toImportError(error) }),
            }),
          );
        }),
      ),
    ),

    remove: rxMethod<DeleteAirplaneRequest>(
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
