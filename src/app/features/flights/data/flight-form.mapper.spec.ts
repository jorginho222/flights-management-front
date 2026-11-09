import { airlineFixture } from '../../airlines/testing/airline.fixture';
import { airplaneFixture } from '../../airplanes/testing/airplane.fixture';
import { ezeiza, flightFixture, heathrow } from '../testing/flight.fixture';
import {
  atTime,
  FlightDetailsValue,
  FlightScheduleValue,
  toCreateFlightInput,
  toDetailsValue,
  toHours24,
  toScheduleInput,
  toScheduleValue,
  toTimeOfDay,
  toUpdateFlightInput,
} from './flight-form.mapper';

describe('flight form mapper', () => {
  const details: FlightDetailsValue = {
    airline: airlineFixture(),
    airplane: airplaneFixture(),
    origin: ezeiza,
    destination: heathrow,
    basePrice: 850.5,
  };
  const schedule: FlightScheduleValue = {
    departureDate: new Date(2026, 11, 1),
    departureTime: { hour: 10, minute: 5, period: 'AM' },
    arrivalDate: new Date(2026, 11, 2),
    arrivalTime: { hour: 12, minute: 15, period: 'AM' },
  };
  const departure = new Date(2026, 11, 1, 10, 5).toISOString();
  const arrival = new Date(2026, 11, 2, 0, 15).toISOString();

  it.each([
    [12, 'AM', 0],
    [1, 'AM', 1],
    [11, 'AM', 11],
    [12, 'PM', 12],
    [1, 'PM', 13],
    [11, 'PM', 23],
  ] as const)('%i %s is hour %i of the day, and back', (hour, period, hours24) => {
    expect(toHours24({ hour, minute: 0, period })).toBe(hours24);
    expect(toTimeOfDay(new Date(2026, 0, 1, hours24, 30))).toEqual({ hour, minute: 30, period });
  });

  it('takes the day from the date and the time from the selects', () => {
    const result = atTime(new Date(2026, 11, 1, 23, 59, 59), { hour: 5, minute: 15, period: 'PM' });
    expect(result).toEqual(new Date(2026, 11, 1, 17, 15));
  });

  it('builds the POST /flights body with ISO date-times', () => {
    const id = '44444444-4444-4444-8444-444444444444';
    expect(toCreateFlightInput(id, details, schedule)).toEqual({
      id,
      ...details,
      departure,
      arrival,
    });
  });

  it('builds the PUT /flights/:id body with the loaded version', () => {
    expect(toUpdateFlightInput(details, 3)).toEqual({ ...details, version: 3 });
  });

  it('builds the PATCH /flights/schedule body', () => {
    expect(toScheduleInput('flight-id', schedule)).toEqual({ id: 'flight-id', departure, arrival });
  });

  it('fills the edit tabs from a flight, and maps back to the same values', () => {
    const flight = flightFixture({ departure, arrival });
    expect(toDetailsValue(flight)).toEqual({
      airline: flight.airline,
      airplane: flight.airplane,
      origin: flight.origin,
      destination: flight.destination,
      basePrice: flight.basePrice,
    });
    expect(toScheduleValue(flight)).toEqual(schedule);
    expect(toScheduleInput(flight.id, toScheduleValue(flight))).toEqual({
      id: flight.id,
      departure,
      arrival,
    });
  });

  it('keeps a minute that is not a 5-minute step', () => {
    const flight = flightFixture({ departure: new Date(2026, 11, 1, 22, 7).toISOString() });
    expect(toScheduleValue(flight).departureTime).toEqual({ hour: 10, minute: 7, period: 'PM' });
  });
});
