import { ConflictException, NotFoundException } from '@nestjs/common';
import { TariffsService } from './tariffs.service';
import { Tariff } from '../../database/entities/tariff.entity';

/**
 * The admin panel's "Tarifni o'chirish" button called DELETE /tariffs/:id,
 * which did not exist — every attempt failed with 404. Deleting is only safe
 * for a tariff nothing points at: orders keep tariff_id for their receipts,
 * and food/market dispatch takes "any active tariff of that service type", so
 * removing the last one silently stops deliveries.
 */
describe('TariffsService.remove', () => {
  const tariff = (overrides: Partial<Tariff> = {}) =>
    ({ id: 't1', name: 'E2E', serviceType: 'taxi', isActive: true, ...overrides }) as Tariff;

  function build(opts: { found?: Tariff | null; orders?: number; activeOfType?: number }) {
    const repo = {
      findOne: jest.fn().mockResolvedValue(opts.found === undefined ? tariff() : opts.found),
      query: jest.fn().mockResolvedValue([{ count: String(opts.orders ?? 0) }]),
      count: jest.fn().mockResolvedValue(opts.activeOfType ?? 2),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    return { service: new TariffsService(repo as never), repo };
  }

  it('deletes a tariff no order uses', async () => {
    const { service, repo } = build({});
    await service.remove('t1');
    expect(repo.delete).toHaveBeenCalledWith('t1');
  });

  it('refuses a tariff that orders reference, and says to deactivate it instead', async () => {
    const { service, repo } = build({ orders: 19 });
    const error = await service.remove('t1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toMatch(/19/);
    expect((error as Error).message).toMatch(/faolsizlantir/i);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('refuses the last active tariff of a service type (food/market dispatch needs one)', async () => {
    const { service, repo } = build({ found: tariff({ serviceType: 'food' }), activeOfType: 1 });
    await expect(service.remove('t1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('allows deleting an inactive tariff even if it is the only one of its type', async () => {
    const { service, repo } = build({ found: tariff({ isActive: false }), activeOfType: 0 });
    await service.remove('t1');
    expect(repo.delete).toHaveBeenCalledWith('t1');
  });

  it('404s for an unknown tariff', async () => {
    const { service } = build({ found: null });
    await expect(service.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
