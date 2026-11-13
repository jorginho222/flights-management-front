import { Airline } from '../../airlines/data/airline.model';
import { Airplane } from '../../airplanes/data/airplane.model';
import { Airport } from './airport.model';

/** The API's `FlightStatus` values, in the order the status filter lists them. */
export const FLIGHT_STATUSES = [
  'scheduled',
  'checkInOpen',
  'checkInClosed',
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
  /** Set once the departure or arrival changed. The status stays as it was. */
  wasRescheduled: boolean;
  /**
   * Still on the ground past its departure plus the API's tolerance. It stays once the
   * flight departs or is cancelled. The API sets it; the panel never computes it.
   */
  isDelayed: boolean;
  /**
   * Bumped by every save and by every order. `PUT /flights/:id` sends back the version
   * the form loaded, and is rejected with 409 if the flight has orders and it's stale.
   */
  version: number;
}

/**
 * The data of a `flight.updated` event from `GET /flights/events`, sent after a status or
 * schedule change, or when the API's delay job marks the flight delayed.
 */
export type FlightUpdate = Pick<
  Flight,
  'id' | 'status' | 'departure' | 'arrival' | 'wasRescheduled' | 'isDelayed' | 'version'
>;

/**
 * What `FlightsApi.updates` emits. `connected` comes on every open, with `reconnect` set after
 * a dropped connection: events sent while it was down are lost, so the shown data may be stale.
 */
export type FlightLiveEvent =
  | { type: 'updated'; flight: FlightUpdate }
  | { type: 'connected'; reconnect: boolean }
  | { type: 'disconnected' };

/**
 * The live connection as the list shows it. `off` when no screen is watching, or after the
 * browser gave up on the stream (such as an error response, which `EventSource` doesn't retry).
 */
export type FlightLiveState = 'off' | 'connecting' | 'connected' | 'reconnecting';

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
  isDelayed?: boolean;
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

/** The body of `PATCH /flights/schedule`. The API also sets `wasRescheduled` when a time changes. */
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
