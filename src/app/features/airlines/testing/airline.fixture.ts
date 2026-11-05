import { Airline } from '../data/airline.model';

export function airlineFixture(overrides: Partial<Airline> = {}): Airline {
  return {
    id: '123e4567-e89b-42d3-a456-426614174000',
    name: 'Aerolineas Lagarza',
    code: 'LG',
    redeemFee: 12.5,
    luggageRules: {
      _priceHandBaggage: 100,
      _maxHandBaggage: 2,
      _priceCheckedLuggage: 110,
      _priceExceededWeight: 50,
    },
    flightClassPriceIncrements: [
      { class: 'economy', increment: { value: 0 } },
      { class: 'premiumEconomy', increment: { value: 10 } },
      { class: 'business', increment: { value: 20 } },
      { class: 'first', increment: { value: 30 } },
    ],
    ...overrides,
  };
}
