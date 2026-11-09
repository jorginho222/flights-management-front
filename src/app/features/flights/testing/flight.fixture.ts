import { PaginatedResult } from '../../../core/http/paginated-result';
import { airlineFixture } from '../../airlines/testing/airline.fixture';
import { airplaneFixture } from '../../airplanes/testing/airplane.fixture';
import { Airport } from '../data/airport.model';
import { Flight } from '../data/flight.model';

export function airportFixture(overrides: Partial<Airport> = {}): Airport {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    iataCode: 'EZE',
    icaoCode: 'SAEZ',
    name: 'Ministro Pistarini International Airport',
    city: 'Ezeiza',
    countryCode: 'AR',
    countryName: 'Argentina',
    continent: 'SA',
    latitude: -34.8222,
    longitude: -58.5358,
    elevationFt: 67,
    type: 'large_airport',
    ...overrides,
  };
}

export const ezeiza = airportFixture();
export const heathrow = airportFixture({
  id: '22222222-2222-4222-8222-222222222222',
  iataCode: 'LHR',
  icaoCode: 'EGLL',
  name: 'London Heathrow Airport',
  city: 'London',
  countryCode: 'GB',
  countryName: 'United Kingdom',
  continent: 'EU',
  latitude: 51.4706,
  longitude: -0.461941,
  elevationFt: 83,
});

export function flightFixture(overrides: Partial<Flight> = {}): Flight {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    code: { prefix: 'LG', correlative: 1132 },
    origin: ezeiza,
    destination: heathrow,
    airline: airlineFixture(),
    airplane: airplaneFixture(),
    departure: '2026-12-01T13:30:00.000Z',
    arrival: '2026-12-02T03:15:00.000Z',
    status: 'scheduled',
    basePrice: 850.5,
    distance: 6900,
    isFullyReserved: false,
    version: 3,
    ...overrides,
  };
}

export function pageOf<T>(
  items: T[],
  page = 1,
  limit = 20,
  totalItems = items.length,
): PaginatedResult<T> {
  return { items, meta: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) } };
}
