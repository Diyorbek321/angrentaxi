import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LostItemsService } from './lost-items.service';
import { LostItemStatus } from '../../database/entities/lost-item-report.entity';
import { OrderStatus } from '../../database/entities/order.entity';
import { UserRole } from '../../database/entities/user.entity';

const NOW = new Date('2026-09-27T10:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function build(order: Record<string, unknown> | null, existing: Record<string, unknown> | null = null) {
  const reportRepository = {
    findOne: jest.fn(async () => existing),
    save: jest.fn(async (r: Record<string, unknown>) => ({ id: 'rep-1', ...r })),
    update: jest.fn(async () => ({ affected: 1 })),
    find: jest.fn(),
  };
  const orderRepository = { findOne: jest.fn(async () => order) };
  const usersService = {
    findById: jest.fn(async (id: string) => ({ id, fcmToken: null })),
    findByIds: jest.fn(),
  };
  const realtimeGateway = { emitToUser: jest.fn(), emitToManagers: jest.fn() };
  const notificationsService = {
    notifyLostItemReported: jest.fn(),
    notifyLostItemAnswered: jest.fn(),
  };
  const service = new LostItemsService(
    reportRepository as never,
    orderRepository as never,
    usersService as never,
    realtimeGateway as never,
    notificationsService as never,
  );
  return { service, reportRepository, realtimeGateway, notificationsService };
}

const completed = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-1',
  passengerId: 'pass-1',
  driverId: 'drv-user-1',
  status: OrderStatus.COMPLETED,
  completedAt: new Date(NOW.getTime() - DAY),
  ...overrides,
});

describe('LostItemsService.report', () => {
  const dto = { orderId: 'order-1', description: 'Qora hamyon' };

  it('records the report and tells the driver — without the passenger phone', async () => {
    const { service, reportRepository, realtimeGateway, notificationsService } = build(completed());

    await service.report('pass-1', dto, NOW);

    expect(reportRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ driverUserId: 'drv-user-1', status: LostItemStatus.OPEN }),
    );
    const payload = realtimeGateway.emitToUser.mock.calls[0][2];
    expect(realtimeGateway.emitToUser.mock.calls[0][0]).toBe('drv-user-1');
    expect(payload).toEqual({ id: 'rep-1', orderId: 'order-1', description: 'Qora hamyon' });
    expect(notificationsService.notifyLostItemReported).toHaveBeenCalled();
  });

  it("hides another passenger's order behind a 404", async () => {
    const { service } = build(completed({ passengerId: 'someone-else' }));
    await expect(service.report('pass-1', dto, NOW)).rejects.toThrow(NotFoundException);
  });

  it('only for completed rides, within the window', async () => {
    await expect(
      build(completed({ status: OrderStatus.IN_PROGRESS })).service.report('pass-1', dto, NOW),
    ).rejects.toThrow(BadRequestException);
    await expect(
      build(completed({ completedAt: new Date(NOW.getTime() - 8 * DAY) })).service.report('pass-1', dto, NOW),
    ).rejects.toThrow(BadRequestException);
  });

  it('one open report per ride', async () => {
    const { service, reportRepository } = build(completed(), { id: 'old', status: LostItemStatus.OPEN });
    await expect(service.report('pass-1', dto, NOW)).rejects.toThrow(ConflictException);
    expect(reportRepository.save).not.toHaveBeenCalled();
  });
});

describe('LostItemsService.driverRespond', () => {
  const report = { id: 'rep-1', driverUserId: 'drv-user-1', passengerId: 'pass-1', status: LostItemStatus.OPEN };

  it('the driver of that ride answers once; the passenger is told', async () => {
    const { service, reportRepository, notificationsService } = build(null, report);

    const updated = await service.driverRespond('drv-user-1', 'rep-1', { found: true, note: 'Orqa o‘rindiqda' });

    expect(updated.status).toBe(LostItemStatus.FOUND);
    expect(reportRepository.update).toHaveBeenCalledWith(
      { id: 'rep-1', status: LostItemStatus.OPEN },
      { status: LostItemStatus.FOUND, driverNote: 'Orqa o‘rindiqda' },
    );
    expect(notificationsService.notifyLostItemAnswered).toHaveBeenCalledWith(expect.anything(), true);
  });

  it('another driver cannot answer', async () => {
    const { service } = build(null, report);
    await expect(service.driverRespond('drv-user-2', 'rep-1', { found: false })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('a second answer is refused', async () => {
    const { service, reportRepository } = build(null, report);
    reportRepository.update.mockResolvedValueOnce({ affected: 0 });
    await expect(service.driverRespond('drv-user-1', 'rep-1', { found: false })).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('LostItemsService.listMine', () => {
  it('a driver sees reports about their rides, a passenger their own', async () => {
    const { service, reportRepository } = build(null);
    reportRepository.find.mockResolvedValue([]);

    await service.listMine({ id: 'u1', role: UserRole.DRIVER } as never);
    await service.listMine({ id: 'u2', role: UserRole.PASSENGER } as never);

    expect(reportRepository.find.mock.calls[0][0].where).toEqual({ driverUserId: 'u1' });
    expect(reportRepository.find.mock.calls[1][0].where).toEqual({ passengerId: 'u2' });
  });
});
