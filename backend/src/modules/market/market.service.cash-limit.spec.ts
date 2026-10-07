import { BadRequestException } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketOrderDeliveryMode, MarketPaymentMethod } from '../../database/entities/market-order.entity';
import { ProductStatus } from '../../database/entities/product.entity';

/**
 * Naqd chegarasi (200 000 so'm) — `delivery/vendor-cash.ts`. Rad etilgan
 * buyurtma zaxiraga TEGMASLIGI kerak: tekshiruv mahsulot band qilinishidan
 * oldin turadi.
 */
describe('MarketService.createOrder — naqd chegarasi', () => {
  const product = { id: 'p1', storeId: 's1', name: 'Televizor', price: 250000, stock: 3, status: ProductStatus.ACTIVE };
  let productRepo: { find: jest.Mock; save: jest.Mock };
  let movementRepo: { create: jest.Mock; save: jest.Mock };
  let orderRepo: { create: jest.Mock; save: jest.Mock };
  let service: MarketService;

  beforeEach(() => {
    productRepo = { find: jest.fn().mockResolvedValue([{ ...product }]), save: jest.fn(async (p) => p) };
    movementRepo = { create: jest.fn((m) => m), save: jest.fn(async (m) => m) } as never;
    orderRepo = { create: jest.fn((o) => o), save: jest.fn(async (o) => ({ id: 'mo-1', ...o })) };
    service = new MarketService(
      { findOne: jest.fn().mockResolvedValue({ id: 's1', ownerUserId: 'owner-1' }) } as never,
      {} as never,
      productRepo as never,
      movementRepo as never,
      orderRepo as never,
      {} as never,
      { emitToUser: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        getDeliveryFee: jest.fn().mockResolvedValue(7000),
        getMaxCashVendorOrder: jest.fn().mockResolvedValue(200000),
      } as never,
    );
  });

  const order = (paymentMethod: MarketPaymentMethod, deliveryMode = MarketOrderDeliveryMode.PLATFORM) => ({
    storeId: 's1',
    items: [{ productId: 'p1', qty: 1 }],
    deliveryAddress: 'Angren',
    deliveryLat: 41,
    deliveryLng: 70,
    paymentMethod,
    deliveryMode,
  });

  it('platforma kuryeri bilan 257 000 naqd — rad, zaxira o\'zgarmaydi', async () => {
    await expect(
      service.createOrder('c1', null, order(MarketPaymentMethod.CASH) as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(productRepo.save).not.toHaveBeenCalled();
    expect(orderRepo.save).not.toHaveBeenCalled();
  });

  it('do\'konning o\'z kuryeri bilan chegara qo\'llanmaydi', async () => {
    await expect(
      service.createOrder('c1', null, order(MarketPaymentMethod.CASH, MarketOrderDeliveryMode.SELF) as never),
    ).resolves.toBeDefined();
  });
});
