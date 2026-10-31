import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FiscalReceiptsService, RideReceiptInput } from './fiscal-receipts.service';
import { FiscalProvider, NoopFiscalProvider, NOOP_SKIP_REASON } from './fiscal-provider';
import {
  FiscalPrincipalType,
  FiscalReceipt,
  FiscalReceiptStatus,
} from '../../database/entities/fiscal-receipt.entity';
import { PaymentMethod, ServiceType } from '../../database/entities/order.entity';

/**
 * Fiskal chek yozuvi — ASOSIY QOIDA: hech qanday xato chaqiruvchiga
 * (buyurtma yakunlash oqimiga) chiqmaydi.
 */
describe('FiscalReceiptsService', () => {
  let rows: FiscalReceipt[];
  let repo: Record<string, jest.Mock>;
  let foodOrders: { findOne: jest.Mock };
  let marketOrders: { findOne: jest.Mock };
  let restaurants: { findOne: jest.Mock };
  let stores: { findOne: jest.Mock };

  const ride: RideReceiptInput = {
    orderId: 'order-1',
    serviceType: ServiceType.TAXI,
    paymentMethod: PaymentMethod.CASH,
    total: 20000,
    commissionAmount: 2000,
    principalUserId: 'driver-user-1',
    principalPinfl: '12345678901234',
    principalTin: null,
  };

  function build(
    provider: FiscalProvider = new NoopFiscalProvider(),
    settings?: { getPlatformTin: jest.Mock },
  ) {
    rows = [];
    let seq = 0;
    repo = {
      findOne: jest.fn(async ({ where }: { where: Partial<FiscalReceipt> }) =>
        rows.find((r) =>
          where.id
            ? r.id === where.id
            : r.orderId === where.orderId &&
              (where.receiptType === undefined || (r.receiptType ?? 'sale') === where.receiptType),
        ) ?? null,
      ),
      create: jest.fn((value: Partial<FiscalReceipt>) => value),
      save: jest.fn(async (value: FiscalReceipt) => {
        const withId = { ...value, id: value.id ?? `r${++seq}` } as FiscalReceipt;
        rows = [...rows.filter((r) => r.id !== withId.id), withId];
        return withId;
      }),
      find: jest.fn(async () => rows.filter((r) => ['failed', 'pending'].includes(r.status))),
    };
    foodOrders = { findOne: jest.fn() };
    marketOrders = { findOne: jest.fn() };
    restaurants = { findOne: jest.fn() };
    stores = { findOne: jest.fn() };
    return new FiscalReceiptsService(
      repo as never,
      foodOrders as never,
      marketOrders as never,
      restaurants as never,
      stores as never,
      provider,
      undefined,
      settings as never,
    );
  }

  describe('recordForShiftPass', () => {
    it("platformaning o'z xizmati — principal 'platform', rol 'seller', butun summa daromad", async () => {
      const service = build();
      const receipt = await service.recordForShiftPass({ passId: 'pass-1', driverUserId: 'driver-user-1', price: 25000 });

      expect(receipt).toEqual(
        expect.objectContaining({
          orderId: 'pass-1',
          serviceType: 'shift_pass',
          principalType: FiscalPrincipalType.PLATFORM,
          principalId: null,
          platformRole: 'seller',
          total: 25000,
          commissionAmount: 25000,
          paymentMethod: 'card',
          status: FiscalReceiptStatus.SKIPPED,
        }),
      );
    });

    it('takroriy chaqiruv yangi yozuv yaratmaydi', async () => {
      const service = build();
      await service.recordForShiftPass({ passId: 'pass-1', driverUserId: 'd', price: 25000 });
      await service.recordForShiftPass({ passId: 'pass-1', driverUserId: 'd', price: 25000 });
      expect(rows).toHaveLength(1);
    });

    it("platforma STIR'i sozlamadan olinadi (§15); sozlanmagan bo'lsa null", async () => {
      const withTin = build(undefined, { getPlatformTin: jest.fn(async () => '301234567') });
      expect((await withTin.recordForShiftPass({ passId: 'p', driverUserId: 'd', price: 25000 }))?.principalTin).toBe(
        '301234567',
      );
      const withoutTin = build(undefined, { getPlatformTin: jest.fn(async () => null) });
      expect(
        (await withoutTin.recordForShiftPass({ passId: 'p2', driverUserId: 'd', price: 25000 }))?.principalTin,
      ).toBeNull();
    });
  });

  // §20: smena bekor qilinib pul qaytarilsa — asl smena chekiga bog'langan
  // QAYTARISH cheki (`receipt_type = 'refund'`, summa musbat, turi bilan belgilangan).
  describe('recordShiftPassRefund', () => {
    it("asl chekka bog'langan qaytarish cheki; provayderga turi va asl chek boradi", async () => {
      const send = jest.fn(async () => ({ status: 'skipped' as const, reason: NOOP_SKIP_REASON }));
      const service = build({ name: 'test', send }, { getPlatformTin: jest.fn(async () => '301234567') });
      const sale = await service.recordForShiftPass({ passId: 'pass-1', driverUserId: 'd', price: 25000 });

      const refund = await service.recordShiftPassRefund({ passId: 'pass-1', driverUserId: 'd', refundAmount: 12500 });

      expect(refund).toEqual(
        expect.objectContaining({
          orderId: 'pass-1',
          receiptType: 'refund',
          originalReceiptId: sale?.id,
          serviceType: 'shift_pass',
          principalType: FiscalPrincipalType.PLATFORM,
          principalTin: '301234567',
          platformRole: 'seller',
          total: 12500,
          commissionAmount: 12500,
          paymentMethod: 'card',
        }),
      );
      expect(refund?.id).not.toBe(sale?.id);
      expect(rows).toHaveLength(2);
      expect(send).toHaveBeenLastCalledWith(
        expect.objectContaining({ receiptType: 'refund', originalReceiptId: sale?.id, total: 12500 }),
      );
      expect(send).toHaveBeenNthCalledWith(1, expect.objectContaining({ receiptType: 'sale', originalReceiptId: null }));
    });

    it('takroriy chaqiruv yangi qaytarish yozuvi yaratmaydi', async () => {
      const service = build();
      await service.recordForShiftPass({ passId: 'pass-1', driverUserId: 'd', price: 25000 });
      await service.recordShiftPassRefund({ passId: 'pass-1', driverUserId: 'd', refundAmount: 12500 });
      await service.recordShiftPassRefund({ passId: 'pass-1', driverUserId: 'd', refundAmount: 12500 });
      expect(rows).toHaveLength(2);
    });

    it("asl chek topilmasa ham qaytarish yoziladi (original_receipt_id = null)", async () => {
      const service = build();
      const refund = await service.recordShiftPassRefund({ passId: 'pass-x', driverUserId: 'd', refundAmount: 100 });
      expect(refund).toEqual(expect.objectContaining({ receiptType: 'refund', originalReceiptId: null }));
    });

    it("summa 0 yoki manfiy — yozuv yo'q", async () => {
      const service = build();
      await expect(service.recordShiftPassRefund({ passId: 'p', driverUserId: 'd', refundAmount: 0 })).resolves.toBeNull();
      expect(rows).toHaveLength(0);
    });
  });

  // §23: karta to'lovi provayder orqali qaytarildi — asl SOTUV chekiga bog'langan
  // qaytarish cheki (komitent, summa, komissiya asl chekdan).
  describe('recordOrderRefund', () => {
    it("asl sotuv chekidan nusxa: receipt_type = 'refund', original_receipt_id", async () => {
      const service = build();
      const sale = await service.recordForRide({ ...ride, paymentMethod: PaymentMethod.CARD });

      const refund = await service.recordOrderRefund('order-1');

      expect(refund).toEqual(
        expect.objectContaining({
          orderId: 'order-1',
          receiptType: 'refund',
          originalReceiptId: sale?.id,
          serviceType: ServiceType.TAXI,
          principalPinfl: '12345678901234',
          total: 20000,
          commissionAmount: 2000,
          paymentMethod: 'card',
        }),
      );
      await service.recordOrderRefund('order-1');
      expect(rows).toHaveLength(2);
    });

    it("asl chek yo'q — qaytarish yozilmaydi (komitent noma'lum), null", async () => {
      const service = build();
      await expect(service.recordOrderRefund('order-x')).resolves.toBeNull();
      expect(rows).toHaveLength(0);
    });
  });

  describe('recordForRide', () => {
    it("noop provayder — yozuv 'skipped', sabab yoziladi", async () => {
      const service = build();
      const receipt = await service.recordForRide(ride);

      expect(receipt).toEqual(
        expect.objectContaining({
          orderId: 'order-1',
          serviceType: 'taxi',
          principalType: FiscalPrincipalType.DRIVER,
          principalId: 'driver-user-1',
          principalPinfl: '12345678901234',
          platformRole: 'komissioner',
          total: 20000,
          commissionAmount: 2000,
          paymentMethod: 'cash',
          status: FiscalReceiptStatus.SKIPPED,
          provider: 'noop',
          attempts: 1,
          lastError: NOOP_SKIP_REASON,
        }),
      );
    });

    it("0 so'mlik safar (bepul yetkazish kuryeri, §7) — chek yozilmaydi, null", async () => {
      const service = build();
      await expect(
        service.recordForRide({ ...ride, serviceType: ServiceType.FOOD, total: 0, commissionAmount: 0 }),
      ).resolves.toBeNull();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("hamyon/karta to'lovi chekda 'card'", async () => {
      const service = build();
      const receipt = await service.recordForRide({ ...ride, paymentMethod: PaymentMethod.WALLET });
      expect(receipt?.paymentMethod).toBe('card');
    });

    it("provayder yubordi — 'sent' va fiskal belgilar saqlanadi", async () => {
      const provider: FiscalProvider = {
        name: 'fake',
        send: jest.fn().mockResolvedValue({
          status: 'sent',
          externalId: 'ext-1',
          fiscalSign: 'FS-1',
          qrUrl: 'https://ofd.example/qr/1',
        }),
      };
      const receipt = await build(provider).recordForRide(ride);
      expect(receipt).toEqual(
        expect.objectContaining({
          status: FiscalReceiptStatus.SENT,
          externalId: 'ext-1',
          fiscalSign: 'FS-1',
          qrUrl: 'https://ofd.example/qr/1',
          lastError: null,
          sentAt: expect.any(Date),
        }),
      );
    });

    it("provayder xatosi — 'failed', chaqiruvchiga xato CHIQMAYDI", async () => {
      const provider: FiscalProvider = { name: 'fake', send: jest.fn().mockRejectedValue(new Error('OFD timeout')) };
      const receipt = await build(provider).recordForRide(ride);
      expect(receipt).toEqual(
        expect.objectContaining({ status: FiscalReceiptStatus.FAILED, lastError: 'OFD timeout', attempts: 1 }),
      );
    });

    it('baza xatosi ham chiqmaydi — null qaytadi', async () => {
      const service = build();
      repo.save.mockRejectedValue(new Error('db down'));
      await expect(service.recordForRide(ride)).resolves.toBeNull();
    });

    it('takroriy chaqiruv — yangi yozuv ham, qayta yuborish ham yo‘q', async () => {
      const send = jest.fn().mockResolvedValue({ status: 'skipped', reason: 'x' });
      const service = build({ name: 'fake', send });
      await service.recordForRide(ride);
      await service.recordForRide(ride);
      expect(rows).toHaveLength(1);
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('unikal indeks poygasi (23505) — mavjud yozuv qaytadi', async () => {
      const service = build();
      const existing = { id: 'r9', orderId: 'order-1', status: FiscalReceiptStatus.SKIPPED } as FiscalReceipt;
      repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
      repo.save.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }));
      await expect(service.recordForRide(ride)).resolves.toBe(existing);
    });
  });

  describe('recordForVendorOrder', () => {
    it('ovqat (platforma kuryeri) — komitent restoran, summa va komissiya tovar qismidan (yetkazish haqisiz)', async () => {
      const service = build();
      foodOrders.findOne.mockResolvedValue({
        id: 'food-1',
        restaurantId: 'rest-1',
        totalPrice: 57000,
        items: [{ qty: 2, price: 25000 }],
        paymentMethod: 'cash',
        deliveryOrderId: 'ride-1',
      });
      restaurants.findOne.mockResolvedValue({ id: 'rest-1', tin: '123456789', commissionRate: 10 });

      const receipt = await service.recordForVendorOrder('food', 'food-1');

      expect(receipt).toEqual(
        expect.objectContaining({
          orderId: 'food-1',
          serviceType: 'food',
          principalType: FiscalPrincipalType.RESTAURANT,
          principalId: 'rest-1',
          principalTin: '123456789',
          total: 50000,
          // 10% × 50 000 tovar — chek summasi bilan mos (ilgari 5 700 = 57 000 dan).
          commissionAmount: 5000,
          paymentMethod: 'cash',
        }),
      );
    });

    it("o'zi yetkazgan buyurtma — chekda yetkazish haqi ham (sotuvchining o'z xizmati), komissiya faqat tovardan", async () => {
      const service = build();
      foodOrders.findOne.mockResolvedValue({
        id: 'food-2',
        restaurantId: 'rest-1',
        totalPrice: 58000,
        items: [{ qty: 1, price: 50000 }],
        paymentMethod: 'card',
        deliveryOrderId: null,
      });
      restaurants.findOne.mockResolvedValue({ id: 'rest-1', tin: '123456789', commissionRate: 12 });

      const receipt = await service.recordForVendorOrder('food', 'food-2');

      expect(receipt).toEqual(expect.objectContaining({ orderId: 'food-2', total: 58000, commissionAmount: 6000 }));
    });

    it('takroriy chaqiruv (qo‘lda yetkazildi + kechikkan hodisa) — bitta chek', async () => {
      const service = build();
      foodOrders.findOne.mockResolvedValue({
        id: 'food-3',
        restaurantId: 'rest-1',
        totalPrice: 50000,
        items: [{ qty: 1, price: 50000 }],
        paymentMethod: 'cash',
        deliveryOrderId: null,
      });
      restaurants.findOne.mockResolvedValue({ id: 'rest-1', tin: null, commissionRate: 10 });

      const first = await service.recordForVendorOrder('food', 'food-3');
      const second = await service.recordForVendorOrder('food', 'food-3');

      expect(second?.id).toBe(first?.id);
      expect(rows.filter((r) => r.orderId === 'food-3')).toHaveLength(1);
      expect(repo.create).toHaveBeenCalledTimes(1);
    });

    it("market — komitent do'kon", async () => {
      const service = build();
      marketOrders.findOne.mockResolvedValue({
        id: 'mkt-1',
        storeId: 'store-1',
        totalPrice: 30000,
        items: [{ qty: 1, price: 30000 }],
        paymentMethod: 'card',
      });
      stores.findOne.mockResolvedValue({ id: 'store-1', tin: null, commissionRate: 0 });

      const receipt = await service.recordForVendorOrder('market', 'mkt-1');
      expect(receipt).toEqual(
        expect.objectContaining({
          principalType: FiscalPrincipalType.STORE,
          principalTin: null,
          total: 30000,
          commissionAmount: 0,
          paymentMethod: 'card',
        }),
      );
    });

    it("buyurtma topilmasa — null, xato chiqmaydi", async () => {
      const service = build();
      foodOrders.findOne.mockResolvedValue(null);
      await expect(service.recordForVendorOrder('food', 'nope')).resolves.toBeNull();
    });
  });

  describe('retry', () => {
    it("'failed' yozuvni qayta yuboradi, urinishlar oshadi", async () => {
      const send = jest
        .fn()
        .mockRejectedValueOnce(new Error('OFD timeout'))
        .mockResolvedValueOnce({ status: 'sent', externalId: 'e', fiscalSign: null, qrUrl: null });
      const service = build({ name: 'fake', send });
      const failed = await service.recordForRide(ride);

      const retried = await service.retry(failed!.id);
      expect(retried).toEqual(expect.objectContaining({ status: FiscalReceiptStatus.SENT, attempts: 2 }));
    });

    it("'sent' yoki 'skipped' — qayta yuborilmaydi (400)", async () => {
      const service = build();
      const skipped = await service.recordForRide(ride);
      await expect(service.retry(skipped!.id)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("yo'q yozuv — 404", async () => {
      await expect(build().retry('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retryPending — failed/pending hammasi qayta yuboriladi, xulosa qaytadi', async () => {
      const send = jest
        .fn()
        .mockRejectedValueOnce(new Error('x'))
        .mockResolvedValue({ status: 'sent', externalId: 'e', fiscalSign: null, qrUrl: null });
      const service = build({ name: 'fake', send });
      await service.recordForRide(ride);

      await expect(service.retryPending()).resolves.toEqual({
        retried: 1,
        sent: 1,
        failed: 0,
        skipped: 0,
      });
    });
  });
});
