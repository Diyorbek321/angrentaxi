import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SosAlert, SosAlertStatus } from '../../database/entities/sos-alert.entity';
import { OrdersService } from '../orders/orders.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ACTIVE_SOS_ALERTS_LIMIT, SafetyService } from './safety.service';

/**
 * listActive backs a dashboard poll and used to be an unbounded `find()`.
 * Active alerts only leave the list when a dispatcher resolves them, so an
 * unattended backlog grew the response without limit.
 */
describe('SafetyService.listActive — row cap', () => {
  let service: SafetyService;
  let find: jest.Mock;

  async function build(rowCount: number) {
    find = jest
      .fn()
      .mockResolvedValue(Array.from({ length: rowCount }, (_, i) => ({ id: `alert-${i}` })));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SafetyService,
        { provide: getRepositoryToken(SosAlert), useValue: { find } },
        { provide: OrdersService, useValue: {} },
        { provide: RealtimeGateway, useValue: { emitToManagers: jest.fn() } },
      ],
    }).compile();

    service = module.get<SafetyService>(SafetyService);
  }

  it('caps the query and keeps the newest-first active-only filter', async () => {
    await build(3);

    await service.listActive();

    expect(find).toHaveBeenCalledWith({
      where: { status: SosAlertStatus.ACTIVE },
      order: { createdAt: 'DESC' },
      take: ACTIVE_SOS_ALERTS_LIMIT,
    });
  });

  it('still returns a bare array, since web-manager and mobile both decode a list', async () => {
    await build(3);

    const result = await service.listActive();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('warns out-of-band when the cap is hit rather than changing the response shape', async () => {
    await build(ACTIVE_SOS_ALERTS_LIMIT);
    const warn = jest.spyOn(service['logger'], 'warn').mockImplementation();

    const result = await service.listActive();

    expect(Array.isArray(result)).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(String(ACTIVE_SOS_ALERTS_LIMIT)));

    warn.mockRestore();
  });
});
