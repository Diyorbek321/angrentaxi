import { describe, expect, it } from 'vitest';
import {
  coversAllServices,
  normalizeServiceTypes,
  serviceTypesLabel,
  serviceTypesPayload,
  toggleServiceType,
} from './promo-service-types';

describe('promo service types', () => {
  it('null / empty / all five mean "Hammasi"', () => {
    expect(serviceTypesLabel(null)).toBe('Hammasi');
    expect(serviceTypesLabel(undefined)).toBe('Hammasi');
    expect(serviceTypesLabel([])).toBe('Hammasi');
    expect(serviceTypesLabel(['taxi', 'cargo', 'parcel', 'food', 'market'])).toBe('Hammasi');
    expect(coversAllServices(['food'])).toBe(false);
  });

  it('labels in canonical order, unknown values dropped', () => {
    expect(serviceTypesLabel(['market', 'food', 'bogus'])).toBe('Ovqat, Market');
    expect(normalizeServiceTypes(['market', 'market', 'taxi'])).toEqual(['taxi', 'market']);
  });

  it('toggle adds and removes', () => {
    expect(toggleServiceType(['food'], 'taxi')).toEqual(['taxi', 'food']);
    expect(toggleServiceType(['taxi', 'food'], 'taxi')).toEqual(['food']);
  });

  it('payload omits the field for "all"', () => {
    expect(serviceTypesPayload([])).toEqual({});
    expect(serviceTypesPayload(['taxi', 'cargo', 'parcel', 'food', 'market'])).toEqual({});
    expect(serviceTypesPayload(['market', 'food'])).toEqual({ serviceTypes: ['food', 'market'] });
  });
});
