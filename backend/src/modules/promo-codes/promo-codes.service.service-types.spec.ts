import { BadRequestException } from '@nestjs/common';
import { PromoCodesService } from './promo-codes.service';
import { PromoCode } from '../../database/entities/promo_code.entity';
import { ServiceType } from '../../database/entities/order.entity';

/**
 * Promokod xizmat turlari bo'yicha (docs/specs/food-market-ux-v5.md §2):
 * `serviceTypes = null` — hamma xizmat; ro'yxat bo'lsa faqat o'shalar.
 * Ovqat/market buyurtmasida ishlatish darhol band qilinadi va bekor
 * qilinganda bo'shatiladi.
 */
describe('PromoCodesService — service types and vendor orders', () => {
  const code = (overrides: Partial<PromoCode> = {}): PromoCode => ({
    id: 'promo-1',
    code: 'OVQAT20',
    discountPercent: 20,
    discountFixed: null,
    maxUses: null,
    usedCount: 0,
    minOrderAmount: 0,
    expiresAt: null,
    isActive: true,
    serviceTypes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  let promoRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let usageRepo: { findOne: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let qb: Record<string, jest.Mock>;
  let service: PromoCodesService;

  beforeEach(() => {
    qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    promoRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn(() => qb) };
    usageRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((u) => Promise.resolve({ id: 'usage-1', ...u })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    service = new PromoCodesService(promoRepo as never, usageRepo as never);
  });

  it('null serviceTypes → valid for any service', async () => {
    promoRepo.findOne.mockResolvedValue(code());
    const result = await service.validate('ovqat20', 'u1', 50000, { serviceType: ServiceType.MARKET });
    expect(result.discountAmount).toBe(10000);
  });

  it('a code limited to food is rejected for market with PROMO_NOT_APPLICABLE', async () => {
    promoRepo.findOne.mockResolvedValue(code({ serviceTypes: [ServiceType.FOOD] }));
    await expect(
      service.validate('OVQAT20', 'u1', 50000, { serviceType: ServiceType.MARKET }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'PROMO_NOT_APPLICABLE' }) });
  });

  it('describe() returns the spec shape and valid:false for a wrong service', async () => {
    promoRepo.findOne.mockResolvedValue(code({ serviceTypes: [ServiceType.FOOD] }));
    await expect(
      service.describe('OVQAT20', 'u1', { serviceType: ServiceType.FOOD, amount: 45000 }),
    ).resolves.toEqual(
      expect.objectContaining({
        valid: true,
        code: 'OVQAT20',
        discountType: 'percent',
        discountValue: 20,
        discountAmount: 9000,
        promoCodeId: 'promo-1',
        finalAmount: 36000,
      }),
    );
    await expect(
      service.describe('OVQAT20', 'u1', { serviceType: ServiceType.TAXI, amount: 45000 }),
    ).resolves.toEqual(
      expect.objectContaining({ valid: false, code: 'PROMO_NOT_APPLICABLE', message: expect.any(String) }),
    );
  });

  it('describe() without amount skips the minimum check and reports 0 discount', async () => {
    promoRepo.findOne.mockResolvedValue(code({ minOrderAmount: 100000, discountPercent: null, discountFixed: 5000 }));
    await expect(service.describe('OVQAT20', 'u1', {})).resolves.toEqual(
      expect.objectContaining({ valid: true, discountType: 'fixed', discountValue: 5000, discountAmount: 0 }),
    );
  });

  it('other failures still throw 400 (existing clients rely on it)', async () => {
    promoRepo.findOne.mockResolvedValue(null);
    await expect(service.describe('NOPE', 'u1', { amount: 1000 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('claimForVendorOrder records the usage against the food order', async () => {
    promoRepo.findOne.mockResolvedValue(code());
    await service.claimForVendorOrder('promo-1', 'u1', { kind: 'food', id: 'fo-1' });
    expect(qb.execute).toHaveBeenCalled();
    expect(usageRepo.save).toHaveBeenCalledWith({
      promoCodeId: 'promo-1',
      userId: 'u1',
      orderId: null,
      foodOrderId: 'fo-1',
      marketOrderId: null,
    });
  });

  it('releaseForVendorOrder deletes the usage and gives the use back', async () => {
    await service.releaseForVendorOrder('promo-1', 'u1', { kind: 'market', id: 'mo-1' });
    expect(usageRepo.delete).toHaveBeenCalledWith({ promoCodeId: 'promo-1', userId: 'u1', marketOrderId: 'mo-1' });
    expect(qb.set).toHaveBeenCalledWith({ usedCount: expect.any(Function) });
  });

  it('releaseForVendorOrder does not decrement when no usage row was removed', async () => {
    usageRepo.delete.mockResolvedValue({ affected: 0 });
    await service.releaseForVendorOrder('promo-1', 'u1', { kind: 'food', id: 'fo-1' });
    expect(qb.execute).not.toHaveBeenCalled();
  });
});
