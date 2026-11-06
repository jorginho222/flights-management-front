import { FlightClass } from '../../../shared/flight-classes';

/** Seat columns are named a to z on each flight. */
export const MAX_SEAT_COLUMNS = 26;
export const MAX_SEAT_ROWS = 100;

export interface SeatConfig {
  class: FlightClass;
  rowsQuantity: number;
  columnsQuantity: number;
}

export interface Airplane {
  id: string;
  brand: string;
  /** Unique across airplanes. */
  model: string;
  /** The API requires it to equal the seats in `seatsConfig`. */
  passengersCapacity: number;
  /** At most one entry per class. A class the airplane lacks is left out. */
  seatsConfig: SeatConfig[];
  /** Set by the image upload endpoints, never by a save. Empty when there is no image. */
  imageUrl: string;
}

/** What `POST /airplanes` takes. Leaving out `imageUrl` keeps the stored image. */
export type AirplaneInput = Omit<Airplane, 'imageUrl'>;

/** Display name, such as "Boeing 737-800". */
export const airplaneName = (airplane: Pick<Airplane, 'brand' | 'model'>): string =>
  `${airplane.brand} ${airplane.model}`;
