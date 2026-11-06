import { airplaneFixture, airplaneInputFixture } from '../testing/airplane.fixture';
import {
  AirplaneFormValue,
  countSeats,
  toAirplaneFormValue,
  toAirplaneInput,
} from './airplane-form.mapper';

describe('airplane form mapper', () => {
  it('maps the API shape to the form, with missing classes disabled', () => {
    expect(toAirplaneFormValue(airplaneFixture())).toEqual({
      brand: 'Boeing',
      model: '737-800',
      seats: {
        economy: { enabled: true, rows: 25, columns: 6 },
        premiumEconomy: { enabled: false, rows: null, columns: null },
        business: { enabled: true, rows: 4, columns: 4 },
        first: { enabled: false, rows: null, columns: null },
      },
    });
  });

  it('round-trips back to the API shape, without the image', () => {
    const airplane = airplaneFixture({ imageUrl: 'https://img/1.png' });
    expect(toAirplaneInput(airplane.id, toAirplaneFormValue(airplane))).toEqual(
      airplaneInputFixture(),
    );
  });

  it('sends only enabled classes, in cabin order, and computes the capacity', () => {
    const value: AirplaneFormValue = {
      brand: '  Airbus ',
      model: ' A320 ',
      seats: {
        economy: { enabled: false, rows: 30, columns: 6 },
        premiumEconomy: { enabled: false, rows: null, columns: null },
        business: { enabled: true, rows: 5, columns: 4 },
        first: { enabled: true, rows: 2, columns: 2 },
      },
    };
    expect(toAirplaneInput('id', value)).toEqual({
      id: 'id',
      brand: 'Airbus',
      model: 'A320',
      passengersCapacity: 24,
      seatsConfig: [
        { class: 'business', rowsQuantity: 5, columnsQuantity: 4 },
        { class: 'first', rowsQuantity: 2, columnsQuantity: 2 },
      ],
    });
  });

  it('counts blank quantities as no seats', () => {
    const { seats } = toAirplaneFormValue(airplaneFixture());
    expect(countSeats({ ...seats, economy: { enabled: true, rows: null, columns: 6 } })).toBe(16);
  });
});
