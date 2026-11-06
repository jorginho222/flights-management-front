/** The API's seat classes, in the order the UI lists them. */
export const FLIGHT_CLASSES = ['economy', 'premiumEconomy', 'business', 'first'] as const;

export type FlightClass = (typeof FLIGHT_CLASSES)[number];
