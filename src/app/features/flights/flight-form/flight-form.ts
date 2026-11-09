import { Component, inject, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { maxDecimals } from '../../../shared/forms/validators';
import { Airline } from '../../airlines/data/airline.model';
import { Airplane, airplaneName } from '../../airplanes/data/airplane.model';
import { AirportAutocomplete } from '../airport-autocomplete/airport-autocomplete';
import { Airport, isAirport } from '../data/airport.model';
import {
  atTime,
  DAY_PERIODS,
  DayPeriod,
  FlightFormValue,
  HOURS,
  MINUTES,
  TimeOfDay,
  toCreateFlightInput,
} from '../data/flight-form.mapper';
import { flightCode } from '../data/flight.model';
import { FlightsStore } from '../data/flights.store';

interface FieldError {
  key: string;
  params?: Record<string, unknown>;
}

/** The autocomplete control holds the typed text until an airport is picked. */
function airportPicked(control: AbstractControl): ValidationErrors | null {
  return isAirport(control.value) ? null : { required: true };
}

const isDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const isTime = (value: Partial<TimeOfDay> | undefined): value is TimeOfDay =>
  value?.hour != null && value.minute != null && value.period != null;

/** The API rejects a route that starts and ends at the same airport. */
function differentAirports(group: AbstractControl): ValidationErrors | null {
  const { origin, destination } = group.value as Partial<FlightFormValue>;
  return isAirport(origin) && isAirport(destination) && origin.iataCode === destination.iataCode
    ? { sameAirports: true }
    : null;
}

/** The API rejects a departure after the arrival. */
function arrivalAfterDeparture(group: AbstractControl): ValidationErrors | null {
  const { departureDate, departureTime, arrivalDate, arrivalTime } =
    group.value as Partial<FlightFormValue>;
  if (
    !isDate(departureDate) ||
    !isDate(arrivalDate) ||
    !isTime(departureTime) ||
    !isTime(arrivalTime)
  ) {
    return null;
  }
  const departure = atTime(departureDate, departureTime);
  const arrival = atTime(arrivalDate, arrivalTime);
  return arrival > departure ? null : { arrivalBeforeDeparture: true };
}

function timeGroup() {
  return new FormGroup({
    hour: new FormControl<number | null>(null, Validators.required),
    minute: new FormControl<number | null>(null, Validators.required),
    period: new FormControl<DayPeriod | null>(null, Validators.required),
  });
}

/** Flights can only be created: the API has no endpoint to edit one in full. */
@Component({
  selector: 'app-flight-form',
  imports: [
    AirportAutocomplete,
    MatButtonModule,
    MatDatepickerModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './flight-form.html',
  styleUrl: './flight-form.scss',
})
export class FlightForm implements OnInit {
  protected readonly store = inject(FlightsStore);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  protected readonly airplaneName = airplaneName;
  protected readonly hours = HOURS;
  protected readonly minutes = MINUTES;
  protected readonly periods = DAY_PERIODS;
  /** Keeps a selection when the options are reloaded as new objects. */
  protected readonly sameId = (a: { id: string } | null, b: { id: string } | null): boolean =>
    a?.id === b?.id;

  protected readonly form = new FormGroup(
    {
      airline: new FormControl<Airline | null>(null, Validators.required),
      airplane: new FormControl<Airplane | null>(null, Validators.required),
      origin: new FormControl<Airport | null>(null, airportPicked),
      destination: new FormControl<Airport | null>(null, airportPicked),
      departureDate: new FormControl<Date | null>(null, Validators.required),
      departureTime: timeGroup(),
      arrivalDate: new FormControl<Date | null>(null, Validators.required),
      arrivalTime: timeGroup(),
      basePrice: new FormControl<number | null>(null, [
        Validators.required,
        Validators.min(0),
        maxDecimals(2),
      ]),
    },
    { validators: [differentAirports, arrivalAfterDeparture] },
  );

  /** Departure, then arrival: each is a date field and a time row of three selects. */
  protected readonly moments = [
    {
      key: 'departure',
      date: this.form.controls.departureDate,
      time: this.form.controls.departureTime,
    },
    { key: 'arrival', date: this.form.controls.arrivalDate, time: this.form.controls.arrivalTime },
  ];

  /** Kept across attempts, so retrying after a lost response can't create a second flight. */
  private newFlightId?: string;

  ngOnInit(): void {
    // The store outlives the screen, so clear the last session's save error
    this.store.resetForm();
    this.loadOptions();
  }

  protected loadOptions(): void {
    this.store.loadAirlines();
    this.store.loadAirplanes();
  }

  protected swapRoute(): void {
    const { origin, destination } = this.form.getRawValue();
    this.form.patchValue({ origin: destination, destination: origin });
  }

  protected fieldError(control: AbstractControl): FieldError | null {
    const errors = control.errors;
    if (!errors) {
      return null;
    }
    if (errors['matDatepickerParse']) {
      return { key: 'flights.form.invalidDate' };
    }
    if (errors['required']) {
      return { key: 'validation.required' };
    }
    if (errors['min']) {
      return { key: 'validation.min', params: { min: errors['min'].min } };
    }
    if (errors['maxDecimals']) {
      return { key: 'validation.maxDecimals', params: { max: errors['maxDecimals'].max } };
    }
    return null;
  }

  /** Route errors show under the route row, because the autocomplete has no error slot. */
  protected routeError(): string | null {
    const { origin, destination } = this.form.controls;
    if ((origin.touched && origin.invalid) || (destination.touched && destination.invalid)) {
      return 'validation.required';
    }
    return this.form.hasError('sameAirports') ? 'flights.form.sameAirports' : null;
  }

  /** Such as "05". */
  protected pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  /** One message under the three selects, which are too narrow for their own. */
  protected timeIncomplete(time: AbstractControl): boolean {
    return time.touched && time.invalid;
  }

  protected scheduleError(): boolean {
    const { arrivalDate, arrivalTime } = this.form.controls;
    return (
      this.form.hasError('arrivalBeforeDeparture') && (arrivalDate.touched || arrivalTime.touched)
    );
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = (this.newFlightId ??= crypto.randomUUID());
    const flight = toCreateFlightInput(id, this.form.getRawValue() as FlightFormValue);

    this.store.create({
      flight,
      onSuccess: (saved) => {
        this.snackBar.open(
          this.transloco.translate('flights.form.created', { code: flightCode(saved) }),
          this.transloco.translate('common.dismiss'),
          { duration: 4000 },
        );
        void this.router.navigate(['/flights']);
      },
    });
  }
}
