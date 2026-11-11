/**
 * Extra things a passenger can ask for on a ride.
 *
 * Each one is something only SOME drivers can provide, so it is a matching
 * filter, not a note: a passenger with a toddler must not be offered to a
 * driver who has no child seat, and "please bring a seat" in the free-text
 * note is exactly how that used to fail.
 *
 * No surcharge for now (business decision); adding one later means a new
 * receipt row, not a change here.
 */
export enum TripOption {
  CHILD_SEAT = 'child_seat',
  PET = 'pet',
  AIR_CONDITIONER = 'air_conditioner',
  BIG_LUGGAGE = 'big_luggage',
}

export const TRIP_OPTION_VALUES = Object.values(TripOption) as string[];

/** Drops unknowns and duplicates; keeps a stable order for storage. */
export function normalizeTripOptions(options: readonly string[] | null | undefined): TripOption[] {
  if (!options) return [];
  const wanted = new Set(options);
  return (Object.values(TripOption) as TripOption[]).filter((o) => wanted.has(o));
}

/** Can a driver offering `amenities` serve a ride that asked for `required`? */
export function driverProvidesTripOptions(
  amenities: readonly string[] | null | undefined,
  required: readonly string[] | null | undefined,
): boolean {
  if (!required || required.length === 0) return true;
  const has = new Set(amenities ?? []);
  return required.every((option) => has.has(option));
}
