import { Airline } from '../../airlines/data/airline.model';
import { Airplane } from '../../airplanes/data/airplane.model';
import { Airport } from './airport.model';

/** The API's `FlightStatus` values, in the order the status filter lists them. */
export const FLIGHT_STATUSES = [
  'scheduled',
  'checkInOpen',
  'checkInClosed',
  'onTime',
  'advanced',
  'delayed',
  'gateChanged',
  'boarding',
  'finalCall',
  'gateClosed',
  'departed',
  'inAir',
  'diverted',
  'landed',
  'arrived',
  'cancelled',
  'unknown',
] as const;

export type FlightStatus = (typeof FLIGHT_STATUSES)[number];

/** The API's flight code value object, serialized with its private fields. */
export interface FlightCode {
  prefix: string;
  correlative: number;
}

/** A search result. The API also sends `seats`, which the panel doesn't use. */
export interface Flight {
  id: string;
  code: FlightCode;
  origin: Airport;
  destination: Airport;
  airline: Airline;
  airplane: Airplane;
  /** ISO date-time. */
  departure: string;
  /** ISO date-time. */
  arrival: string;
  status: FlightStatus;
  basePrice: number;
  /** Statute miles. */
  distance: number;
  isFullyReserved: boolean;
  /**
   * Bumped by every save and by every order. `PUT /flights/:id` sends back the version
   * the form loaded, and is rejected with 409 if the flight has orders and it's stale.
   */
  version: number;
}

/** The body of `QUERY /flights` (the API's `SearchFlightsDto`). */
export interface FlightSearchCriteria {
  /** IATA code. */
  origin?: string;
  /** IATA code. */
  destination?: string;
  /** ISO date-time, inclusive. */
  departureFrom?: string;
  /** ISO date-time, inclusive. */
  departureTo?: string;
  status?: FlightStatus;
  airlineCode?: string;
  page?: number;
  limit?: number;
}

/**
 * The body of `POST /flights` (the API's `CreateFlightDto`). The API only reads the
 * airline's and airplane's ids, but validates the airports in full. It sets the code,
 * status, seats and distance itself.
 */
export interface CreateFlightInput {
  id: string;
  airline: Airline;
  airplane: Airplane;
  origin: Airport;
  destination: Airport;
  /** ISO date-time. */
  departure: string;
  /** ISO date-time. */
  arrival: string;
  basePrice: number;
}

/**
 * The body of `PUT /flights/:id`. Only a scheduled flight can be edited. Changing the
 * airline gives the flight a new code. Departure, arrival and status change through
 * their own endpoints.
 */
export interface UpdateFlightInput {
  airline: Airline;
  airplane: Airplane;
  origin: Airport;
  destination: Airport;
  basePrice: number;
  version: number;
}

/** The body of `PATCH /flights/schedule`. The API also sets the status to advanced or delayed. */
export interface FlightScheduleInput {
  id: string;
  /** ISO date-time. */
  departure: string;
  /** ISO date-time. */
  arrival: string;
}

/** The body of `PATCH /flights/status`. */
export interface FlightStatusInput {
  id: string;
  status: FlightStatus;
}

/** Such as "AR1132". */
export function flightCode(flight: Flight): string {
  return `${flight.code.prefix}${flight.code.correlative}`;
}
