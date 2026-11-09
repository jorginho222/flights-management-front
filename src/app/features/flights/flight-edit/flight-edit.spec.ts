import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MAT_TABS_CONFIG } from '@angular/material/tabs';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { translocoTesting } from '../../../core/i18n/transloco-testing';
import { AirlinesApi } from '../../airlines/data/airlines-api';
import { airlineFixture } from '../../airlines/testing/airline.fixture';
import { AirplanesApi } from '../../airplanes/data/airplanes-api';
import { airplaneFixture } from '../../airplanes/testing/airplane.fixture';
import { AirportsApi } from '../data/airports-api';
import { emptyFilters } from '../data/flight-search.mapper';
import { toDetailsValue, toScheduleValue } from '../data/flight-form.mapper';
import { Flight } from '../data/flight.model';
import { FlightsApi } from '../data/flights-api';
import { FlightsStore } from '../data/flights.store';
import { flightFixture, pageOf } from '../testing/flight.fixture';
import { FlightEdit } from './flight-edit';

describe('FlightEdit', () => {
  let api: Record<
    'search' | 'update' | 'updateSchedule' | 'updateStatus',
    ReturnType<typeof vi.fn>
  >;
  let snackOpen: ReturnType<typeof vi.fn>;

  /** Opens the edit screen the way the list does: with the flight among the search results. */
  async function render(flight: Flight | null = flightFixture(), id = flightFixture().id) {
    if (flight) {
      api.search.mockReturnValue(of(pageOf([flight])));
      TestBed.inject(FlightsStore).search(emptyFilters());
    }
    const fixture = TestBed.createComponent(FlightEdit);
    fixture.componentRef.setInput('id', id);
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance;
    return {
      fixture,
      el,
      details: component['detailsForm'],
      schedule: component['scheduleForm'],
      status: component['statusForm'],
    };
  }

  async function settle(fixture: ComponentFixture<unknown>) {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const text = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  async function openTab(fixture: ComponentFixture<unknown>, el: HTMLElement, label: string) {
    Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'))
      .find((tab) => text(tab) === label)!
      .click();
    await settle(fixture);
  }

  /** The Save button of the tab on show: the others aren't in the DOM. */
  const saveButton = (el: HTMLElement) =>
    el.querySelector<HTMLButtonElement>('.mat-mdc-tab-body-active button[type="submit"]')!;

  async function save(fixture: ComponentFixture<unknown>, el: HTMLElement) {
    saveButton(el).click();
    await settle(fixture);
  }

  beforeEach(() => {
    api = {
      search: vi.fn(),
      update: vi.fn(),
      updateSchedule: vi.fn(),
      updateStatus: vi.fn(),
    };
    snackOpen = vi.fn();
    TestBed.configureTestingModule({
      imports: [FlightEdit, translocoTesting()],
      providers: [
        provideRouter([]),
        provideNativeDateAdapter(),
        FlightsStore,
        { provide: FlightsApi, useValue: api },
        { provide: AirlinesApi, useValue: { list: () => of([airlineFixture()]) } },
        { provide: AirplanesApi, useValue: { list: () => of([airplaneFixture()]) } },
        { provide: AirportsApi, useValue: { search: () => of([]) } },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
        // The new tab's content only attaches once the switch animation ends
        { provide: MAT_TABS_CONFIG, useValue: { animationDuration: '0ms' } },
      ],
    });
  });

  it('fills the three tabs from the flight', async () => {
    const flight = flightFixture();
    const { el, details, schedule, status } = await render(flight);

    expect(text(el.querySelector('h1')!)).toBe('Edit flight LG1132');
    expect(Array.from(el.querySelectorAll('[role="tab"]')).map(text)).toEqual([
      'Airline, airplane, route and price',
      'Schedule',
      'Status',
    ]);
    expect(details.getRawValue()).toEqual(toDetailsValue(flight));
    expect(schedule.getRawValue()).toEqual(toScheduleValue(flight));
    expect(status.getRawValue()).toEqual({ status: 'scheduled' });
    expect(text(el)).toContain('Changing the airline gives the flight a new code.');
  });

  it('says the flight is not loaded when the store lacks it, such as after a reload', async () => {
    const { el } = await render(null);
    expect(text(el)).toContain("This flight isn't loaded");
    expect(el.querySelector('[role="tab"]')).toBeNull();
    expect(el.querySelector('.state a')?.getAttribute('href')).toBe('/flights');
  });

  it('saves the details with PUT and the loaded version, then shows the new code', async () => {
    const flight = flightFixture();
    const saved = flightFixture({
      basePrice: 900,
      version: 4,
      code: { prefix: 'LG', correlative: 1132 },
    });
    api.update.mockReturnValue(of(saved));
    const { fixture, el, details } = await render(flight);
    expect(saveButton(el).disabled).toBe(true);

    details.controls.basePrice.setValue(900);
    details.markAsDirty();
    await settle(fixture);
    expect(saveButton(el).disabled).toBe(false);
    await save(fixture, el);

    expect(api.update).toHaveBeenCalledExactlyOnceWith(flight.id, {
      ...toDetailsValue(flight),
      basePrice: 900,
      version: 3,
    });
    expect(snackOpen).toHaveBeenCalledWith('Flight LG1132 was updated.', 'Dismiss', {
      duration: 4000,
    });
    expect(details.pristine).toBe(true);
    expect(saveButton(el).disabled).toBe(true);
  });

  it('saves the schedule with PATCH, then refills the untouched status tab and locks the details', async () => {
    const flight = flightFixture();
    api.updateSchedule.mockImplementation(({ departure, arrival }) =>
      of({ ...flight, departure, arrival, status: 'delayed', version: 4 }),
    );
    const { fixture, el, schedule, status, details } = await render(flight);
    await openTab(fixture, el, 'Schedule');
    expect(text(el)).toContain('Saving a new schedule marks the flight Advanced');

    const time = toScheduleValue(flight).departureTime;
    schedule.controls.departureTime.setValue({ ...time, minute: 45 });
    schedule.markAsDirty();
    await settle(fixture);
    await save(fixture, el);

    const departure = new Date(flight.departure);
    departure.setMinutes(45, 0, 0);
    expect(api.updateSchedule).toHaveBeenCalledExactlyOnceWith({
      id: flight.id,
      departure: departure.toISOString(),
      arrival: flight.arrival,
    });
    expect(status.getRawValue()).toEqual({ status: 'delayed' });
    expect(details.disabled).toBe(true);

    await openTab(fixture, el, 'Airline, airplane, route and price');
    expect(text(el)).toContain(
      'Only scheduled flights can change these details, and this flight is Delayed.',
    );
    expect(saveButton(el).disabled).toBe(true);
  });

  it('saves the status with PATCH and keeps unsaved edits in the other tabs', async () => {
    const flight = flightFixture();
    api.updateStatus.mockReturnValue(of({ ...flight, status: 'boarding', version: 4 }));
    const { fixture, el, status, details } = await render(flight);
    details.controls.basePrice.setValue(999);
    details.markAsDirty();

    await openTab(fixture, el, 'Status');
    status.controls.status.setValue('boarding');
    status.markAsDirty();
    await settle(fixture);
    await save(fixture, el);

    expect(api.updateStatus).toHaveBeenCalledExactlyOnceWith({ id: flight.id, status: 'boarding' });
    expect(status.pristine).toBe(true);
    expect(details.controls.basePrice.value).toBe(999);
  });

  it('shows the API messages in the tab that failed', async () => {
    api.updateStatus.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 404, error: { message: 'Flight x not found' } }),
      ),
    );
    const { fixture, el, status } = await render();
    await openTab(fixture, el, 'Status');
    status.controls.status.setValue('cancelled');
    status.markAsDirty();
    await settle(fixture);
    await save(fixture, el);

    expect(text(el.querySelector('.mat-mdc-tab-body-active .save-error')!)).toBe(
      'Flight x not found',
    );
    expect(status.dirty).toBe(true);
    await openTab(fixture, el, 'Schedule');
    expect(el.querySelector('.mat-mdc-tab-body-active .save-error')).toBeNull();
  });

  it('locks the details of a flight that is not scheduled', async () => {
    const { el, details } = await render(flightFixture({ status: 'boarding' }));
    expect(details.disabled).toBe(true);
    expect(text(el)).toContain(
      'Only scheduled flights can change these details, and this flight is Boarding.',
    );
  });
});
