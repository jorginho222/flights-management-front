import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { airplaneFixture, airplaneInputFixture } from '../testing/airplane.fixture';
import { Airplane } from './airplane.model';
import { AirplanesApi } from './airplanes-api';
import { AirplanesStore } from './airplanes.store';

const conflict = (message: string) =>
  new HttpErrorResponse({ status: 409, error: { statusCode: 409, message } });

describe('AirplanesStore', () => {
  let list$: Subject<Airplane[]>;
  let write$: Subject<void>;
  let import$: Subject<{ imported: number }>;
  let api: Record<'list' | 'create' | 'update' | 'delete' | 'importFile', ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof AirplanesStore>;

  beforeEach(() => {
    list$ = new Subject();
    write$ = new Subject();
    import$ = new Subject();
    api = {
      importFile: vi.fn(() => import$),
      list: vi.fn(() => list$),
      create: vi.fn(() => write$),
      update: vi.fn(() => write$),
      delete: vi.fn(() => write$),
    };
    TestBed.configureTestingModule({
      providers: [AirplanesStore, { provide: AirplanesApi, useValue: api }],
    });
    store = TestBed.inject(AirplanesStore);
  });

  const seed = (...airplanes: Airplane[]) => {
    store.load();
    list$.next(airplanes);
    list$ = new Subject();
    api.list.mockReturnValue(list$);
  };

  describe('load', () => {
    it('tracks loading and stores the airplanes', () => {
      store.load();
      expect(store.listLoading()).toBe(true);

      const airplane = airplaneFixture();
      list$.next([airplane]);
      expect(store.listLoading()).toBe(false);
      expect(store.entities()).toEqual([airplane]);
    });

    it('stores the error, and can recover on retry', () => {
      store.load();
      list$.error(new HttpErrorResponse({ status: 500 }));
      expect(store.listLoading()).toBe(false);
      expect(store.listError()?.status).toBe(500);

      list$ = new Subject();
      api.list.mockReturnValue(list$);
      store.load();
      expect(store.listError()).toBeNull();
      list$.next([airplaneFixture()]);
      expect(store.entities()).toHaveLength(1);
    });
  });

  describe('loadOne', () => {
    it('uses the airplane already loaded by the list, without a request', () => {
      const airplane = airplaneFixture();
      seed(airplane);
      store.loadOne(airplane.id);

      expect(api.list).toHaveBeenCalledOnce();
      expect(store.selected()).toEqual(airplane);
      expect(store.selectedLoading()).toBe(false);
    });

    it('loads the list to find an airplane the store does not have', () => {
      store.loadOne('p-2');
      expect(api.list).toHaveBeenCalledOnce();
      expect(store.selectedLoading()).toBe(true);

      const airplane = airplaneFixture({ id: 'p-2' });
      list$.next([airplaneFixture(), airplane]);
      expect(store.selected()).toEqual(airplane);
      expect(store.selectedLoading()).toBe(false);
      expect(store.entities()).toHaveLength(2);
    });

    it('reports not found when the list lacks the airplane', () => {
      store.loadOne('missing');
      list$.next([airplaneFixture()]);
      expect(store.selected()).toBeNull();
      expect(store.selectedError()).toEqual({ status: 404, messages: [] });
    });

    it('stores a load error', () => {
      store.loadOne('p-1');
      list$.error(new HttpErrorResponse({ status: 500 }));
      expect(store.selectedLoading()).toBe(false);
      expect(store.selectedError()?.status).toBe(500);
    });

    it('discards a pending fetch when a loaded airplane is opened next', () => {
      const airplane = airplaneFixture();
      seed(airplane);
      store.loadOne('other-id');
      store.loadOne(airplane.id);
      list$.next([airplaneFixture({ id: 'other-id', brand: 'Stale' })]);

      expect(store.selected()).toEqual(airplane);
    });
  });

  describe('save', () => {
    it('creates, adds the entity and calls back only after the API confirms', () => {
      const onSuccess = vi.fn();
      const airplane = airplaneInputFixture();
      store.save({ airplane, isNew: true, onSuccess });

      expect(api.create).toHaveBeenCalledWith(airplane);
      expect(store.saving()).toBe(true);
      expect(store.entities()).toEqual([]);
      expect(onSuccess).not.toHaveBeenCalled();

      write$.next();
      expect(store.saving()).toBe(false);
      expect(store.entities()).toEqual([{ ...airplane, imageUrl: '' }]);
      expect(onSuccess).toHaveBeenCalledOnce();
    });

    it('updates an existing airplane and keeps its image', () => {
      const stored = airplaneFixture({ imageUrl: 'https://img/1.png' });
      seed(stored);
      const renamed = airplaneInputFixture({ model: '737-900' });
      store.save({ airplane: renamed, isNew: false, onSuccess: vi.fn() });

      expect(api.update).toHaveBeenCalledWith(renamed);
      expect(api.create).not.toHaveBeenCalled();
      write$.next();
      expect(store.entities()).toEqual([{ ...renamed, imageUrl: 'https://img/1.png' }]);
    });

    it('ignores a repeat submit while one is running', () => {
      const request = { airplane: airplaneInputFixture(), isNew: true, onSuccess: vi.fn() };
      store.save(request);
      store.save(request);
      expect(api.create).toHaveBeenCalledOnce();
    });

    it('keeps the data, stores the error and does not call back on failure', () => {
      const onSuccess = vi.fn();
      store.save({ airplane: airplaneInputFixture(), isNew: true, onSuccess });
      write$.error(conflict('An airplane with model 737-800 already exists'));

      expect(store.saving()).toBe(false);
      expect(store.saveError()?.messages).toEqual([
        'An airplane with model 737-800 already exists',
      ]);
      expect(store.entities()).toEqual([]);
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('removes the row only after the API confirms', () => {
      const airplane = airplaneFixture();
      seed(airplane);
      const onSuccess = vi.fn();
      store.remove({ id: airplane.id, onSuccess, onError: vi.fn() });

      expect(store.deletingId()).toBe(airplane.id);
      expect(store.entities()).toHaveLength(1);

      write$.next();
      write$.complete();
      expect(store.deletingId()).toBeNull();
      expect(store.entities()).toEqual([]);
      expect(onSuccess).toHaveBeenCalledOnce();
    });

    it('keeps the row and reports the error when delete fails', () => {
      const airplane = airplaneFixture();
      seed(airplane);
      const onError = vi.fn();
      store.remove({ id: airplane.id, onSuccess: vi.fn(), onError });
      write$.error(conflict('Airplane is used by 2 flight(s)'));

      expect(store.entities()).toEqual([airplane]);
      expect(store.deletingId()).toBeNull();
      expect(onError).toHaveBeenCalledWith({
        status: 409,
        messages: ['Airplane is used by 2 flight(s)'],
      });
    });
  });

  describe('importFile', () => {
    const file = new File(['x'], 'airplanes.xlsx');

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

    it('stores the row errors when the file is rejected, and clears them on reset', () => {
      store.importFile({ file, onSuccess: vi.fn() });
      const rows = [
        { row: 3, column: 'economyRows', messages: ['rowsQuantity must not be greater than 100'] },
      ];
      import$.error(
        new HttpErrorResponse({
          status: 400,
          error: { message: 'The file has invalid rows, so nothing was imported', errors: rows },
        }),
      );
      expect(store.importing()).toBe(false);
      expect(store.importError()?.rows).toEqual(rows);

      store.resetImport();
      expect(store.importError()).toBeNull();
    });
  });
});
