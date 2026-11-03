import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  PARCEL_PIN_MAX_ATTEMPTS,
  ParcelSize,
  assertPinGiven,
  checkDeliveryPin,
  deliveryPinLocked,
  generateDeliveryPin,
  parseParcelDetails,
} from './parcel';

describe('parseParcelDetails', () => {
  const valid = {
    recipientPhone: '+998901112233',
    itemDescription: 'Kalitlar',
    size: ParcelSize.SMALL,
    declaredValue: 50_000,
    prohibitedItemsAccepted: true as const,
  };
  const MAX = 1_000_000;

  it('accepts a complete parcel and keeps only known fields', () => {
    expect(parseParcelDetails({ ...valid, recipientName: '  Ona  ', hacker: 'x' }, MAX)).toEqual({
      ...valid,
      recipientName: 'Ona',
    });
  });

  it.each([
    ['no details at all', undefined],
    ['missing recipient phone', { itemDescription: 'Hujjat', size: 'small' }],
    ['a non-Uzbek phone', { ...valid, recipientPhone: '12345' }],
    ['an empty description', { ...valid, itemDescription: ' ' }],
    ['an over-long description', { ...valid, itemDescription: 'x'.repeat(201) }],
    ['an unknown size', { ...valid, size: 'huge' }],
    ["qiymat yo'q", { ...valid, declaredValue: undefined }],
    ['qiymat 0', { ...valid, declaredValue: 0 }],
    ['qiymat kasr', { ...valid, declaredValue: 10.5 }],
    ['qiymat matn', { ...valid, declaredValue: '50000' }],
    ['qiymat chegaradan oshdi', { ...valid, declaredValue: MAX + 1 }],
    ["taqiqlangan narsalar tasdiqlanmagan", { ...valid, prohibitedItemsAccepted: undefined }],
    ["tasdiq true emas", { ...valid, prohibitedItemsAccepted: 'yes' }],
  ])('refuses %s', (_label, details) => {
    expect(() => parseParcelDetails(details, MAX)).toThrow(BadRequestException);
  });

  it('chegaraning o\'zi — qabul', () => {
    expect(parseParcelDetails({ ...valid, declaredValue: MAX }, MAX).declaredValue).toBe(MAX);
  });
});

describe('generateDeliveryPin', () => {
  it('is always four digits, leading zeros included', () => {
    for (let i = 0; i < 500; i++) expect(generateDeliveryPin()).toMatch(/^\d{4}$/);
  });
});

describe('delivery PIN checks', () => {
  it('passes the right PIN', () => {
    expect(() => checkDeliveryPin({ pin: '0427', attemptsUsed: 1 }, '0427')).not.toThrow();
  });

  it('asks for the PIN when none is given (without spending an attempt)', () => {
    expect(() => assertPinGiven(undefined)).toThrow(BadRequestException);
    expect(() => assertPinGiven('')).toThrow(BadRequestException);
  });

  it('refuses a wrong PIN and says how many tries are left', () => {
    expect(() => checkDeliveryPin({ pin: '0427', attemptsUsed: 2 }, '1111')).toThrow(
      new RegExp(`Qolgan urinishlar: ${PARCEL_PIN_MAX_ATTEMPTS - 2}`),
    );
  });

  it('the lock is a 403 that sends the driver to a dispatcher', () => {
    const error = deliveryPinLocked();
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.message).toMatch(/dispetcher/i);
  });
});
