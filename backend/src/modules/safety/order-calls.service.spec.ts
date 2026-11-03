import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderStatus } from '../../database/entities/order.entity';
import { OrderCallLog } from '../../database/entities/order-call-log.entity';
import { UserRole } from '../../database/entities/user.entity';
import { OrderCallsService } from './order-calls.service';

describe('OrderCallsService (INCIDENT-POLICY §4)', () => {
  const baseOrder = {
    id: 'o1',
    passengerId: 'p1',
    driverId: 'd1',
    status: OrderStatus.ACCEPTED,
    details: null as Record<string, unknown> | null,
    passenger: { phone: '+998900000001' },
    driver: { phone: '+998900000002' },
  };

  function build(order: Record<string, unknown> = baseOrder) {
    const tx = {
      create: jest.fn((_e: unknown, data: object) => data),
      save: jest.fn(async (_e: unknown, data: object) => ({ id: 'call-1', ...data })),
    };
    const orders = { findOne: jest.fn(async () => order) };
    const callLogs = { manager: { transaction: jest.fn(async (work: (m: unknown) => Promise<unknown>) => work(tx)) } };
    const audit = { record: jest.fn(async () => ({ id: 'a1' })) };
    return { service: new OrderCallsService(orders as never, callLogs as never, audit as never), tx, audit };
  }

  it("yo'lovchi haydovchi raqamini oladi; jurnal + audit bitta tranzaksiyada", async () => {
    const { service, tx, audit } = build();
    await expect(service.requestCall('o1', { id: 'p1', role: UserRole.PASSENGER })).resolves.toEqual({
      phone: '+998900000002',
      calleeRole: 'driver',
    });
    expect(tx.save).toHaveBeenCalledWith(
      OrderCallLog,
      expect.objectContaining({ orderId: 'o1', callerUserId: 'p1', callerRole: 'passenger', calleeUserId: 'd1' }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'order.call_request', targetId: 'o1', metadata: expect.objectContaining({ callLogId: 'call-1' }) }),
      tx,
    );
  });

  it("kuryer yetkazishda mijozning aloqa raqamini oladi", async () => {
    const { service } = build({ ...baseOrder, status: OrderStatus.IN_PROGRESS, details: { customerPhone: '+998900000005' } });
    await expect(service.requestCall('o1', { id: 'd1', role: UserRole.DRIVER })).resolves.toEqual({
      phone: '+998900000005',
      calleeRole: 'passenger',
    });
  });

  it('faol bo\'lmagan buyurtma, begona va haydovchi roli bo\'lmagan "haydovchi" — rad, jurnal yo\'q', async () => {
    const done = build({ ...baseOrder, status: OrderStatus.COMPLETED });
    await expect(done.service.requestCall('o1', { id: 'p1', role: UserRole.PASSENGER })).rejects.toThrow(BadRequestException);
    expect(done.tx.save).not.toHaveBeenCalled();
    await expect(build().service.requestCall('o1', { id: 'x', role: UserRole.PASSENGER })).rejects.toThrow(ForbiddenException);
    await expect(build().service.requestCall('o1', { id: 'd1', role: UserRole.PASSENGER })).rejects.toThrow(ForbiddenException);
  });

  it("raqam yo'q — 400", async () => {
    const { service } = build({ ...baseOrder, driver: { phone: null } });
    await expect(service.requestCall('o1', { id: 'p1', role: UserRole.PASSENGER })).rejects.toThrow(/raqami mavjud emas/);
  });
});
