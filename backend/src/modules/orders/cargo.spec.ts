import { BadRequestException } from '@nestjs/common';
import { CARGO_MAX_LOADERS, CARGO_MAX_WEIGHT_KG, parseCargoDetails } from './cargo';

describe('parseCargoDetails', () => {
  it("faqat ma'lum maydonlar qoladi", () => {
    expect(
      parseCargoDetails({ vehicle: ' gazel ', weightKg: 300, loaders: 2, cargoNote: ' Mebel ', hacker: 'x' }),
    ).toEqual({ vehicle: 'gazel', weightKg: 300, loaders: 2, cargoNote: 'Mebel' });
  });

  it("bo'sh — null", () => {
    expect(parseCargoDetails(undefined)).toBeNull();
    expect(parseCargoDetails({})).toBeNull();
  });

  it.each([
    ['massiv', []],
    ["og'irlik 0", { weightKg: 0 }],
    ["og'irlik kasr", { weightKg: 2.5 }],
    ["og'irlik chegaradan oshdi", { weightKg: CARGO_MAX_WEIGHT_KG + 1 }],
    ['ortuvchi manfiy', { loaders: -1 }],
    ['ortuvchi ko\'p', { loaders: CARGO_MAX_LOADERS + 1 }],
    ['ortuvchi matn', { loaders: '2' }],
    ['uzun izoh', { cargoNote: 'x'.repeat(201) }],
    ['mashina son', { vehicle: 5 }],
  ])('rad: %s', (_label, raw) => {
    expect(() => parseCargoDetails(raw)).toThrow(BadRequestException);
  });
});
