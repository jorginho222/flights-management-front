import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { translocoTesting } from '../../../core/i18n/transloco-testing';
import { AirplanesApi } from '../data/airplanes-api';
import { AirplanesStore } from '../data/airplanes.store';
import { airplaneFixture, airplaneInputFixture } from '../testing/airplane.fixture';
import { AirplaneForm } from './airplane-form';

describe('AirplaneForm', () => {
  let api: Record<'list' | 'create' | 'update', ReturnType<typeof vi.fn>>;
  let snackOpen: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  async function render(id?: string) {
    const fixture = TestBed.createComponent(AirplaneForm);
    if (id) {
      fixture.componentRef.setInput('id', id);
    }
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, form: fixture.componentInstance['form'] };
  }

  async function settle(fixture: ComponentFixture<AirplaneForm>) {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const submit = (el: HTMLElement) =>
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));

  const capacityText = (el: HTMLElement) => el.querySelector('.capacity')?.textContent?.trim();

  beforeEach(() => {
    api = {
      list: vi.fn(() => of([])),
      create: vi.fn(() => of(undefined)),
      update: vi.fn(() => of(undefined)),
    };
    snackOpen = vi.fn();
    TestBed.configureTestingModule({
      imports: [AirplaneForm, translocoTesting()],
      providers: [
        provideRouter([]),
        AirplanesStore,
        { provide: AirplanesApi, useValue: api },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
      ],
    });
    navigate = vi.fn(() => Promise.resolve(true));
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate as never);
  });

  describe('validators', () => {
    it.each([
      ['', false],
      ['   ', false],
      ['A', true],
    ])('brand and model %j valid: %s', async (value, valid) => {
      const { form } = await render();
      form.controls.brand.setValue(value);
      form.controls.model.setValue(value);
      expect(form.controls.brand.valid).toBe(valid);
      expect(form.controls.model.valid).toBe(valid);
    });

    it.each([
      [null, false],
      [0, false],
      [1, true],
      [100, true],
      [101, false],
      [2.5, false],
    ])('rows %j valid: %s', async (value, valid) => {
      const { form } = await render();
      const control = form.controls.seats.controls.economy.controls.rows;
      control.setValue(value);
      expect(control.valid).toBe(valid);
    });

    it.each([
      [0, false],
      [26, true],
      [27, false],
    ])('columns %j valid: %s', async (value, valid) => {
      const { form } = await render();
      const control = form.controls.seats.controls.economy.controls.columns;
      control.setValue(value);
      expect(control.valid).toBe(valid);
    });

    it('explains the column limit', async () => {
      const { fixture, el, form } = await render();
      const control = form.controls.seats.controls.economy.controls.columns;
      control.setValue(27);
      control.markAsTouched();
      await settle(fixture);
      expect(el.textContent).toContain('Must be 26 or less');
    });
  });

  describe('seat classes', () => {
    it('starts a new airplane with only economy enabled', async () => {
      const { form } = await render();
      const seats = form.controls.seats.controls;
      expect(seats.economy.controls.rows.enabled).toBe(true);
      expect(seats.business.controls.rows.disabled).toBe(true);
      expect(seats.business.controls.columns.disabled).toBe(true);
    });

    it('enables a class quantities with its checkbox, and validates only enabled classes', async () => {
      const { fixture, el, form } = await render();
      const business = form.controls.seats.controls.business;
      expect(business.valid).toBe(true);

      el.querySelectorAll<HTMLInputElement>('mat-checkbox input')[2].click();
      await settle(fixture);
      expect(business.controls.enabled.value).toBe(true);
      expect(business.controls.rows.enabled).toBe(true);
      expect(business.valid).toBe(false);
    });

    it('requires at least one class', async () => {
      const { fixture, el, form } = await render();
      form.controls.brand.setValue('Airbus');
      form.controls.model.setValue('A320');
      form.controls.seats.controls.economy.controls.enabled.setValue(false);
      submit(el);
      await settle(fixture);

      expect(api.create).not.toHaveBeenCalled();
      expect(el.textContent).toContain('Choose at least one seat class.');
    });

    it('shows the capacity as the total of the enabled classes', async () => {
      const { fixture, el, form } = await render();
      const seats = form.controls.seats.controls;
      seats.economy.patchValue({ rows: 30, columns: 6 });
      seats.first.patchValue({ enabled: true, rows: 2, columns: 2 });
      await settle(fixture);
      expect(capacityText(el)).toBe('Passenger capacity: 184');

      seats.economy.controls.enabled.setValue(false);
      await settle(fixture);
      expect(capacityText(el)).toBe('Passenger capacity: 4');
    });
  });

  describe('create', () => {
    it('does not call the API while invalid, and shows the errors', async () => {
      const { fixture, el } = await render();
      submit(el);
      await settle(fixture);
      expect(api.create).not.toHaveBeenCalled();
      expect(el.textContent).toContain('This field is required');
    });

    it('posts a generated UUID, the enabled classes and their capacity, then returns', async () => {
      const { el, form } = await render();
      form.patchValue({
        brand: ' Airbus ',
        model: 'A320',
        seats: {
          economy: { rows: 25, columns: 6 },
          business: { enabled: true, rows: 3, columns: 4 },
        },
      });
      submit(el);

      expect(api.update).not.toHaveBeenCalled();
      const body = api.create.mock.calls[0][0];
      expect(body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(body).toEqual({
        id: body.id,
        brand: 'Airbus',
        model: 'A320',
        passengersCapacity: 162,
        seatsConfig: [
          { class: 'economy', rowsQuantity: 25, columnsQuantity: 6 },
          { class: 'business', rowsQuantity: 3, columnsQuantity: 4 },
        ],
      });
      expect(snackOpen.mock.calls[0][0]).toBe('Airbus A320 was created.');
      expect(navigate).toHaveBeenCalledWith(['/airplanes']);
    });

    it('disables submit while saving', async () => {
      api.create.mockReturnValue(new Subject<void>());
      const { fixture, el, form } = await render();
      form.patchValue({
        brand: 'Airbus',
        model: 'A320',
        seats: { economy: { rows: 1, columns: 1 } },
      });
      submit(el);
      await settle(fixture);
      expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    });

    it('shows server errors, keeps the input and reuses the id on retry', async () => {
      api.create.mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { message: 'An airplane with model A320 already exists' },
            }),
        ),
      );
      const { fixture, el, form } = await render();
      form.patchValue({
        brand: 'Airbus',
        model: 'A320',
        seats: { economy: { rows: 1, columns: 1 } },
      });
      submit(el);
      await settle(fixture);

      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        'An airplane with model A320 already exists',
      );
      expect(form.controls.model.value).toBe('A320');
      expect(navigate).not.toHaveBeenCalled();

      submit(el);
      expect(api.create.mock.calls[1][0].id).toBe(api.create.mock.calls[0][0].id);
      expect(navigate).toHaveBeenCalled();
    });
  });

  describe('edit', () => {
    it('loads the airplane by listing, and saves it as an update keeping its id', async () => {
      const airplane = airplaneFixture();
      api.list.mockReturnValue(of([airplane]));
      const { fixture, el, form } = await render(airplane.id);

      expect(form.controls.model.value).toBe('737-800');
      expect(form.controls.seats.controls.business.controls.rows.value).toBe(4);
      expect(form.controls.seats.controls.business.controls.rows.enabled).toBe(true);
      expect(form.controls.seats.controls.first.controls.rows.disabled).toBe(true);
      expect(capacityText(el)).toBe('Passenger capacity: 166');

      form.controls.model.setValue('737-900');
      await settle(fixture);
      submit(el);
      expect(api.create).not.toHaveBeenCalled();
      expect(api.update).toHaveBeenCalledWith(airplaneInputFixture({ model: '737-900' }));
      expect(snackOpen.mock.calls[0][0]).toBe('Boeing 737-900 was updated.');
    });

    it('shows the not-found state when no airplane has the id, without a retry', async () => {
      const { el } = await render('missing');
      const alert = el.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('This airplane does not exist');
      expect(alert?.querySelector('button')).toBeNull();
      expect(el.querySelector('form')).toBeNull();
    });

    it('offers retry when loading fails', async () => {
      api.list.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
      api.list.mockReturnValueOnce(of([airplaneFixture()]));
      const { fixture, el, form } = await render(airplaneFixture().id);
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');

      el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
      await settle(fixture);
      expect(form.controls.brand.value).toBe('Boeing');
    });
  });
});
