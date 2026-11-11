import {
  INTERCITY_POINT_REASONS,
  assertIntercityPointExtension,
  validateIntercityPointExtension,
} from './intercity-point-policy';

const codes = (reasons: { code: string }[]) => reasons.map((r) => r.code);

const ROHAT = {
  radiusKm: 1.5,
  extensionMaxKm: 30,
  extensionPricePerKm: 2000,
  extensionComfortPricePerKm: 2500 as number | null,
};

describe('validateIntercityPointExtension', () => {
  it('egasi bergan Rohat qiymatlari to\'g\'ri', () => {
    expect(validateIntercityPointExtension(ROHAT)).toEqual([]);
  });

  it('davom o\'chiq (hammasi 0/null) — to\'g\'ri', () => {
    expect(
      validateIntercityPointExtension({
        radiusKm: 1.5,
        extensionMaxKm: 0,
        extensionPricePerKm: 0,
        extensionComfortPricePerKm: null,
      }),
    ).toEqual([]);
  });

  it('max km 60 dan oshmaydi', () => {
    expect(codes(validateIntercityPointExtension({ ...ROHAT, extensionMaxKm: 61 }))).toContain(
      INTERCITY_POINT_REASONS.maxKmOutOfRange,
    );
  });

  it('davom yoqilgan bo\'lsa max km radiusdan katta', () => {
    expect(codes(validateIntercityPointExtension({ ...ROHAT, extensionMaxKm: 1 }))).toContain(
      INTERCITY_POINT_REASONS.maxKmNotBeyondRadius,
    );
  });

  it('davom yoqilgan bo\'lsa km narxi 0 dan katta (tekin davom — xato)', () => {
    expect(codes(validateIntercityPointExtension({ ...ROHAT, extensionPricePerKm: 0 }))).toContain(
      INTERCITY_POINT_REASONS.pricePerKmRequired,
    );
  });

  it('Comfort km narxi Startdan arzon bo\'lmaydi', () => {
    expect(
      codes(validateIntercityPointExtension({ ...ROHAT, extensionComfortPricePerKm: 1500 })),
    ).toContain(INTERCITY_POINT_REASONS.comfortBelowStart);
  });

  it('manfiy va kasr narxlar rad etiladi', () => {
    expect(codes(validateIntercityPointExtension({ ...ROHAT, extensionPricePerKm: -1 }))).toContain(
      INTERCITY_POINT_REASONS.pricePerKmInvalid,
    );
    expect(codes(validateIntercityPointExtension({ ...ROHAT, extensionPricePerKm: 1999.5 }))).toContain(
      INTERCITY_POINT_REASONS.pricePerKmInvalid,
    );
  });

  it('bir nechta xato birdaniga qaytadi', () => {
    expect(
      validateIntercityPointExtension({ ...ROHAT, extensionMaxKm: 61, extensionComfortPricePerKm: 100 }).length,
    ).toBeGreaterThanOrEqual(2);
  });
});

describe('assertIntercityPointExtension', () => {
  it('xato bo\'lsa INTERCITY_POINT_INVALID + reasons', () => {
    expect.assertions(2);
    try {
      assertIntercityPointExtension({ ...ROHAT, extensionMaxKm: 61 });
    } catch (error) {
      const body = (error as { getResponse(): Record<string, unknown> }).getResponse();
      expect(body.code).toBe('INTERCITY_POINT_INVALID');
      expect(Array.isArray(body.reasons)).toBe(true);
    }
  });
});
