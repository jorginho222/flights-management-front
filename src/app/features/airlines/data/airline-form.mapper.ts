import { Airline, FLIGHT_CLASSES, FlightClass } from './airline.model';

/** The form's shape. Number fields are null while the input is empty. */
export interface AirlineFormValue {
  name: string;
  code: string;
  redeemFee: number | null;
  luggage: {
    handBaggagePrice: number | null;
    maxHandBaggage: number | null;
    checkedLuggagePrice: number | null;
    exceededWeightPrice: number | null;
  };
  classIncrements: Record<FlightClass, number | null>;
}

export function toAirlineFormValue(airline: Airline): AirlineFormValue {
  const increments = airline.flightClassPriceIncrements ?? [];
  const incrementFor = (flightClass: FlightClass) =>
    increments.find((item) => item.class === flightClass)?.increment.value ?? null;

  return {
    name: airline.name,
    code: airline.code,
    redeemFee: airline.redeemFee,
    luggage: {
      handBaggagePrice: airline.luggageRules._priceHandBaggage,
      maxHandBaggage: airline.luggageRules._maxHandBaggage,
      checkedLuggagePrice: airline.luggageRules._priceCheckedLuggage,
      exceededWeightPrice: airline.luggageRules._priceExceededWeight,
    },
    classIncrements: {
      economy: incrementFor('economy'),
      premiumEconomy: incrementFor('premiumEconomy'),
      business: incrementFor('business'),
      first: incrementFor('first'),
    },
  };
}

/** Expects a form value that passed validation, so number fields are no longer null. */
export function toAirline(id: string, value: AirlineFormValue): Airline {
  return {
    id,
    name: value.name.trim(),
    code: value.code.trim().toUpperCase(),
    redeemFee: value.redeemFee as number,
    luggageRules: {
      _priceHandBaggage: value.luggage.handBaggagePrice as number,
      _maxHandBaggage: value.luggage.maxHandBaggage as number,
      _priceCheckedLuggage: value.luggage.checkedLuggagePrice as number,
      _priceExceededWeight: value.luggage.exceededWeightPrice as number,
    },
    flightClassPriceIncrements: FLIGHT_CLASSES.map((flightClass) => ({
      class: flightClass,
      increment: { value: value.classIncrements[flightClass] as number },
    })),
  };
}
