import { FLIGHT_CLASSES, FlightClass } from '../../../shared/flight-classes';
import { Airplane, AirplaneInput, SeatConfig } from './airplane.model';

/** A class's seats. Number fields are null while the input is empty. */
export interface SeatClassFormValue {
  enabled: boolean;
  rows: number | null;
  columns: number | null;
}

/** The form's shape. Capacity isn't a field: it's always the seat total. */
export interface AirplaneFormValue {
  brand: string;
  model: string;
  seats: Record<FlightClass, SeatClassFormValue>;
}

export function toAirplaneFormValue(airplane: Airplane): AirplaneFormValue {
  const seatsConfig = airplane.seatsConfig ?? [];
  const seatsFor = (flightClass: FlightClass): SeatClassFormValue => {
    const config = seatsConfig.find((item) => item.class === flightClass);
    return config
      ? { enabled: true, rows: config.rowsQuantity, columns: config.columnsQuantity }
      : { enabled: false, rows: null, columns: null };
  };

  return {
    brand: airplane.brand,
    model: airplane.model,
    seats: {
      economy: seatsFor('economy'),
      premiumEconomy: seatsFor('premiumEconomy'),
      business: seatsFor('business'),
      first: seatsFor('first'),
    },
  };
}

/** Seats of the enabled classes, counting a blank quantity as 0. */
export function countSeats(seats: AirplaneFormValue['seats']): number {
  return FLIGHT_CLASSES.reduce((total, flightClass) => {
    const { enabled, rows, columns } = seats[flightClass];
    return enabled ? total + (rows ?? 0) * (columns ?? 0) : total;
  }, 0);
}

/** Expects a form value that passed validation, so enabled classes have both quantities. */
export function toAirplaneInput(id: string, value: AirplaneFormValue): AirplaneInput {
  const seatsConfig: SeatConfig[] = FLIGHT_CLASSES.filter(
    (flightClass) => value.seats[flightClass].enabled,
  ).map((flightClass) => ({
    class: flightClass,
    rowsQuantity: value.seats[flightClass].rows as number,
    columnsQuantity: value.seats[flightClass].columns as number,
  }));

  return {
    id,
    brand: value.brand.trim(),
    model: value.model.trim(),
    passengersCapacity: countSeats(value.seats),
    seatsConfig,
  };
}
