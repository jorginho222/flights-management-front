import { FlightClass } from '../../../shared/flight-classes';

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
