/** The API's `AirportType`: the import keeps only large and medium airports. */
export type AirportType = 'large_airport' | 'medium_airport';

/**
 * The API's airport, as `GET /airports` returns it. `POST /flights` validates the
 * airports it receives against this whole shape, so send them back as received.
 */
export interface Airport {
  id: string;
  iataCode: string;
  icaoCode: string | null;
  name: string;
  city: string | null;
  countryCode: string;
  countryName: string;
  /** Such as "SA". */
  continent: string;
  latitude: number;
  longitude: number;
  elevationFt: number | null;
  type: AirportType;
}

/** Such as "EZE · Ministro Pistarini International Airport". */
export function airportLabel(airport: Airport): string {
  return `${airport.iataCode} · ${airport.name}`;
}

/** While the user types, an autocomplete control holds the text instead of an airport. */
export function isAirport(value: unknown): value is Airport {
  return typeof value === 'object' && value !== null && 'iataCode' in value;
}
