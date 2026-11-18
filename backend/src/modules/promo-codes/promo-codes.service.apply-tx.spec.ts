import { EntityManager, Repository } from 'typeorm';
import { PromoCode } from '../../database/entities/promo_code.entity';
import { PromoCodeUsage } from '../../database/entities/promo_code_usage.entity';
import { PromoCodesService } from './promo-codes.service';

/**
 * Safar yakunida promokod tranzaksiya ICHIDA band qilinadi: `manager`
 * berilsa, hisoblagich va foydalanish yozuvi aynan shu manager orqali.
 */
describe('PromoCodesService.apply — tranzaksiya manageri', () => {
  const qb = () => {
    const builder: Record<string, jest.Mock> = {
      update: jest.fn(() => builder),
      set: jest.fn(() => builder),
      where: jest.fn(() => builder),
      andWhere: jest.fn(() => builder),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    return builder;
  };

  function repos() {
    const promoRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'p1' }),
      createQueryBuilder: jest.fn(qb),
    };
    const usageRepo = { save: jest.fn(async (row: unknown) => row) };
    return { promoRepo, usageRepo };
  }

  it('manager berilsa — global repozitoriylarga TEGMAYDI', async () => {
    const global = repos();
    const tx = repos();
    const manager = {
      getRepository: jest.fn((entity: unknown) => (entity === PromoCode ? tx.promoRepo : tx.usageRepo)),
    } as unknown as EntityManager;
    const service = new PromoCodesService(
      global.promoRepo as unknown as Repository<PromoCode>,
      global.usageRepo as unknown as Repository<PromoCodeUsage>,
    );

    await service.apply('p1', 'u1', 'o1', manager);

    expect(tx.promoRepo.createQueryBuilder).toHaveBeenCalled();
    expect(tx.usageRepo.save).toHaveBeenCalledWith({ promoCodeId: 'p1', userId: 'u1', orderId: 'o1' });
    expect(global.promoRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(global.usageRepo.save).not.toHaveBeenCalled();
  });

  it('manager berilmasa — avvalgidek global repozitoriylar', async () => {
    const global = repos();
    const service = new PromoCodesService(
      global.promoRepo as unknown as Repository<PromoCode>,
      global.usageRepo as unknown as Repository<PromoCodeUsage>,
    );
    await service.apply('p1', 'u1', 'o1');
    expect(global.usageRepo.save).toHaveBeenCalledTimes(1);
  });
});
