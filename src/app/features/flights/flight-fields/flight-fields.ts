import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { maxDecimals } from '../../../shared/forms/validators';
import { Airline } from '../../airlines/data/airline.model';
import { Airplane } from '../../airplanes/data/airplane.model';
import { Airport, isAirport } from '../data/airport.model';
import {
  atTime,
  DayPeriod,
  FlightDetailsValue,
  FlightScheduleValue,
  TimeOfDay,
} from '../data/flight-form.mapper';

/** Form groups, validators and error messages shared by the create and edit screens. */

export interface FieldError {
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
  const { origin, destination } = group.value as Partial<FlightDetailsValue>;
  return isAirport(origin) && isAirport(destination) && origin.iataCode === destination.iataCode
    ? { sameAirports: true }
    : null;
}

/** The API rejects a departure after the arrival. */
function arrivalAfterDeparture(group: AbstractControl): ValidationErrors | null {
  const { departureDate, departureTime, arrivalDate, arrivalTime } =
    group.value as Partial<FlightScheduleValue>;
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

/** Airline, airplane, route and price. */
export function detailsGroup() {
  return new FormGroup(
    {
      airline: new FormControl<Airline | null>(null, Validators.required),
      airplane: new FormControl<Airplane | null>(null, Validators.required),
      origin: new FormControl<Airport | null>(null, airportPicked),
      destination: new FormControl<Airport | null>(null, airportPicked),
      basePrice: new FormControl<number | null>(null, [
        Validators.required,
        Validators.min(0),
        maxDecimals(2),
      ]),
    },
    { validators: differentAirports },
  );
}

/** A date picker and hour, minute and AM/PM selects for each of departure and arrival. */
export function scheduleGroup() {
  return new FormGroup(
    {
      departureDate: new FormControl<Date | null>(null, Validators.required),
      departureTime: timeGroup(),
      arrivalDate: new FormControl<Date | null>(null, Validators.required),
      arrivalTime: timeGroup(),
    },
    { validators: arrivalAfterDeparture },
  );
}

export type FlightDetailsGroup = ReturnType<typeof detailsGroup>;
export type FlightScheduleGroup = ReturnType<typeof scheduleGroup>;

export function fieldError(control: AbstractControl): FieldError | null {
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
