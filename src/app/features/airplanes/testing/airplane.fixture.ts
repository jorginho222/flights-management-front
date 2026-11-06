import { Airplane, AirplaneInput } from '../data/airplane.model';

export function airplaneFixture(overrides: Partial<Airplane> = {}): Airplane {
  return {
    id: '1edf4131-fe1a-4f97-8a45-aa78d1531667',
    brand: 'Boeing',
    model: '737-800',
    passengersCapacity: 166,
    seatsConfig: [
      { class: 'economy', rowsQuantity: 25, columnsQuantity: 6 },
      { class: 'business', rowsQuantity: 4, columnsQuantity: 4 },
    ],
    imageUrl: '',
    ...overrides,
  };
}

/** The airplane as `POST /airplanes` takes it, without the image. */
export function airplaneInputFixture(overrides: Partial<Airplane> = {}): AirplaneInput {
  const input: Partial<Airplane> = airplaneFixture(overrides);
  delete input.imageUrl;
  return input as AirplaneInput;
}
