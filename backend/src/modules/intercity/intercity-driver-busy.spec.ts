import { ConflictException } from '@nestjs/common';
import { DRIVER_ACTIVE_ORDER_STATUSES, OrderStatus } from '../../database/entities/order.entity';
import { OrderStatusTransitionService } from '../orders/order-status-transition.service';

/**
 * Shaharlararo haydovchining "bandligi" ALOHIDA qoidasiz, buyurtma holatidan
 * kelib chiqadi — bu test shu bog'liqlikni qulflaydi:
 *
 *  · band SCHEDULED (yig'ish boshlanmagan) — haydovchi BO'SH: jo'nashgacha
 *    shahar ichida ishlay oladi;
 *  · yig'ish boshlangach bandlar ACCEPTED → ARRIVED → IN_PROGRESS — haydovchi
 *    BAND: matching (`findBusyUserIds`) uni o'tkazib yuboradi, `acceptForDriver`
 *    shahar ichidagi taklifni rad etadi.
 *
 * Kimdir SCHEDULED ni faol holatlarga qo'shsa yoki ACCEPTED ni olib tashlasa,
 * shaharlararo haydovchi yo kunlab ishsiz qoladi, yo yo'lovchilar bilan
 * yo'lda turib taksi buyurtmasi oladi.
 */
describe('Shaharlararo haydovchi bandligi', () => {
  it("SCHEDULED band haydovchini band qilmaydi", () => {
    expect(DRIVER_ACTIVE_ORDER_STATUSES).not.toContain(OrderStatus.SCHEDULED);
  });

  it("yig'ish/yo'l holatlari haydovchini band qiladi", () => {
    expect(DRIVER_ACTIVE_ORDER_STATUSES).toEqual(
      expect.arrayContaining([OrderStatus.ACCEPTED, OrderStatus.ARRIVED, OrderStatus.IN_PROGRESS]),
    );
  });

  it("yig'ishdagi haydovchi shahar ichidagi buyurtmani qabul qila olmaydi (taksi xulqi o'zgarmagan)", async () => {
    const count = jest.fn(async () => 1); // yig'ishdagi shaharlararo band (ACCEPTED)
    const manager = { query: jest.fn(async () => []), count, createQueryBuilder: jest.fn() };
    const repository = { manager: { transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)) } };
    const service = new OrderStatusTransitionService(repository as never);

    await expect(service.acceptForDriver('city-order-1', 'driver-user-1')).rejects.toBeInstanceOf(ConflictException);
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
  });
});
