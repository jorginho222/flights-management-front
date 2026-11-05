export const FLIGHT_CLASSES = ['economy', 'premiumEconomy', 'business', 'first'] as const;

export type FlightClass = (typeof FLIGHT_CLASSES)[number];

/** The underscore keys are the API's wire format. */
export interface LuggageRules {
  _priceHandBaggage: number;
  _maxHandBaggage: number;
  _priceCheckedLuggage: number;
  _priceExceededWeight: number;
}

export interface FlightClassPriceIncrement {
  class: FlightClass;
  increment: { value: number };
}

export interface Airline {
  id: string;
  name: string;
  code: string;
  luggageRules: LuggageRules;
  flightClassPriceIncrements: FlightClassPriceIncrement[];
  redeemFee: number;
}

export interface AirlineImportResult {
  imported: number;
}

/** One problem in an uploaded spreadsheet. `row` is the spreadsheet row number. */
export interface AirlineImportRowError {
  row: number;
  column: string;
  messages: string[];
}
