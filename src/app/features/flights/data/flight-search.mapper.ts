import { Airport, isAirport } from './airport.model';
import { FlightSearchCriteria, FlightStatus } from './flight.model';

/** The search form's value. */
export interface FlightSearchFilters {
  origin: Airport | null;
  destination: Airport | null;
  /** A calendar day, in local time. */
  departureFrom: Date | null;
  /** A calendar day, in local time. Flights during that whole day match. */
  departureTo: Date | null;
  status: FlightStatus | null;
  /** `true` for delayed flights, `false` for on-time ones, `null` for both. */
  isDelayed: boolean | null;
  airlineCode: string | null;
}

export function emptyFilters(): FlightSearchFilters {
  return {
    origin: null,
    destination: null,
    departureFrom: null,
    departureTo: null,
    status: null,
    isDelayed: null,
    airlineCode: null,
  };
}

/** Upcoming flights: departing from the start of today. */
export function defaultFilters(today = new Date()): FlightSearchFilters {
  return { ...emptyFilters(), departureFrom: startOfDay(today) };
}

/** Leaves out empty filters. Picked days become local start and end of day, sent as UTC. */
export function toSearchCriteria(filters: FlightSearchFilters): FlightSearchCriteria {
  const criteria: FlightSearchCriteria = {};
  // A control can still hold typed text if the user never picked an airport
  if (isAirport(filters.origin)) criteria.origin = filters.origin.iataCode;
  if (isAirport(filters.destination)) criteria.destination = filters.destination.iataCode;
  if (filters.departureFrom)
    criteria.departureFrom = startOfDay(filters.departureFrom).toISOString();
  if (filters.departureTo) criteria.departureTo = endOfDay(filters.departureTo).toISOString();
  if (filters.status) criteria.status = filters.status;
  if (filters.isDelayed !== null) criteria.isDelayed = filters.isDelayed;
  if (filters.airlineCode) criteria.airlineCode = filters.airlineCode;
  return criteria;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}
