import { airlineFixture } from '../../airlines/testing/airline.fixture';
import { airplaneFixture } from '../../airplanes/testing/airplane.fixture';
import { ezeiza, heathrow } from '../testing/flight.fixture';
import { atTime, toCreateFlightInput, toHours24 } from './flight-form.mapper';

describe('flight form mapper', () => {
  it.each([
    [12, 'AM', 0],
    [1, 'AM', 1],
    [11, 'AM', 11],
    [12, 'PM', 12],
    [1, 'PM', 13],
    [11, 'PM', 23],
  ] as const)('%i %s is hour %i of the day', (hour, period, expected) => {
    expect(toHours24({ hour, minute: 0, period })).toBe(expected);
  });

  it('takes the day from the date and the time from the selects', () => {
    const result = atTime(new Date(2026, 11, 1, 23, 59, 59), { hour: 5, minute: 15, period: 'PM' });
    expect(result).toEqual(new Date(2026, 11, 1, 17, 15));
  });

  it('builds the POST /flights body with ISO date-times', () => {
    const airline = airlineFixture();
    const airplane = airplaneFixture();
    const input = toCreateFlightInput('44444444-4444-4444-8444-444444444444', {
      airline,
      airplane,
      origin: ezeiza,
      destination: heathrow,
      departureDate: new Date(2026, 11, 1),
      departureTime: { hour: 10, minute: 5, period: 'AM' },
      arrivalDate: new Date(2026, 11, 2),
      arrivalTime: { hour: 12, minute: 15, period: 'AM' },
      basePrice: 850.5,
    });

    expect(input).toEqual({
      id: '44444444-4444-4444-8444-444444444444',
      airline,
      airplane,
      origin: ezeiza,
      destination: heathrow,
      departure: new Date(2026, 11, 1, 10, 5).toISOString(),
      arrival: new Date(2026, 11, 2, 0, 15).toISOString(),
      basePrice: 850.5,
    });
  });
});
