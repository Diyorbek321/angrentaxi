import { TripOption, driverProvidesTripOptions, normalizeTripOptions } from './trip-options';

describe('trip options', () => {
  it('normalizes: unknown values and duplicates are dropped, order is stable', () => {
    expect(normalizeTripOptions(['pet', 'rocket', 'child_seat', 'pet'])).toEqual([
      TripOption.CHILD_SEAT,
      TripOption.PET,
    ]);
    expect(normalizeTripOptions(null)).toEqual([]);
  });

  it('a ride with no options matches every driver', () => {
    expect(driverProvidesTripOptions([], [])).toBe(true);
    expect(driverProvidesTripOptions(null, undefined)).toBe(true);
  });

  it('every requested option must be provided', () => {
    expect(driverProvidesTripOptions(['child_seat', 'pet'], ['child_seat'])).toBe(true);
    expect(driverProvidesTripOptions(['child_seat'], ['child_seat', 'pet'])).toBe(false);
    expect(driverProvidesTripOptions(null, ['pet'])).toBe(false);
  });
});
