import { airlineFixture } from '../../airlines/testing/airline.fixture';
import { ezeiza, heathrow } from '../testing/flight.fixture';
import { defaultFilters, emptyFilters, toSearchCriteria } from './flight-search.mapper';

describe('flight search mapper', () => {
  it('sends nothing for empty filters', () => {
    expect(toSearchCriteria(emptyFilters())).toEqual({});
  });

  it('sends IATA codes, status and airline code', () => {
    expect(
      toSearchCriteria({
        ...emptyFilters(),
        origin: ezeiza,
        destination: heathrow,
        status: 'gateChanged',
        airlineCode: airlineFixture().code,
      }),
    ).toEqual({ origin: 'EZE', destination: 'LHR', status: 'gateChanged', airlineCode: 'LG' });
  });

  it.each([true, false])('sends isDelayed %s, and leaves it out when null', (isDelayed) => {
    expect(toSearchCriteria({ ...emptyFilters(), isDelayed })).toEqual({ isDelayed });
    expect(toSearchCriteria({ ...emptyFilters(), isDelayed: null })).toEqual({});
  });

  it('ignores text left in an airport control', () => {
    const typed = 'eze' as unknown as typeof ezeiza;
    expect(toSearchCriteria({ ...emptyFilters(), origin: typed })).toEqual({});
  });

  it('sends the whole local days of the range, as UTC', () => {
    const criteria = toSearchCriteria({
      ...emptyFilters(),
      departureFrom: new Date(2026, 11, 1, 15, 0),
      departureTo: new Date(2026, 11, 8),
    });
    expect(criteria.departureFrom).toBe(new Date(2026, 11, 1).toISOString());
    expect(criteria.departureTo).toBe(new Date(2026, 11, 8, 23, 59, 59, 999).toISOString());
  });

  it('defaults to flights departing from the start of today', () => {
    expect(defaultFilters(new Date(2026, 10, 7, 18, 45))).toEqual({
      ...emptyFilters(),
      departureFrom: new Date(2026, 10, 7),
    });
  });
});
