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

/** A search result. The API also sends `seats`, which the list doesn't use. */
export interface Flight {
  id: string;
  code: FlightCode;
  origin: Airport;
  destination: Airport;
  airline: Airline;
  /** ISO date-time. */
  departure: string;
  /** ISO date-time. */
  arrival: string;
  status: FlightStatus;
  basePrice: number;
  /** Statute miles. */
  distance: number;
  isFullyReserved: boolean;
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

/** Such as "AR1132". */
export function flightCode(flight: Flight): string {
  return `${flight.code.prefix}${flight.code.correlative}`;
}
