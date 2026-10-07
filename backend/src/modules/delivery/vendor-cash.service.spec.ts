import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderStatus } from '../../database/entities/order.entity';
import { VendorCashService } from './vendor-cash.service';

/**
 * Kuryer → do'kon naqd to'lovi oqimi (`vendor-cash.ts`).
 */
describe('VendorCashService', () => {
  const ride = (over: Record<string, unknown> = {}) => ({
    id: 'ride-1',
    driverId: 'courier-1',
    status: OrderStatus.ARRIVED,
    details: { foodOrderId: 'fo-1', payVendor: 145000 },
    ...over,
  });
  const foodOrder = (over: Record<string, unknown> = {}) => ({
    id: 'fo-1',
    restaurantId: 'r1',
    paymentMethod: 'cash',
    vendorCashPaidAt: null,
    vendorCashConfirmedAt: null,
    vendorCashDisputedAt: null,
    ...over,
  });

  let orderRepo: { findOne: jest.Mock };
  let foodRepo: { findOne: jest.Mock; update: jest.Mock };
  let restaurantRepo: { findOne: jest.Mock };
  let gateway: { emitToUser: jest.Mock; emitToManagers: jest.Mock };
  let service: VendorCashService;

  beforeEach(() => {
    orderRepo = { findOne: jest.fn().mockResolvedValue(ride()) };
    foodRepo = { findOne: jest.fn().mockResolvedValue(foodOrder()), update: jest.fn() };
    restaurantRepo = { findOne: jest.fn().mockResolvedValue({ id: 'r1', ownerUserId: 'owner-1', name: 'Mix Burger' }) };
    gateway = { emitToUser: jest.fn(), emitToManagers: jest.fn() };
    service = new VendorCashService(
      orderRepo as never,
      foodRepo as never,
      { findOne: jest.fn(), update: jest.fn() } as never,
      restaurantRepo as never,
      { findOne: jest.fn() } as never,
      gateway as never,
    );
  });

  describe('kuryer "to\'ladim"', () => {
    it('belgilaydi va sotuvchiga xabar beradi', async () => {
      await service.markPaidByCourier('courier-1', 'ride-1');
      expect(foodRepo.update).toHaveBeenCalledWith('fo-1', { vendorCashPaidAt: expect.any(Date) });
      expect(gateway.emitToUser).toHaveBeenCalledWith('owner-1', 'vendor:cash_paid', expect.objectContaining({ vendorOrderId: 'fo-1', amount: 145000 }));
    });

    it('begona kuryer belgilay olmaydi', async () => {
      await expect(service.markPaidByCourier('courier-2', 'ride-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('karta buyurtmasida to\'lanadigan narsa yo\'q', async () => {
      orderRepo.findOne.mockResolvedValue(ride({ details: { foodOrderId: 'fo-1', payVendor: 0 } }));
      await expect(service.markPaidByCourier('courier-1', 'ride-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('safarni boshlash sharti', () => {
    it('naqd buyurtmada to\'lanmaguncha boshlab bo\'lmaydi', async () => {
      await expect(service.assertReadyForPickup(ride() as never)).rejects.toThrow(/do'konga/i);
    });

    it('to\'langan bo\'lsa — mumkin', async () => {
      foodRepo.findOne.mockResolvedValue(foodOrder({ vendorCashPaidAt: new Date() }));
      await expect(service.assertReadyForPickup(ride() as never)).resolves.toBeUndefined();
    });

    it('oddiy taksi yoki karta buyurtmasiga tegmaydi', async () => {
      await expect(service.assertReadyForPickup(ride({ details: null }) as never)).resolves.toBeUndefined();
      await expect(
        service.assertReadyForPickup(ride({ details: { foodOrderId: 'fo-1', payVendor: 0 } }) as never),
      ).resolves.toBeUndefined();
    });
  });

  describe('sotuvchi qarori', () => {
    beforeEach(() => foodRepo.findOne.mockResolvedValue(foodOrder({ vendorCashPaidAt: new Date() })));

    it('"oldim" — tasdiqlanadi', async () => {
      await service.vendorDecision('owner-1', 'food', 'fo-1', true);
      expect(foodRepo.update).toHaveBeenCalledWith('fo-1', { vendorCashConfirmedAt: expect.any(Date) });
      expect(gateway.emitToManagers).not.toHaveBeenCalled();
    });

    it('"olmadim" — nizo dispetcherga ketadi', async () => {
      await service.vendorDecision('owner-1', 'food', 'fo-1', false);
      expect(foodRepo.update).toHaveBeenCalledWith('fo-1', { vendorCashDisputedAt: expect.any(Date) });
      expect(gateway.emitToManagers).toHaveBeenCalledWith('delivery:cash_dispute', expect.objectContaining({ vendorOrderId: 'fo-1' }));
    });

    it('boshqa restoran egasi qaror qila olmaydi', async () => {
      await expect(service.vendorDecision('owner-2', 'food', 'fo-1', true)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('kuryer hali to\'lamagan bo\'lsa qaror yo\'q', async () => {
      foodRepo.findOne.mockResolvedValue(foodOrder());
      await expect(service.vendorDecision('owner-1', 'food', 'fo-1', true)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
