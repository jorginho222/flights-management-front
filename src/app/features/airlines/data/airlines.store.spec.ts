import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { airlineFixture } from '../testing/airline.fixture';
import { Airline } from './airline.model';
import { AirlinesApi } from './airlines-api';
import { AirlinesStore } from './airlines.store';

const conflict = (message: string) =>
  new HttpErrorResponse({ status: 409, error: { statusCode: 409, message } });

describe('AirlinesStore', () => {
  let list$: Subject<Airline[]>;
  let get$: Subject<Airline>;
  let write$: Subject<void>;
  let import$: Subject<{ imported: number }>;
  let api: Record<
    'list' | 'get' | 'create' | 'update' | 'delete' | 'importFile',
    ReturnType<typeof vi.fn>
  >;
  let store: InstanceType<typeof AirlinesStore>;

  beforeEach(() => {
    list$ = new Subject();
    get$ = new Subject();
    write$ = new Subject();
    import$ = new Subject();
    api = {
      importFile: vi.fn(() => import$),
      list: vi.fn(() => list$),
      get: vi.fn(() => get$),
      create: vi.fn(() => write$),
      update: vi.fn(() => write$),
      delete: vi.fn(() => write$),
    };
    TestBed.configureTestingModule({
      providers: [AirlinesStore, { provide: AirlinesApi, useValue: api }],
    });
    store = TestBed.inject(AirlinesStore);
  });

  const seed = (...airlines: Airline[]) => {
    store.load();
    list$.next(airlines);
  };

  describe('load', () => {
    it('tracks loading and stores the airlines', () => {
      store.load();
      expect(store.listLoading()).toBe(true);

      const airline = airlineFixture();
      list$.next([airline]);
      expect(store.listLoading()).toBe(false);
      expect(store.entities()).toEqual([airline]);
    });

    it('stores the error, and can recover on retry', () => {
      store.load();
      list$.error(new HttpErrorResponse({ status: 500 }));
      expect(store.listLoading()).toBe(false);
      expect(store.listError()?.status).toBe(500);

      list$ = new Subject();
      store.load();
      expect(store.listError()).toBeNull();
      list$.next([airlineFixture()]);
      expect(store.entities()).toHaveLength(1);
    });
  });

  describe('loadOne', () => {
    it('stores the selected airline', () => {
      store.loadOne('a-1');
      expect(api.get).toHaveBeenCalledWith('a-1');
      expect(store.selectedLoading()).toBe(true);

      const airline = airlineFixture();
      get$.next(airline);
      expect(store.selected()).toEqual(airline);
      expect(store.selectedLoading()).toBe(false);
    });

    it('uses the airline already loaded by the list, without a request', () => {
      const airline = airlineFixture();
      seed(airline);
      store.loadOne(airline.id);

      expect(api.get).not.toHaveBeenCalled();
      expect(store.selected()).toEqual(airline);
      expect(store.selectedLoading()).toBe(false);
    });

    it('fetches an airline the list does not have', () => {
      seed(airlineFixture());
      store.loadOne('other-id');
      expect(api.get).toHaveBeenCalledWith('other-id');
    });

    it('discards a pending fetch when a loaded airline is opened next', () => {
      const airline = airlineFixture();
      seed(airline);
      store.loadOne('other-id');
      store.loadOne(airline.id);
      get$.next(airlineFixture({ id: 'other-id', name: 'Stale' }));

      expect(store.selected()).toEqual(airline);
    });

    it('stores a not-found error', () => {
      store.loadOne('a-1');
      get$.error(new HttpErrorResponse({ status: 404 }));
      expect(store.selectedError()?.status).toBe(404);
    });
  });

  describe('save', () => {
    it('creates, adds the entity and calls back only after the API confirms', () => {
      const onSuccess = vi.fn();
      const airline = airlineFixture();
      store.save({ airline, isNew: true, onSuccess });

      expect(api.create).toHaveBeenCalledWith(airline);
      expect(store.saving()).toBe(true);
      expect(store.entities()).toEqual([]);
      expect(onSuccess).not.toHaveBeenCalled();

      write$.next();
      expect(store.saving()).toBe(false);
      expect(store.entities()).toEqual([airline]);
      expect(onSuccess).toHaveBeenCalledOnce();
    });

    it('updates an existing airline', () => {
      const airline = airlineFixture();
      seed(airline);
      const renamed = { ...airline, name: 'Renamed' };
      store.save({ airline: renamed, isNew: false, onSuccess: vi.fn() });

      expect(api.update).toHaveBeenCalledWith(renamed);
      expect(api.create).not.toHaveBeenCalled();
      write$.next();
      expect(store.entities()).toEqual([renamed]);
    });

    it('ignores a repeat submit while one is running', () => {
      const request = { airline: airlineFixture(), isNew: true, onSuccess: vi.fn() };
      store.save(request);
      store.save(request);
      expect(api.create).toHaveBeenCalledOnce();
    });

    it('keeps the data, stores the error and does not call back on failure', () => {
      const onSuccess = vi.fn();
      store.save({ airline: airlineFixture(), isNew: true, onSuccess });
      write$.error(conflict('Code already exists'));

      expect(store.saving()).toBe(false);
      expect(store.saveError()?.messages).toEqual(['Code already exists']);
      expect(store.entities()).toEqual([]);
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('can save again after a failure', () => {
      const request = { airline: airlineFixture(), isNew: true, onSuccess: vi.fn() };
      store.save(request);
      write$.error(conflict('Code already exists'));

      write$ = new Subject();
      api.create.mockReturnValue(write$);
      store.save(request);
      expect(store.saveError()).toBeNull();
      write$.next();
      expect(request.onSuccess).toHaveBeenCalledOnce();
    });
  });

  describe('remove', () => {
    it('removes the row only after the API confirms', () => {
      const airline = airlineFixture();
      seed(airline);
      const onSuccess = vi.fn();
      store.remove({ id: airline.id, onSuccess, onError: vi.fn() });

      expect(store.deletingId()).toBe(airline.id);
      expect(store.entities()).toHaveLength(1);

      write$.next();
      write$.complete();
      expect(store.deletingId()).toBeNull();
      expect(store.entities()).toEqual([]);
      expect(onSuccess).toHaveBeenCalledOnce();
    });

    it('keeps the row and reports the error when delete fails', () => {
      const airline = airlineFixture();
      seed(airline);
      const onError = vi.fn();
      store.remove({ id: airline.id, onSuccess: vi.fn(), onError });
      write$.error(conflict('Airline has flights'));

      expect(store.entities()).toEqual([airline]);
      expect(store.deletingId()).toBeNull();
      expect(onError).toHaveBeenCalledWith({ status: 409, messages: ['Airline has flights'] });
    });
  });

  describe('importFile', () => {
    const file = new File(['x'], 'airlines.xlsx');

    it('reports the imported count after the API confirms', () => {
      const onSuccess = vi.fn();
      store.importFile({ file, onSuccess });
      expect(api.importFile).toHaveBeenCalledWith(file);
      expect(store.importing()).toBe(true);

      import$.next({ imported: 20 });
      expect(store.importing()).toBe(false);
      expect(onSuccess).toHaveBeenCalledWith(20);
    });

    it('ignores a repeat import while one is running', () => {
      store.importFile({ file, onSuccess: vi.fn() });
      store.importFile({ file, onSuccess: vi.fn() });
      expect(api.importFile).toHaveBeenCalledOnce();
    });

    it('stores the row errors when the file is rejected', () => {
      const onSuccess = vi.fn();
      store.importFile({ file, onSuccess });
      const rows = [
        { row: 3, column: 'code', messages: ['an airline with code LA already exists'] },
      ];
      import$.error(
        new HttpErrorResponse({
          status: 400,
          error: { message: 'The file has invalid rows, so nothing was imported', errors: rows },
        }),
      );

      expect(store.importing()).toBe(false);
      expect(store.importError()?.rows).toEqual(rows);
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('clears the error when a new import session starts', () => {
      store.importFile({ file, onSuccess: vi.fn() });
      import$.error(new HttpErrorResponse({ status: 413, error: { message: 'File too large' } }));
      expect(store.importError()?.messages).toEqual(['File too large']);

      store.resetImport();
      expect(store.importError()).toBeNull();
    });
  });
});
