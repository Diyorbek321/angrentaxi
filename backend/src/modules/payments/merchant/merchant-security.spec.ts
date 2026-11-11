import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { ClickProvider } from '../click.provider';
import { ClickShopService } from './click-shop.service';
import { PaymeMerchantService } from './payme-merchant.service';
import { FakeMerchantDataSource, FakeMerchantRepo, FakeTargets } from './merchant-test-kit';
import { TargetRef } from './payment-targets.service';

/**
 * Xavfsizlik regressiyalari (security review 2026-10-15):
 *  #8  Perform/Cancel poygasi — holat da'vosi pul bilan BITTA tranzaksiyada,
 *      qator qulfi ostida; Cancel izchil holatni ko'radi.
 *  #10 Summalar butun tiyinda, qat'iy tenglik; Payme kasr tiyin — −31001.
 *  #11 Click `error < 0` — faqat mos (summa ham) tayyorlangan tranzaksiyada bekor.
 */
describe('Merchant protokollari — xavfsizlik', () => {
  const ORDER = '11111111-1111-4111-8111-111111111111';
  const T0 = 1_760_000_000_000;

  describe('Payme', () => {
    let repo: FakeMerchantRepo;
    let targets: FakeTargets;
    let dataSource: FakeMerchantDataSource;
    let service: PaymeMerchantService;

    beforeEach(() => {
      repo = new FakeMerchantRepo();
      targets = new FakeTargets();
      targets.add(ORDER, 25_000);
      dataSource = new FakeMerchantDataSource(repo);
      service = new PaymeMerchantService(
        repo as never,
        targets as never,
        { verifyCallbackSignature: () => true } as never,
        dataSource as never,
      );
      jest.spyOn(Date, 'now').mockImplementation(() => T0);
    });

    afterEach(() => jest.restoreAllMocks());

    const call = (method: string, params: Record<string, unknown>) =>
      service.handle({ jsonrpc: '2.0', id: 1, method, params }, 'Basic ok');

    it('#8 Perform paytida kelgan Cancel izchil: pul olingan bo\'lsa — refund (−2), yo\'qolgan pul yo\'q', async () => {
      await call('CreateTransaction', { id: 'p1', time: T0, amount: 2_500_000, account: { order_id: ORDER } });

      let releaseMarkPaid: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        releaseMarkPaid = resolve;
      });
      const realMarkPaid = targets.markPaid.bind(targets);
      const pending: { cancel: Promise<unknown> | null } = { cancel: null };
      jest.spyOn(targets, 'markPaid').mockImplementation(async (ref: TargetRef, input: { amount: number; externalId: string }) => {
        // Pul effekti davomida Payme Cancel yuboradi.
        pending.cancel = call('CancelTransaction', { id: 'p1', reason: 3 });
        await gate;
        return realMarkPaid(ref, input);
      });

      const performPromise = call('PerformTransaction', { id: 'p1' });
      await new Promise((resolve) => setImmediate(resolve));
      releaseMarkPaid();
      const performed = await performPromise;
      const cancelled = await pending.cancel;

      expect(performed).toMatchObject({ result: { state: 2 } });
      // Cancel Perform tugaguncha kutdi va to'langan tranzaksiyani ko'rdi → refund.
      expect(cancelled).toMatchObject({ result: { state: -2 } });
      expect(targets.refunded).toEqual([{ ref: ORDER, externalId: 'payme_p1' }]);
      expect(targets.released).toEqual([]);
      expect(repo.rows[0].state).toBe(-2);
    });

    it("#8 Perform pul effekti tranzaksiya ichida (rad etilsa holat o'zgarmaydi)", async () => {
      await call('CreateTransaction', { id: 'p1', time: T0, amount: 2_500_000, account: { order_id: ORDER } });
      targets.targets.set(ORDER, { ...targets.targets.get(ORDER)!, status: 'closed' });
      const before = dataSource.transactions;
      expect(await call('PerformTransaction', { id: 'p1' })).toMatchObject({ error: { code: -31008 } });
      expect(dataSource.transactions).toBeGreaterThan(before);
      expect(repo.rows[0].state).toBe(1);
    });

    it('#10 kasr tiyin — −31001 (Check va Create)', async () => {
      expect(
        await call('CheckPerformTransaction', { amount: 2_500_000.4, account: { order_id: ORDER } }),
      ).toMatchObject({ error: { code: -31001 } });
      expect(
        await call('CreateTransaction', { id: 'p2', time: T0, amount: 2_500_000.4, account: { order_id: ORDER } }),
      ).toMatchObject({ error: { code: -31001 } });
      expect(repo.rows).toHaveLength(0);
    });

    it('#10 1 tiyin farq — −31001', async () => {
      expect(
        await call('CheckPerformTransaction', { amount: 2_500_001, account: { order_id: ORDER } }),
      ).toMatchObject({ error: { code: -31001 } });
    });
  });

  describe('Click', () => {
    const SECRET = 'click-secret';
    let repo: FakeMerchantRepo;
    let targets: FakeTargets;
    let service: ClickShopService;

    beforeEach(() => {
      repo = new FakeMerchantRepo();
      targets = new FakeTargets();
      targets.add(ORDER, 25_000);
      const config = {
        get: (key: string, fallback?: string) =>
          ({ CLICK_SECRET_KEY: SECRET, CLICK_SERVICE_ID: '777', CLICK_MERCHANT_ID: 'm1' })[key] ?? fallback,
      } as unknown as ConfigService;
      service = new ClickShopService(
        repo as never,
        targets as never,
        new ClickProvider(config),
        new FakeMerchantDataSource(repo) as never,
      );
    });

    function signed(body: Record<string, string>): Record<string, string> {
      const preparePart = body.action === '1' ? body.merchant_prepare_id : '';
      const sign = createHash('md5')
        .update(
          `${body.click_trans_id}${body.service_id}${SECRET}${body.merchant_trans_id}${preparePart}${body.amount}${body.action}${body.sign_time}`,
        )
        .digest('hex');
      return { ...body, sign_string: sign };
    }
    const base = { click_trans_id: '9001', service_id: '777', merchant_trans_id: ORDER, sign_time: 't' };

    it("#10 kasr tiyin summa — −2 (Prepare)", async () => {
      const res = await service.handle(signed({ ...base, amount: '25000.004', action: '0' }));
      expect(res.error).toBe(-2);
    });

    it("#11 Complete'dagi `error < 0` summasi mos kelmasa — bekor QILINMAYDI (−2)", async () => {
      const prepared = await service.handle(signed({ ...base, amount: '25000.00', action: '0' }));
      const res = await service.handle(
        signed({ ...base, amount: '1.00', action: '1', merchant_prepare_id: String(prepared.merchant_prepare_id), error: '-1' }),
      );
      expect(res.error).toBe(-2);
      expect(repo.rows[0].state).toBe(1);
      expect(targets.released).toEqual([]);
    });
  });
});
