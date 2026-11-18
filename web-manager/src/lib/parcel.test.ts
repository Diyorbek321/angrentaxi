import { describe, expect, it } from 'vitest';
import { parcelInfo } from './parcel';

describe('parcelInfo', () => {
  const details = { recipientPhone: '+998901112233', itemDescription: 'Kalitlar', size: 'medium', recipientName: 'Ona' };

  it('reads the parcel payload of a parcel order', () => {
    expect(parcelInfo({ serviceType: 'parcel', details })).toEqual(details);
  });

  it('is null for every other kind of ride, and for a malformed payload', () => {
    expect(parcelInfo({ serviceType: 'taxi', details })).toBeNull();
    expect(parcelInfo({ serviceType: 'parcel', details: null })).toBeNull();
    expect(parcelInfo({ serviceType: 'parcel', details: { size: 'small' } })).toBeNull();
  });

  it('falls back to "small" for an unknown size instead of rendering a raw key', () => {
    expect(parcelInfo({ serviceType: 'parcel', details: { ...details, size: 'huge' } })?.size).toBe('small');
  });
});
