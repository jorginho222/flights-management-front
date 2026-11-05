import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { translocoTesting } from '../../../core/i18n/transloco-testing';
import { AirlinesApi } from '../data/airlines-api';
import { AirlinesStore } from '../data/airlines.store';
import { airlineFixture } from '../testing/airline.fixture';
import { AirlineForm } from './airline-form';

describe('AirlineForm', () => {
  let api: Record<'get' | 'create' | 'update', ReturnType<typeof vi.fn>>;
  let snackOpen: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  const validValue = {
    name: 'Sky Air',
    code: 'SK',
    redeemFee: 10.25,
    luggage: {
      handBaggagePrice: 1,
      maxHandBaggage: 2,
      checkedLuggagePrice: 3,
      exceededWeightPrice: 4,
    },
    classIncrements: { economy: 0, premiumEconomy: 5, business: 6, first: 7 },
  };

  async function render(id?: string) {
    const fixture = TestBed.createComponent(AirlineForm);
    if (id) {
      fixture.componentRef.setInput('id', id);
    }
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, form: fixture.componentInstance['form'] };
  }

  async function settle(fixture: ComponentFixture<AirlineForm>) {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const submit = (el: HTMLElement) =>
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));

  beforeEach(() => {
    api = { get: vi.fn(), create: vi.fn(() => of(undefined)), update: vi.fn(() => of(undefined)) };
    snackOpen = vi.fn();
    TestBed.configureTestingModule({
      imports: [AirlineForm, translocoTesting()],
      providers: [
        provideRouter([]),
        AirlinesStore,
        { provide: AirlinesApi, useValue: api },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
      ],
    });
    navigate = vi.fn(() => Promise.resolve(true));
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate as never);
  });

  describe('validators', () => {
    it.each([
      ['ab', false],
      ['abc', true],
      ['a'.repeat(50), true],
      ['a'.repeat(51), false],
      ['  ab  ', false],
      ['', false],
    ])('name %j valid: %s', async (value, valid) => {
      const { form } = await render();
      form.controls.name.setValue(value);
      expect(form.controls.name.valid).toBe(valid);
    });

    it.each([
      ['A', false],
      ['AB', true],
      ['ABC', false],
      ['A ', false],
    ])('code %j valid: %s', async (value, valid) => {
      const { form } = await render();
      form.controls.code.setValue(value);
      expect(form.controls.code.valid).toBe(valid);
    });

    it.each([
      [null, false],
      [-0.01, false],
      [0, true],
      [10, true],
      [10.5, true],
      [10.25, true],
      [10.255, false],
    ])('redeem fee %j valid: %s', async (value, valid) => {
      const { form } = await render();
      form.controls.redeemFee.setValue(value);
      expect(form.controls.redeemFee.valid).toBe(valid);
    });

    it.each([
      [null, false],
      [-1, false],
      [0, true],
      [2, true],
      [2.5, false],
    ])('max hand baggage %j valid: %s', async (value, valid) => {
      const { form } = await render();
      const control = form.controls.luggage.controls.maxHandBaggage;
      control.setValue(value);
      expect(control.valid).toBe(valid);
    });

    it.each([
      [null, false],
      [-1, false],
      [0, true],
      [2.5, true],
    ])('prices and increments %j valid: %s', async (value, valid) => {
      const { form } = await render();
      const controls = [
        form.controls.luggage.controls.handBaggagePrice,
        form.controls.luggage.controls.checkedLuggagePrice,
        form.controls.luggage.controls.exceededWeightPrice,
        form.controls.classIncrements.controls.economy,
        form.controls.classIncrements.controls.premiumEconomy,
        form.controls.classIncrements.controls.business,
        form.controls.classIncrements.controls.first,
      ];
      for (const control of controls) {
        control.setValue(value);
        expect(control.valid).toBe(valid);
      }
    });
  });

  it('uppercases the code as it is typed', async () => {
    const { fixture, el, form } = await render();
    const input = el.querySelector<HTMLInputElement>('input[formControlName="code"]')!;
    input.value = 'ab';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(form.controls.code.value).toBe('AB');
    expect(input.value).toBe('AB');
  });

  describe('create', () => {
    it('does not call the API while invalid, and shows the errors', async () => {
      const { fixture, el } = await render();
      submit(el);
      await settle(fixture);
      expect(api.create).not.toHaveBeenCalled();
      expect(el.textContent).toContain('This field is required');
    });

    it('posts a generated UUID, all four classes, then returns to the list', async () => {
      const { el, form } = await render();
      form.setValue(validValue);
      submit(el);

      expect(api.update).not.toHaveBeenCalled();
      const body = api.create.mock.calls[0][0];
      expect(body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(body.flightClassPriceIncrements.map((item: { class: string }) => item.class)).toEqual([
        'economy',
        'premiumEconomy',
        'business',
        'first',
      ]);
      expect(snackOpen.mock.calls[0][0]).toBe('Sky Air was created.');
      expect(navigate).toHaveBeenCalledWith(['/airlines']);
    });

    it('disables submit while saving', async () => {
      const pending = new Subject<void>();
      api.create.mockReturnValue(pending);
      const { fixture, el, form } = await render();
      form.setValue(validValue);
      submit(el);
      await settle(fixture);
      expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    });

    it('shows server errors, keeps the input and reuses the id on retry', async () => {
      api.create.mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: { message: ['code must be longer', 'name is bad'] },
            }),
        ),
      );
      const { fixture, el, form } = await render();
      form.setValue(validValue);
      submit(el);
      await settle(fixture);

      const alert = el.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('code must be longer');
      expect(alert?.textContent).toContain('name is bad');
      expect(form.controls.name.value).toBe('Sky Air');
      expect(navigate).not.toHaveBeenCalled();

      submit(el);
      expect(api.create.mock.calls[1][0].id).toBe(api.create.mock.calls[0][0].id);
      expect(navigate).toHaveBeenCalled();
    });

    it('shows a generic message for a 500', async () => {
      api.create.mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 500, error: { message: 'Internal server error' } }),
        ),
      );
      const { fixture, el, form } = await render();
      form.setValue(validValue);
      submit(el);
      await settle(fixture);
      const alert = el.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('Something went wrong');
      expect(alert?.textContent).not.toContain('Internal server error');
    });
  });

  describe('edit', () => {
    it('loads the airline into the form and saves it as an update keeping its id', async () => {
      const airline = airlineFixture();
      api.get.mockReturnValue(of(airline));
      const { el, form } = await render(airline.id);

      expect(api.get).toHaveBeenCalledWith(airline.id);
      expect(form.controls.name.value).toBe(airline.name);
      expect(form.controls.luggage.controls.handBaggagePrice.value).toBe(100);
      expect(form.controls.classIncrements.controls.first.value).toBe(30);

      form.controls.name.setValue('Renamed');
      submit(el);
      expect(api.create).not.toHaveBeenCalled();
      expect(api.update).toHaveBeenCalledWith({ ...airline, name: 'Renamed' });
      expect(snackOpen.mock.calls[0][0]).toBe('Renamed was updated.');
    });

    it('requires a missing class to be filled in before saving', async () => {
      const airline = airlineFixture({
        flightClassPriceIncrements: [{ class: 'economy', increment: { value: 0 } }],
      });
      api.get.mockReturnValue(of(airline));
      const { el, form } = await render(airline.id);
      expect(form.controls.classIncrements.controls.business.value).toBeNull();

      submit(el);
      expect(api.update).not.toHaveBeenCalled();
    });

    it('shows the not-found state on 404, without a retry', async () => {
      api.get.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      const { el } = await render('missing');
      const alert = el.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('This airline does not exist');
      expect(alert?.querySelector('button')).toBeNull();
      expect(el.querySelector('form')).toBeNull();
    });

    it('offers retry when loading fails for another reason', async () => {
      api.get.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
      api.get.mockReturnValueOnce(of(airlineFixture()));
      const { fixture, el, form } = await render(airlineFixture().id);
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');

      el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
      await settle(fixture);
      expect(form.controls.name.value).toBe('Aerolineas Lagarza');
      expect(el.querySelector('form')).not.toBeNull();
    });
  });

  it('does not reuse state from a previous form session', async () => {
    const pending: Observable<void> = throwError(
      () => new HttpErrorResponse({ status: 400, error: { message: 'old error' } }),
    );
    api.create.mockReturnValue(pending);
    const first = await render();
    first.form.setValue(validValue);
    submit(first.el);
    await settle(first.fixture);
    expect(first.el.textContent).toContain('old error');
    first.fixture.destroy();

    const second = await render();
    expect(second.el.textContent).not.toContain('old error');
    expect(second.form.controls.name.value).toBe('');
  });
});
