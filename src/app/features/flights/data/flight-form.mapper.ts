import { Airline } from '../../airlines/data/airline.model';
import { Airplane } from '../../airplanes/data/airplane.model';
import { Airport } from './airport.model';
import { CreateFlightInput, Flight, FlightScheduleInput, UpdateFlightInput } from './flight.model';

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

/** Airline, airplane, route and price: what `POST` and `PUT /flights` share. */
export interface FlightDetailsValue {
  airline: Airline;
  airplane: Airplane;
  origin: Airport;
  destination: Airport;
  basePrice: number;
}

/** Dates are local days from the date pickers. */
export interface FlightScheduleValue {
  departureDate: Date;
  departureTime: TimeOfDay;
  arrivalDate: Date;
  arrivalTime: TimeOfDay;
}

/** 12 AM is midnight and 12 PM is noon. */
export function toHours24({ hour, period }: TimeOfDay): number {
  return (hour % 12) + (period === 'PM' ? 12 : 0);
}

/** The inverse of `toHours24`, for a local date-time. */
export function toTimeOfDay(date: Date): TimeOfDay {
  const hours = date.getHours();
  return { hour: hours % 12 || 12, minute: date.getMinutes(), period: hours < 12 ? 'AM' : 'PM' };
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

export function toCreateFlightInput(
  id: string,
  details: FlightDetailsValue,
  schedule: FlightScheduleValue,
): CreateFlightInput {
  return { id, ...details, ...toScheduleTimes(schedule) };
}

export function toUpdateFlightInput(
  details: FlightDetailsValue,
  version: number,
): UpdateFlightInput {
  return { ...details, version };
}

export function toScheduleInput(id: string, schedule: FlightScheduleValue): FlightScheduleInput {
  return { id, ...toScheduleTimes(schedule) };
}

export function toDetailsValue(flight: Flight): FlightDetailsValue {
  return {
    airline: flight.airline,
    airplane: flight.airplane,
    origin: flight.origin,
    destination: flight.destination,
    basePrice: flight.basePrice,
  };
}

/** Splits the stored date-times into the pickers' local day and time. */
export function toScheduleValue(flight: Flight): FlightScheduleValue {
  const departure = new Date(flight.departure);
  const arrival = new Date(flight.arrival);
  return {
    departureDate: startOfDay(departure),
    departureTime: toTimeOfDay(departure),
    arrivalDate: startOfDay(arrival),
    arrivalTime: toTimeOfDay(arrival),
  };
}

function toScheduleTimes(schedule: FlightScheduleValue): { departure: string; arrival: string } {
  return {
    departure: atTime(schedule.departureDate, schedule.departureTime).toISOString(),
    arrival: atTime(schedule.arrivalDate, schedule.arrivalTime).toISOString(),
  };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
