import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { translocoTesting } from '../../../core/i18n/transloco-testing';
import { AirlinesApi } from '../../airlines/data/airlines-api';
import { airlineFixture } from '../../airlines/testing/airline.fixture';
import { AirplanesApi } from '../../airplanes/data/airplanes-api';
import { airplaneFixture } from '../../airplanes/testing/airplane.fixture';
import { AirportsApi } from '../data/airports-api';
import { Flight } from '../data/flight.model';
import { FlightsApi } from '../data/flights-api';
import { FlightsStore } from '../data/flights.store';
import { ezeiza, flightFixture, heathrow } from '../testing/flight.fixture';
import { FlightForm } from './flight-form';

describe('FlightForm', () => {
  let api: { search: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let airplanesList: ReturnType<typeof vi.fn>;
  let snackOpen: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  async function render() {
    const fixture = TestBed.createComponent(FlightForm);
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, form: fixture.componentInstance['form'] };
  }

  async function settle(fixture: ComponentFixture<FlightForm>) {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const submit = (el: HTMLElement) =>
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));

  const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? '';

  type Form = Awaited<ReturnType<typeof render>>['form'];

  function fillValid(form: Form) {
    form.setValue({
      details: {
        airline: airlineFixture(),
        airplane: airplaneFixture(),
        origin: ezeiza,
        destination: heathrow,
        basePrice: 850.5,
      },
      schedule: {
        departureDate: new Date(2026, 11, 1),
        departureTime: { hour: 10, minute: 5, period: 'AM' },
        arrivalDate: new Date(2026, 11, 2),
        arrivalTime: { hour: 12, minute: 15, period: 'AM' },
      },
    });
  }

  beforeEach(() => {
    api = { search: vi.fn(), create: vi.fn() };
    airplanesList = vi.fn(() => of([airplaneFixture()]));
    snackOpen = vi.fn();
    TestBed.configureTestingModule({
      imports: [FlightForm, translocoTesting()],
      providers: [
        provideRouter([]),
        provideNativeDateAdapter(),
        FlightsStore,
        { provide: FlightsApi, useValue: api },
        { provide: AirlinesApi, useValue: { list: () => of([airlineFixture()]) } },
        { provide: AirplanesApi, useValue: { list: airplanesList } },
        { provide: AirportsApi, useValue: { search: () => of([]) } },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
      ],
    });
    navigate = vi.fn(() => Promise.resolve(true));
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate as never);
  });

  it('loads the airline and airplane options, and clears the last save error', async () => {
    const store = TestBed.inject(FlightsStore);
    api.create.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    store.create({ input: {} as never, onSuccess: vi.fn() });
    expect(store.saveErrors().create).toBeDefined();

    await render();
    expect(store.saveErrors()).toEqual({});
    expect(store.airlines()).toEqual([airlineFixture()]);
    expect(store.airplanes()).toEqual([airplaneFixture()]);
  });

  it('shows required errors and does not save an empty form', async () => {
    const { fixture, el } = await render();
    submit(el);
    await settle(fixture);

    expect(api.create).not.toHaveBeenCalled();
    expect(el.querySelectorAll('mat-error').length).toBeGreaterThan(0);
    expect(text(el)).toContain('This field is required');
    expect(el.querySelectorAll('.time-error')).toHaveLength(2);
    expect(text(el)).toContain('Choose the hour, minute and AM or PM.');
  });

  it('offers hours 1 to 12, minutes in 5-minute steps, and AM/PM', async () => {
    const { fixture, el } = await render();
    const optionsOf = async (index: number) => {
      el.querySelectorAll<HTMLElement>('.time mat-select')[index].click();
      await settle(fixture);
      const options = Array.from(document.querySelectorAll('mat-option')).map((option) =>
        option.textContent?.trim(),
      );
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      (document.querySelector('.cdk-overlay-container') as HTMLElement).innerHTML = '';
      return options;
    };

    expect(await optionsOf(0)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
    ]);
    expect(await optionsOf(1)).toEqual([
      '00',
      '05',
      '10',
      '15',
      '20',
      '25',
      '30',
      '35',
      '40',
      '45',
      '50',
      '55',
    ]);
    expect(await optionsOf(2)).toEqual(['AM', 'PM']);
  });

  it('picks an option by typing its number into a focused select', async () => {
    const { fixture, el, form } = await render();
    const minute = el.querySelectorAll<HTMLElement>('.time mat-select')[1];
    minute.focus();
    for (const key of ['0', '5']) {
      minute.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    await settle(fixture);
    expect(form.controls.schedule.controls.departureTime.controls.minute.value).toBe(5);
  });

  it('treats typed text in an airport field as missing', async () => {
    const { form } = await render();
    const origin = form.controls.details.controls.origin;
    origin.setValue('Ezei' as never);
    expect(origin.hasError('required')).toBe(true);
    origin.setValue(ezeiza);
    expect(origin.valid).toBe(true);
  });

  it('rejects the same airport at both ends', async () => {
    const { fixture, el, form } = await render();
    fillValid(form);
    form.patchValue({ details: { destination: { ...ezeiza } } });
    expect(form.controls.details.hasError('sameAirports')).toBe(true);

    submit(el);
    await settle(fixture);
    expect(api.create).not.toHaveBeenCalled();
    expect(text(el)).toContain('Origin and destination must be different.');
  });

  it('rejects an arrival that is not after the departure', async () => {
    const { fixture, el, form } = await render();
    fillValid(form);
    form.patchValue({
      schedule: {
        arrivalDate: new Date(2026, 11, 1),
        arrivalTime: { hour: 10, minute: 5, period: 'AM' },
      },
    });
    expect(form.controls.schedule.hasError('arrivalBeforeDeparture')).toBe(true);

    submit(el);
    await settle(fixture);
    expect(api.create).not.toHaveBeenCalled();
    expect(text(el)).toContain('Arrival must be after departure.');
  });

  it.each([
    [null, false],
    [-1, false],
    [0, true],
    [850.5, true],
    [10.125, false],
  ])('base price %j valid: %s', async (value, valid) => {
    const { form } = await render();
    const basePrice = form.controls.details.controls.basePrice;
    basePrice.setValue(value);
    expect(basePrice.valid).toBe(valid);
  });

  it('creates the flight, then shows its code and goes back to the list', async () => {
    const saved = flightFixture({ code: { prefix: 'LG', correlative: 7 } });
    api.create.mockReturnValue(of(saved));
    const { fixture, el, form } = await render();
    fillValid(form);
    submit(el);
    await settle(fixture);

    const body = api.create.mock.calls[0][0];
    expect(body).toMatchObject({
      airline: airlineFixture(),
      airplane: airplaneFixture(),
      origin: ezeiza,
      destination: heathrow,
      departure: new Date(2026, 11, 1, 10, 5).toISOString(),
      arrival: new Date(2026, 11, 2, 0, 15).toISOString(),
      basePrice: 850.5,
    });
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(snackOpen).toHaveBeenCalledWith('Flight LG7 was created.', 'Dismiss', {
      duration: 4000,
    });
    expect(navigate).toHaveBeenCalledWith(['/flights']);
  });

  it('shows the API messages on error and retries with the same id', async () => {
    const responses: Subject<Flight>[] = [];
    api.create.mockImplementation(() => {
      const response = new Subject<Flight>();
      responses.push(response);
      return response;
    });
    const { fixture, el, form } = await render();
    fillValid(form);
    submit(el);
    responses[0].error(
      new HttpErrorResponse({
        status: 409,
        error: { message: 'Flight code LG7 is already taken' },
      }),
    );
    await settle(fixture);

    expect(el.querySelector('.save-error')?.textContent).toContain(
      'Flight code LG7 is already taken',
    );
    expect(navigate).not.toHaveBeenCalled();

    submit(el);
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(api.create.mock.calls[1][0].id).toBe(api.create.mock.calls[0][0].id);
  });

  it('shows the generic message for a server error', async () => {
    api.create.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const { fixture, el, form } = await render();
    fillValid(form);
    submit(el);
    await settle(fixture);
    expect(el.querySelector('.save-error')?.textContent).toContain(
      'Something went wrong. Please try again.',
    );
  });

  it('offers a retry when the airplanes fail to load', async () => {
    airplanesList.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    const { fixture, el } = await render();
    expect(text(el)).toContain("Couldn't load airplanes.");

    const retry = Array.from(el.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Retry',
    )!;
    retry.click();
    await settle(fixture);
    expect(airplanesList).toHaveBeenCalledTimes(2);
    expect(text(el)).not.toContain("Couldn't load airplanes.");
  });
});
