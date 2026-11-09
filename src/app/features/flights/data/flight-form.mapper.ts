import { Airline } from '../../airlines/data/airline.model';
import { Airplane } from '../../airplanes/data/airplane.model';
import { Airport } from './airport.model';
import { CreateFlightInput } from './flight.model';

export const DAY_PERIODS = ['AM', 'PM'] as const;
export type DayPeriod = (typeof DAY_PERIODS)[number];

/** Hours in the order the hour select lists them, so typing "1" picks 1, not 12. */
export const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
export const MINUTE_STEP = 5;
export const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, index) => index * MINUTE_STEP);

/** A local time on a 12-hour clock, as the hour, minute and AM/PM selects pick it. */
export interface TimeOfDay {
  /** 1 to 12. */
  hour: number;
  minute: number;
  period: DayPeriod;
}

/** The create form's value once it is valid. Dates are local days from the date pickers. */
export interface FlightFormValue {
  airline: Airline;
  airplane: Airplane;
  origin: Airport;
  destination: Airport;
  departureDate: Date;
  departureTime: TimeOfDay;
  arrivalDate: Date;
  arrivalTime: TimeOfDay;
  basePrice: number;
}

/** 12 AM is midnight and 12 PM is noon. */
export function toHours24({ hour, period }: TimeOfDay): number {
  return (hour % 12) + (period === 'PM' ? 12 : 0);
}

/** The day of `date` at `time`, in local time. */
export function atTime(date: Date, time: TimeOfDay): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    toHours24(time),
    time.minute,
  );
}

export function toCreateFlightInput(id: string, value: FlightFormValue): CreateFlightInput {
  return {
    id,
    airline: value.airline,
    airplane: value.airplane,
    origin: value.origin,
    destination: value.destination,
    departure: atTime(value.departureDate, value.departureTime).toISOString(),
    arrival: atTime(value.arrivalDate, value.arrivalTime).toISOString(),
    basePrice: value.basePrice,
  };
}
