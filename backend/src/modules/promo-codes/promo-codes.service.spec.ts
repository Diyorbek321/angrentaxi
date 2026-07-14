import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PromoCodesService } from './promo-codes.service';
import { PromoCode } from '../../database/entities/promo_code.entity';
import { PromoCodeUsage } from '../../database/entities/promo_code_usage.entity';

/**
 * Coverage for PromoCodesService.findActive, the data source for the new
 * GET /promo-codes/active endpoint (passenger-facing "browse active promos").
 *
 * The repository's createQueryBuilder is faked with an in-memory filter over
 * fixture rows that mirrors the real SQL semantics (isActive = true AND
 * (expiresAt IS NULL OR expiresAt > NOW()) AND (maxUses IS NULL OR usedCount
 * < maxUses)), ordered newest-first — exactly the logic the real query
 * expresses.
 */
describe('PromoCodesService - findActive', () => {
  let service: PromoCodesService;
  let promoCodes: PromoCode[];

  const NOW = new Date('2026-07-13T12:00:00.000Z');

  function makePromoCode(overrides: Partial<PromoCode>): PromoCode {
    return {
      id: 'promo-id',
      code: 'CODE',
      discountPercent: 10,
      discountFixed: null,
      maxUses: null,
      usedCount: 0,
      minOrderAmount: 0,
      expiresAt: null,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    } as PromoCode;
  }

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    promoCodes = [];

    interface FakeQueryBuilder {
      where: jest.Mock;
      andWhere: jest.Mock;
      orderBy: jest.Mock;
      getMany: jest.Mock;
    }

    const createQueryBuilder = jest.fn(() => {
      const state: { isActive?: boolean } = {};

      const builder: FakeQueryBuilder = {
        where: jest.fn((_cond: string, params: Record<string, unknown>) => {
          Object.assign(state, params);
          return builder;
        }),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => {
          const now = new Date();
          return promoCodes
            .filter((p) => p.isActive === state.isActive)
            .filter((p) => p.expiresAt === null || p.expiresAt > now)
            .filter((p) => p.maxUses === null || p.usedCount < p.maxUses)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }),
      };

      return builder;
    });

    const promoCodeRepository = { createQueryBuilder };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromoCodesService,
        { provide: getRepositoryToken(PromoCode), useValue: promoCodeRepository },
        { provide: getRepositoryToken(PromoCodeUsage), useValue: {} },
      ],
    }).compile();

    service = module.get<PromoCodesService>(PromoCodesService);
  });

  it('includes an active, non-expired, under-limit code', async () => {
    const active = makePromoCode({
      id: 'promo-active',
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      maxUses: 100,
      usedCount: 5,
    });
    promoCodes.push(active);

    const result = await service.findActive();

    expect(result).toEqual([active]);
  });

  it('excludes an inactive code', async () => {
    const inactive = makePromoCode({ id: 'promo-inactive', isActive: false });
    promoCodes.push(inactive);

    const result = await service.findActive();

    expect(result).toEqual([]);
  });

  it('excludes an expired code', async () => {
    const expired = makePromoCode({
      id: 'promo-expired',
      expiresAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    promoCodes.push(expired);

    const result = await service.findActive();

    expect(result).toEqual([]);
  });

  it('excludes a code that has reached its maxUses', async () => {
    const exhausted = makePromoCode({
      id: 'promo-exhausted',
      maxUses: 10,
      usedCount: 10,
    });
    promoCodes.push(exhausted);

    const result = await service.findActive();

    expect(result).toEqual([]);
  });

  it('includes a code with no expiry and no usage limit', async () => {
    const unlimited = makePromoCode({
      id: 'promo-unlimited',
      expiresAt: null,
      maxUses: null,
      usedCount: 500,
    });
    promoCodes.push(unlimited);

    const result = await service.findActive();

    expect(result).toEqual([unlimited]);
  });

  it('returns results ordered newest-first', async () => {
    const older = makePromoCode({
      id: 'promo-older',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    const newer = makePromoCode({
      id: 'promo-newer',
      createdAt: new Date('2026-07-10T00:00:00.000Z'),
    });
    promoCodes.push(older, newer);

    const result = await service.findActive();

    expect(result.map((p) => p.id)).toEqual(['promo-newer', 'promo-older']);
  });
});
