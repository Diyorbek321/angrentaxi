import { PaymeMerchantService } from './payme-merchant.service';
import { FakeMerchantDataSource, FakeMerchantRepo, FakeTargets } from './merchant-test-kit';

/**
 * Payme Merchant API kontrakt testlari — javob TANASI aynan tekshiriladi
 * (JSON-RPC 2.0: `{ jsonrpc, id, result }` / `{ jsonrpc, id, error: { code,
 * message: { uz, ru, en }, data } }`). Buyurtma va to'ldirish bitta kod.
 */
describe('PaymeMerchantService (Payme Merchant API)', () => {
  const ORDER = '11111111-1111-4111-8111-111111111111';
  const TOPUP = 'topup_22222222-2222-4222-8222-222222222222';
  const T0 = 1_760_000_000_000;
  const AUTH = 'Basic ok';

  let repo: FakeMerchantRepo;
  let targets: FakeTargets;
  let service: PaymeMerchantService;
  let now: number;

  beforeEach(() => {
    repo = new FakeMerchantRepo();
    targets = new FakeTargets();
    targets.add(ORDER, 25_000);
    targets.add(TOPUP, 50_000, 'payable', 'topup');
    const provider = { verifyCallbackSignature: jest.fn((_b: unknown, auth: string) => auth === AUTH) };
    service = new PaymeMerchantService(
      repo as never,
      targets as never,
      provider as never,
      new FakeMerchantDataSource(repo) as never,
    );
    now = T0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => jest.restoreAllMocks());

  const call = (method: string, params: Record<string, unknown>, id: number | string = 7, auth = AUTH) =>
    service.handle({ jsonrpc: '2.0', id, method, params }, auth);

  const create = (paymeId: string, ref: string, tiyin: number, time = T0) =>
    call('CreateTransaction', { id: paymeId, time, amount: tiyin, account: { order_id: ref } });

  describe('autentifikatsiya va konvert', () => {
    it("noto'g'ri Basic auth — −32504, id qaytariladi", async () => {
      await expect(call('CheckPerformTransaction', {}, 'abc', 'Basic bad')).resolves.toEqual({
        jsonrpc: '2.0',
        id: 'abc',
        error: {
          code: -32504,
          message: {
            uz: 'Ushbu amalni bajarish uchun huquq yetarli emas',
            ru: 'Недостаточно привилегий для выполнения метода',
            en: 'Insufficient privileges to perform this method',
          },
        },
      });
    });

    it("noma'lum metod — −32601, data = metod nomi", async () => {
      const res = await call('Foo', {});
      expect(res).toEqual({
        jsonrpc: '2.0',
        id: 7,
        error: { code: -32601, message: expect.objectContaining({ en: 'Method not found' }), data: 'Foo' },
      });
    });

    it("params yo'q — −32600", async () => {
      const res = await service.handle({ id: 1, method: 'CheckTransaction' }, AUTH);
      expect(res).toMatchObject({ jsonrpc: '2.0', id: 1, error: { code: -32600 } });
    });

    it('ichki xato — −32400 (HTTP 200 bilan, throw emas)', async () => {
      jest.spyOn(repo, 'findOne').mockRejectedValueOnce(new Error('db down'));
      const res = await call('CheckTransaction', { id: 'p1' });
      expect(res).toMatchObject({ jsonrpc: '2.0', id: 7, error: { code: -32400 } });
    });
  });

  describe('CheckPerformTransaction', () => {
    it("to'g'ri summa — { allow: true }", async () => {
      await expect(
        call('CheckPerformTransaction', { amount: 2_500_000, account: { order_id: ORDER } }),
      ).resolves.toEqual({ jsonrpc: '2.0', id: 7, result: { allow: true } });
    });

    it("summa mos emas — −31001", async () => {
      const res = await call('CheckPerformTransaction', { amount: 100, account: { order_id: ORDER } });
      expect(res).toEqual({
        jsonrpc: '2.0',
        id: 7,
        error: { code: -31001, message: { uz: "Noto'g'ri summa", ru: 'Неверная сумма', en: 'Invalid amount' } },
      });
    });

    it("buyurtma topilmadi — −31050, data = 'order_id'", async () => {
      const res = await call('CheckPerformTransaction', {
        amount: 100,
        account: { order_id: '99999999-9999-4999-8999-999999999999' },
      });
      expect(res).toMatchObject({ error: { code: -31050, data: 'order_id' } });
    });

    it("to'langan buyurtma — −31051", async () => {
      targets.add(ORDER, 25_000, 'paid');
      const res = await call('CheckPerformTransaction', { amount: 2_500_000, account: { order_id: ORDER } });
      expect(res).toMatchObject({ error: { code: -31051, data: 'order_id' } });
    });
  });

  describe('CreateTransaction', () => {
    it('yangi tranzaksiya — create_time, transaction, state 1', async () => {
      await expect(create('p1', ORDER, 2_500_000)).resolves.toEqual({
        jsonrpc: '2.0',
        id: 7,
        result: { create_time: T0, transaction: '101', state: 1 },
      });
      expect(repo.rows[0]).toMatchObject({
        provider: 'payme',
        externalId: 'p1',
        targetKind: 'order',
        targetRef: ORDER,
        amount: 25_000,
        state: 1,
        providerTime: T0,
      });
    });

    it('takroriy chaqiruv — xuddi shu javob, yangi qator yo\'q', async () => {
      const first = await create('p1', ORDER, 2_500_000);
      now += 1000;
      await expect(create('p1', ORDER, 2_500_000)).resolves.toEqual(first);
      expect(repo.rows).toHaveLength(1);
    });

    it("buyurtmada boshqa faol tranzaksiya — −31052 (bitta faol tranzaksiya)", async () => {
      await create('p1', ORDER, 2_500_000);
      const res = await create('p2', ORDER, 2_500_000);
      expect(res).toMatchObject({ error: { code: -31052, data: 'order_id' } });
    });

    it('summa mos emas — −31001', async () => {
      await expect(create('p1', ORDER, 1)).resolves.toMatchObject({ error: { code: -31001 } });
    });

    it("12 soatdan eski mavjud tranzaksiya — bekor (sabab 4) va −31008", async () => {
      await create('p1', ORDER, 2_500_000);
      now = T0 + 43_200_001;
      await expect(create('p1', ORDER, 2_500_000)).resolves.toMatchObject({ error: { code: -31008 } });
      expect(repo.rows[0]).toMatchObject({ state: -1, reason: 4 });
    });

    it("faol, lekin muddati o'tgan tranzaksiya yangisiga xalaqit bermaydi", async () => {
      await create('p1', ORDER, 2_500_000);
      now = T0 + 43_200_001;
      const res = await create('p2', ORDER, 2_500_000, now);
      expect(res).toMatchObject({ result: { state: 1 } });
      expect(repo.rows.find((r) => r.externalId === 'p1')).toMatchObject({ state: -1, reason: 4 });
    });
  });

  describe('PerformTransaction', () => {
    it("o'tkazadi — transaction, perform_time, state 2; nishon to'landi", async () => {
      await create('p1', ORDER, 2_500_000);
      now = T0 + 5000;
      await expect(call('PerformTransaction', { id: 'p1' })).resolves.toEqual({
        jsonrpc: '2.0',
        id: 7,
        result: { transaction: '101', perform_time: T0 + 5000, state: 2 },
      });
      expect(targets.targets.get(ORDER)).toMatchObject({ status: 'paid', paidBy: 'payme_p1' });
    });

    it('takror — o\'sha javob, ikkinchi marta pul tushmaydi', async () => {
      await create('p1', ORDER, 2_500_000);
      const first = await call('PerformTransaction', { id: 'p1' });
      now += 10_000;
      const spy = jest.spyOn(targets, 'markPaid');
      await expect(call('PerformTransaction', { id: 'p1' })).resolves.toEqual(first);
      expect(spy).not.toHaveBeenCalled();
    });

    it("topilmadi — −31003", async () => {
      await expect(call('PerformTransaction', { id: 'nope' })).resolves.toMatchObject({
        error: { code: -31003, message: { en: 'Transaction not found' } },
      });
    });

    it("muddati o'tgan — bekor (sabab 4), −31008, pul tushmaydi", async () => {
      await create('p1', ORDER, 2_500_000);
      now = T0 + 43_200_001;
      await expect(call('PerformTransaction', { id: 'p1' })).resolves.toMatchObject({ error: { code: -31008 } });
      expect(targets.targets.get(ORDER)?.status).toBe('payable');
    });

    it("bekor qilingan tranzaksiya — −31008", async () => {
      await create('p1', ORDER, 2_500_000);
      await call('CancelTransaction', { id: 'p1', reason: 3 });
      await expect(call('PerformTransaction', { id: 'p1' })).resolves.toMatchObject({ error: { code: -31008 } });
    });

    it("to'ldirish ham xuddi shu kod bilan o'tadi (summa tiyinda)", async () => {
      await create('t1', TOPUP, 5_000_000);
      await expect(call('PerformTransaction', { id: 't1' })).resolves.toMatchObject({ result: { state: 2 } });
      expect(targets.targets.get(TOPUP)).toMatchObject({ status: 'paid', paidBy: 'payme_t1' });
    });
  });

  describe('CancelTransaction', () => {
    it("o'tkazilmagan — state −1, cancel_time; nishon bo'shatiladi", async () => {
      await create('p1', TOPUP, 5_000_000);
      now = T0 + 3000;
      await expect(call('CancelTransaction', { id: 'p1', reason: 3 })).resolves.toEqual({
        jsonrpc: '2.0',
        id: 7,
        result: { transaction: '101', cancel_time: T0 + 3000, state: -1 },
      });
      expect(targets.released).toEqual([{ ref: TOPUP, failed: false }]);
    });

    it("o'tkazilgan — state −2, refund", async () => {
      await create('p1', ORDER, 2_500_000);
      await call('PerformTransaction', { id: 'p1' });
      now = T0 + 9000;
      await expect(call('CancelTransaction', { id: 'p1', reason: 5 })).resolves.toEqual({
        jsonrpc: '2.0',
        id: 7,
        result: { transaction: '101', cancel_time: T0 + 9000, state: -2 },
      });
      expect(targets.refunded).toEqual([{ ref: ORDER, externalId: 'payme_p1' }]);
      expect(repo.rows[0]).toMatchObject({ state: -2, reason: 5 });
    });

    it('takror — o\'sha javob, ikkinchi refund yo\'q', async () => {
      await create('p1', ORDER, 2_500_000);
      await call('PerformTransaction', { id: 'p1' });
      const first = await call('CancelTransaction', { id: 'p1', reason: 5 });
      now += 1000;
      await expect(call('CancelTransaction', { id: 'p1', reason: 5 })).resolves.toEqual(first);
      expect(targets.refunded).toHaveLength(1);
    });

    it('topilmadi — −31003', async () => {
      await expect(call('CancelTransaction', { id: 'x', reason: 1 })).resolves.toMatchObject({
        error: { code: -31003 },
      });
    });
  });

  describe('CheckTransaction', () => {
    it('barcha maydonlar, null bo\'lmagan vaqtlar 0', async () => {
      await create('p1', ORDER, 2_500_000);
      await expect(call('CheckTransaction', { id: 'p1' })).resolves.toEqual({
        jsonrpc: '2.0',
        id: 7,
        result: {
          create_time: T0,
          perform_time: 0,
          cancel_time: 0,
          transaction: '101',
          state: 1,
          reason: null,
        },
      });
    });

    it('topilmadi — −31003', async () => {
      await expect(call('CheckTransaction', { id: 'x' })).resolves.toMatchObject({ error: { code: -31003 } });
    });
  });

  describe('GetStatement', () => {
    it("oraliqdagi tranzaksiyalar (Payme `time` bo'yicha), summa tiyinda", async () => {
      await create('p1', ORDER, 2_500_000, T0 - 10);
      await call('PerformTransaction', { id: 'p1' });
      await create('t1', TOPUP, 5_000_000, T0 + 10);
      await create('old', '33333333-3333-4333-8333-333333333333', 1, T0 - 1_000_000);

      const res = await call('GetStatement', { from: T0 - 100, to: T0 + 100 });
      expect(res).toEqual({
        jsonrpc: '2.0',
        id: 7,
        result: {
          transactions: [
            {
              id: 'p1',
              time: T0 - 10,
              amount: 2_500_000,
              account: { order_id: ORDER },
              create_time: T0,
              perform_time: T0,
              cancel_time: 0,
              transaction: '101',
              state: 2,
              reason: null,
            },
            {
              id: 't1',
              time: T0 + 10,
              amount: 5_000_000,
              account: { order_id: TOPUP },
              create_time: T0,
              perform_time: 0,
              cancel_time: 0,
              transaction: '102',
              state: 1,
              reason: null,
            },
          ],
        },
      });
    });
  });
});
