import {
  INTERCITY_ZONE_REASONS,
  evaluatePublishZones,
  evaluateZoneInput,
  sideZoneFit,
  zoneContaining,
} from './intercity-zone-policy';

const rohat = {
  centerLat: 41.268028,
  centerLng: 69.366806,
  radiusKm: 1.5,
  extensionMaxKm: 30,
  extensionPricePerKm: 2000,
};
const yunusobod = { id: 'z-yun', name: 'Yunusobod', centerLat: 41.365, centerLng: 69.288, radiusKm: 4 };
const sergeli = { id: 'z-ser', name: 'Sergeli', centerLat: 41.227, centerLng: 69.219, radiusKm: 4 };

describe('zoneContaining', () => {
  it('manzil tuman doirasida', () => {
    expect(zoneContaining([sergeli, yunusobod], 41.36, 69.29)?.id).toBe('z-yun');
  });
  it("hech bir tumanda emas — null", () => {
    expect(zoneContaining([sergeli, yunusobod], 41.3, 69.5)).toBeNull();
  });
});

describe('sideZoneFit', () => {
  it("nuqta radiusi ichidagi manzil har doim mos (tumanlar tanlangan bo'lsa ham)", () => {
    expect(sideZoneFit(rohat, [yunusobod], { lat: 41.2685, lng: 69.367 })).toEqual({ ok: true, zoneNames: [] });
  });
  it("tuman tanlanmagan — butun davom hududi ochiq", () => {
    expect(sideZoneFit(rohat, [], { lat: 41.227, lng: 69.219 }).ok).toBe(true);
  });
  it("tanlangan tumanda — mos", () => {
    expect(sideZoneFit(rohat, [yunusobod, sergeli], { lat: 41.227, lng: 69.219 }).ok).toBe(true);
  });
  it("boshqa tumanda — mos emas, tanlangan tuman nomlari qaytadi", () => {
    expect(sideZoneFit(rohat, [yunusobod], { lat: 41.227, lng: 69.219 })).toEqual({
      ok: false,
      zoneNames: ['Yunusobod'],
    });
  });
});

describe('evaluatePublishZones', () => {
  const zones = [
    { ...yunusobod, pointId: 'p-rohat', isActive: true },
    { ...sergeli, pointId: 'p-rohat', isActive: false },
    { id: 'z-other', name: 'Olmaliq markaz', centerLat: 40.8, centerLng: 69.6, radiusKm: 3, pointId: 'p-olm', isActive: true },
  ];
  it("bo'sh ro'yxat — har doim mumkin", () => {
    expect(evaluatePublishZones([], 'p-rohat', true, zones)).toEqual({ ok: true, zoneIds: [] });
  });
  it('takrorlar olib tashlanadi', () => {
    expect(evaluatePublishZones(['z-yun', 'z-yun'], 'p-rohat', true, zones)).toEqual({ ok: true, zoneIds: ['z-yun'] });
  });
  it("boshqa nuqtaning, faol bo'lmagan yoki noma'lum tuman — rad", () => {
    const result = evaluatePublishZones(['z-other', 'z-ser', 'z-none'], 'p-rohat', true, zones);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.map((r) => r.code)).toEqual([INTERCITY_ZONE_REASONS.zoneNotAvailable]);
  });
  it("nuqtada davom o'chiq bo'lsa tuman tanlab bo'lmaydi", () => {
    const result = evaluatePublishZones(['z-yun'], 'p-rohat', false, zones);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons[0].code).toBe(INTERCITY_ZONE_REASONS.extensionDisabled);
  });
});

describe('evaluateZoneInput', () => {
  it("to'g'ri tuman", () => {
    expect(evaluateZoneInput({ name: 'Chilonzor', radiusKm: 4 })).toEqual([]);
  });
  it("bo'sh nom va radius chegaradan tashqarida", () => {
    expect(evaluateZoneInput({ name: '  ', radiusKm: 40 }).map((r) => r.code)).toEqual([
      INTERCITY_ZONE_REASONS.nameEmpty,
      INTERCITY_ZONE_REASONS.radiusOutOfRange,
    ]);
  });
});
