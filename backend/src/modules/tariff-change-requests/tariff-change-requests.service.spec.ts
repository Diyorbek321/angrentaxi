import { BadRequestException } from '@nestjs/common';
import { TariffChangeRequestsService } from './tariff-change-requests.service';
import { TariffChangeAction } from '../../database/entities/tariff-change-request.entity';

/**
 * A proposal's `proposedChanges` used to be stored unchecked and only
 * validated when the admin approved it. The manager panel sent an empty
 * "Max narx (ixtiyoriy)" as 0, so every proposal without a cap failed at
 * approval with "maxPrice must be >= minPrice" — found by the e2e suite.
 * A bad proposal must be refused when the manager submits it.
 */
describe('TariffChangeRequestsService.propose — validates the proposal up front', () => {
  const existing = { id: 't1', name: 'Standard', basePrice: 3000, pricePerKm: 1500, pricePerMin: 200, minPrice: 5000, maxPrice: null, isActive: true };

  function build() {
    const requestRepository = { save: jest.fn(async (row: unknown) => row) };
    const tariffRepository = { findOne: jest.fn().mockResolvedValue(existing) };
    const service = new TariffChangeRequestsService(requestRepository as never, tariffRepository as never, {} as never);
    return { service, requestRepository };
  }

  const create = (proposedChanges: Record<string, unknown>) => ({
    action: TariffChangeAction.CREATE,
    proposedChanges,
  });
  const valid = { name: 'Yangi', basePrice: 4000, pricePerKm: 1700, pricePerMin: 150, minPrice: 6000 };

  it('accepts a new tariff with no price cap', async () => {
    const { service, requestRepository } = build();
    await service.propose('m1', create({ ...valid, maxPrice: null }) as never);
    expect(requestRepository.save).toHaveBeenCalled();
  });

  it('refuses a cap below the minimum price — at proposal time, not at approval', async () => {
    const { service, requestRepository } = build();
    await expect(service.propose('m1', create({ ...valid, maxPrice: 0 }) as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(requestRepository.save).not.toHaveBeenCalled();
  });

  it('refuses a new tariff missing required prices', async () => {
    const { service } = build();
    await expect(service.propose('m1', create({ name: 'Yarim' }) as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses fields a tariff does not have', async () => {
    const { service } = build();
    await expect(
      service.propose('m1', create({ ...valid, commissionRate: 0 }) as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('checks an update against the current tariff (new minimum above the existing cap)', async () => {
    const { service } = build();
    const tariffRepository = { findOne: jest.fn().mockResolvedValue({ ...existing, maxPrice: 20000 }) };
    const capped = new TariffChangeRequestsService({ save: jest.fn() } as never, tariffRepository as never, {} as never);
    await expect(
      capped.propose('m1', { action: TariffChangeAction.UPDATE, tariffId: 't1', proposedChanges: { minPrice: 25000 } } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    // A partial update within bounds is fine.
    await service.propose('m1', { action: TariffChangeAction.UPDATE, tariffId: 't1', proposedChanges: { pricePerKm: 1600 } } as never);
  });
});
