/** The fields the panel uses from the API's airport. */
export interface Airport {
  id: string;
  iataCode: string;
  name: string;
  city: string | null;
  countryCode: string;
  countryName: string;
}

/** Such as "EZE · Ministro Pistarini International Airport". */
export function airportLabel(airport: Airport): string {
  return `${airport.iataCode} · ${airport.name}`;
}

/** While the user types, an autocomplete control holds the text instead of an airport. */
export function isAirport(value: unknown): value is Airport {
  return typeof value === 'object' && value !== null && 'iataCode' in value;
}
