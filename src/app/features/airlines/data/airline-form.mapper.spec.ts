import { airlineFixture } from '../testing/airline.fixture';
import { AirlineFormValue, toAirline, toAirlineFormValue } from './airline-form.mapper';

describe('airline form mapper', () => {
  it('maps the API shape, including underscore keys, to the form', () => {
    expect(toAirlineFormValue(airlineFixture())).toEqual({
      name: 'Aerolineas Lagarza',
      code: 'LG',
      redeemFee: 12.5,
      luggage: {
        handBaggagePrice: 100,
        maxHandBaggage: 2,
        checkedLuggagePrice: 110,
        exceededWeightPrice: 50,
      },
      classIncrements: { economy: 0, premiumEconomy: 10, business: 20, first: 30 },
    });
  });

  it('leaves a missing class blank, and keeps a real 0', () => {
    const airline = airlineFixture({
      flightClassPriceIncrements: [{ class: 'economy', increment: { value: 0 } }],
    });
    expect(toAirlineFormValue(airline).classIncrements).toEqual({
      economy: 0,
      premiumEconomy: null,
      business: null,
      first: null,
    });
  });

  it('round-trips back to the API shape', () => {
    const airline = airlineFixture();
    expect(toAirline(airline.id, toAirlineFormValue(airline))).toEqual(airline);
  });

  it('trims the name and normalizes the code', () => {
    const value: AirlineFormValue = {
      ...toAirlineFormValue(airlineFixture()),
      name: '  Sky Air ',
      code: ' ab',
    };
    const airline = toAirline('id', value);
    expect(airline.name).toBe('Sky Air');
    expect(airline.code).toBe('AB');
  });
});
