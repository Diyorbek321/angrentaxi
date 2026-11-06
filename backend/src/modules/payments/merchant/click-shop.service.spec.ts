import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ClickProvider } from '../click.provider';
import { ClickShopService } from './click-shop.service';
import { FakeMerchantDataSource, FakeMerchantRepo, FakeTargets } from './merchant-test-kit';

/**
 * Click SHOP API kontrakt testlari: action 0 = Prepare, 1 = Complete
 * (avvalgi buyurtma oqimi `action === 2` ni kutardi — to'lov hech qachon
 * yakunlanmasdi). Haqiqiy `ClickProvider` imzo formulasi bilan.
 */
describe('ClickShopService (Click SHOP API)', () => {
  const SECRET = 'click-secret';
  const SERVICE_ID = '777';
  const ORDER = '11111111-1111-4111-8111-111111111111';
  const TOPUP = 'topup_22222222-2222-4222-8222-222222222222';
  const SIGN_TIME = '2026-10-15 12:00:00';

  let repo: FakeMerchantRepo;
  let targets: FakeTargets;
  let service: ClickShopService;

  beforeEach(() => {
    repo = new FakeMerchantRepo();
    targets = new FakeTargets();
    targets.add(ORDER, 25_000);
    targets.add(TOPUP, 50_000, 'payable', 'topup');
    const config = {
      get: (key: string, fallback?: string) =>
        ({ CLICK_SECRET_KEY: SECRET, CLICK_SERVICE_ID: SERVICE_ID, CLICK_MERCHANT_ID: 'm1' })[key] ?? fallback,
    } as unknown as ConfigService;
    service = new ClickShopService(
      repo as never,
      targets as never,
      new ClickProvider(config),
      new FakeMerchantDataSource(repo) as never,
    );
  });

  function signed(body: Record<string, string | number>): Record<string, string> {
    const action = Number(body.action);
    const preparePart = action === 1 ? String(body.merchant_prepare_id) : '';
    const sign = createHash('md5')
      .update(
        `${body.click_trans_id}${body.service_id}${SECRET}${body.merchant_trans_id}${preparePart}${body.amount}${body.action}${body.sign_time}`,
      )
      .digest('hex');
    return Object.fromEntries(
      Object.entries({ ...body, sign_string: sign }).map(([k, v]) => [k, String(v)]),
    );
  }

  const prepare = (ref = ORDER, amount = '25000.00', clickTransId = '9001') =>
    signed({
      click_trans_id: clickTransId,
      service_id: SERVICE_ID,
      click_paydoc_id: '5001',
      merchant_trans_id: ref,
      amount,
      action: 0,
      error: 0,
      error_note: 'Success',
      sign_time: SIGN_TIME,
    });

  const complete = (prepareId: number | string, ref = ORDER, amount = '25000.00', error = 0, clickTransId = '9001') =>
    signed({
      click_trans_id: clickTransId,
      service_id: SERVICE_ID,
      click_paydoc_id: '5001',
      merchant_trans_id: ref,
      merchant_prepare_id: prepareId,
      amount,
      action: 1,
      error,
      error_note: error ? 'Insufficient funds' : 'Success',
      sign_time: SIGN_TIME,
    });

  describe('Prepare (action = 0)', () => {
    it('muvaffaqiyat — aniq javob maydonlari', async () => {
      await expect(service.handle(prepare())).resolves.toEqual({
        click_trans_id: '9001',
        merchant_trans_id: ORDER,
        merchant_prepare_id: 101,
        error: 0,
        error_note: 'Success',
      });
      expect(repo.rows[0]).toMatchObject({ provider: 'click', externalId: '9001', state: 1, targetKind: 'order' });
    });

    it('takror — o\'sha merchant_prepare_id', async () => {
      await service.handle(prepare());
      await expect(service.handle(prepare())).resolves.toMatchObject({ merchant_prepare_id: 101, error: 0 });
      expect(repo.rows).toHaveLength(1);
    });

    it("imzo noto'g'ri — −1", async () => {
      await expect(service.handle({ ...prepare(), sign_string: 'x'.repeat(32) })).resolves.toEqual({
        click_trans_id: '9001',
        merchant_trans_id: ORDER,
        error: -1,
        error_note: 'SIGN CHECK FAILED!',
      });
    });

    it("summa mos emas — −2", async () => {
      await expect(service.handle(prepare(ORDER, '100.00'))).resolves.toMatchObject({
        error: -2,
        error_note: 'Incorrect parameter amount',
      });
    });

    it("noma'lum action — −3", async () => {
      const body = signed({ ...prepare(), action: 5 });
      await expect(service.handle(body)).resolves.toMatchObject({ error: -3, error_note: 'Action not found' });
    });

    it("allaqachon to'langan — −4", async () => {
      targets.add(ORDER, 25_000, 'paid');
      await expect(service.handle(prepare())).resolves.toMatchObject({ error: -4, error_note: 'Already paid' });
    });

    it("buyurtma topilmadi — −5", async () => {
      await expect(service.handle(prepare('33333333-3333-4333-8333-333333333333'))).resolves.toMatchObject({
        error: -5,
        error_note: 'User does not exist',
      });
    });

    it("majburiy maydon yo'q — −8", async () => {
      const { sign_time: _omit, ...body } = prepare();
      await expect(service.handle(body)).resolves.toMatchObject({ error: -8, error_note: 'Error in request from click' });
    });

    it("bekor qilingan nishon — −9", async () => {
      targets.add(ORDER, 25_000, 'closed');
      await expect(service.handle(prepare())).resolves.toMatchObject({ error: -9, error_note: 'Transaction cancelled' });
    });
  });

  describe('Complete (action = 1)', () => {
    it("buyurtma to'lovini yakunlaydi — aniq javob, nishon to'landi", async () => {
      await service.handle(prepare());
      await expect(service.handle(complete(101))).resolves.toEqual({
        click_trans_id: '9001',
        merchant_trans_id: ORDER,
        merchant_confirm_id: 101,
        error: 0,
        error_note: 'Success',
      });
      expect(targets.targets.get(ORDER)).toMatchObject({ status: 'paid', paidBy: 'click_9001' });
      expect(repo.rows[0].state).toBe(2);
    });

    it("to'ldirish ham xuddi shu kod bilan", async () => {
      await service.handle(prepare(TOPUP, '50000.00', '42'));
      await expect(service.handle(complete(101, TOPUP, '50000.00', 0, '42'))).resolves.toMatchObject({ error: 0 });
      expect(targets.targets.get(TOPUP)).toMatchObject({ status: 'paid', paidBy: 'click_42' });
    });

    it("takroriy Complete — −4, ikkinchi marta pul tushmaydi", async () => {
      await service.handle(prepare());
      await service.handle(complete(101));
      const spy = jest.spyOn(targets, 'markPaid');
      await expect(service.handle(complete(101))).resolves.toMatchObject({ error: -4, error_note: 'Already paid' });
      expect(spy).not.toHaveBeenCalled();
    });

    it("noto'g'ri merchant_prepare_id — −6", async () => {
      await service.handle(prepare());
      await expect(service.handle(complete(999))).resolves.toMatchObject({
        error: -6,
        error_note: 'Transaction does not exist',
      });
    });

    it("Click xatosi (error < 0) — bekor, −9, nishon bo'shatiladi", async () => {
      await service.handle(prepare(TOPUP, '50000.00'));
      await expect(service.handle(complete(101, TOPUP, '50000.00', -5017))).resolves.toEqual({
        click_trans_id: '9001',
        merchant_trans_id: TOPUP,
        merchant_confirm_id: 101,
        error: -9,
        error_note: 'Transaction cancelled',
      });
      expect(targets.released).toEqual([{ ref: TOPUP, failed: true }]);
      expect(targets.targets.get(TOPUP)?.status).toBe('payable');
      expect(repo.rows[0].state).toBe(-1);
    });

    it("bekor qilingan tranzaksiyani Complete — −9", async () => {
      await service.handle(prepare());
      await service.handle(complete(101, ORDER, '25000.00', -1));
      await expect(service.handle(complete(101))).resolves.toMatchObject({ error: -9 });
    });

    it("summa mos emas — −2", async () => {
      await service.handle(prepare());
      await expect(service.handle(complete(101, ORDER, '1.00'))).resolves.toMatchObject({ error: -2 });
    });

    it("imzoga merchant_prepare_id kiradi — usiz hisoblangan imzo rad etiladi", async () => {
      await service.handle(prepare());
      const body = complete(101);
      const withoutPrepare = createHash('md5')
        .update(`9001${SERVICE_ID}${SECRET}${ORDER}25000.001${SIGN_TIME}`)
        .digest('hex');
      await expect(service.handle({ ...body, sign_string: withoutPrepare })).resolves.toMatchObject({ error: -1 });
    });

    it("ichki xato — −7 (throw emas)", async () => {
      await service.handle(prepare());
      jest.spyOn(targets, 'markPaid').mockRejectedValueOnce(new Error('db down'));
      await expect(service.handle(complete(101))).resolves.toMatchObject({ error: -7, error_note: 'Failed to update user' });
    });
  });

  // §11-band: Prepare'dan keyin Complete kelmasa — soatlik cron bekor deb
  // belgilaydi (pulga ta'siri yo'q, nishonga tegilmaydi).
  describe('expireStalePrepares (soatlik tozalash)', () => {
    const minutes = (n: number) => n * 60 * 1000;

    it("TTL dan eski Click Prepare → state −1, cancel_time; nishon bo'shatilmaydi", async () => {
      await service.handle(prepare());
      const createdAt = repo.rows[0].createTime as Date;

      await expect(service.expireStalePrepares(new Date(createdAt.getTime() + minutes(59)))).resolves.toBe(0);
      expect(repo.rows[0].state).toBe(1);

      const now = new Date(createdAt.getTime() + minutes(61));
      await expect(service.expireStalePrepares(now)).resolves.toBe(1);
      expect(repo.rows[0]).toEqual(expect.objectContaining({ state: -1, cancelTime: now }));
      expect(targets.released).toEqual([]);

      // Kech kelgan Complete — bekor (−9), pul yo'q.
      await expect(service.handle(complete(101))).resolves.toEqual(expect.objectContaining({ error: -9 }));
      expect(targets.targets.get(ORDER)?.status).toBe('payable');
    });

    it("bajarilgan va Payme tranzaksiyalariga tegmaydi", async () => {
      await service.handle(prepare());
      await service.handle(complete(101));
      repo.rows.push({ ...repo.rows[0], id: 'payme-1', provider: 'payme', state: 1, externalId: 'p1' } as never);
      const later = new Date(Date.now() + minutes(600));
      await expect(service.expireStalePrepares(later)).resolves.toBe(0);
      expect(repo.rows.map((r) => r.state)).toEqual([2, 1]);
    });

    it('TTL sozlanadi (CLICK_PREPARE_TTL_MINUTES)', async () => {
      const config = {
        get: (key: string, fallback?: unknown) =>
          ({ CLICK_SECRET_KEY: SECRET, CLICK_SERVICE_ID: SERVICE_ID, CLICK_MERCHANT_ID: 'm1', CLICK_PREPARE_TTL_MINUTES: 10 } as Record<string, unknown>)[key] ?? fallback,
      } as unknown as ConfigService;
      const custom = new ClickShopService(
        repo as never,
        targets as never,
        new ClickProvider(config),
        new FakeMerchantDataSource(repo) as never,
        config,
      );
      await custom.handle(prepare());
      const createdAt = repo.rows[0].createTime as Date;
      await expect(custom.expireStalePrepares(new Date(createdAt.getTime() + minutes(11)))).resolves.toBe(1);
    });
  });
});
