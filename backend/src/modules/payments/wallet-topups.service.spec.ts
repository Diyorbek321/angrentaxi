import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WalletTopupStatus } from '../../database/entities/wallet-topup.entity';
import {
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { WALLET_TOPUP_TTL_MS } from './wallet-topups.service';
import { PaymentTargetsService } from './merchant/payment-targets.service';
import { PaymeMerchantService } from './merchant/payme-merchant.service';
import { ClickShopService } from './merchant/click-shop.service';
import { FakeMerchantRepo } from './merchant/merchant-test-kit';
import { WALLET_TOPUP_TEST_ID, buildTopupHarness } from './wallet-topups.test-kit';

const TOPUP_ID = WALLET_TOPUP_TEST_ID;

describe('WalletTopupsService', () => {
  describe('POST /payments/wallet/topup', () => {
    it("pending yozuv yaratadi va provayderga `topup_<id>` havolasini beradi", async () => {
      const h = buildTopupHarness();
      const res = await h.service.create('user-1', '+998901234567', { amount: 100000, provider: 'payme' });
      // `WALLET_TOPUP_RETURN_URL` sozlanmagan — provayder standarti.
      expect(h.payme.initiate).toHaveBeenCalledWith(100000, `topup_${TOPUP_ID}`, '+998901234567', undefined);
      expect(res).toEqual(
        expect.objectContaining({
          topupId: TOPUP_ID,
          id: TOPUP_ID,
          checkoutUrl: expect.stringContaining(`topup_${TOPUP_ID}`),
          amount: 100000,
          provider: 'payme',
          status: 'pending',
          paidAt: null,
        }),
      );
      // Pul hali tushmagan.
      expect(h.ledger).toHaveLength(0);
    });

    it("o'chiq bo'lsa — 400, o'zbekcha matn", async () => {
      const h = buildTopupHarness({ enabled: false });
      await expect(
        h.service.create('user-1', '', { amount: 100000, provider: 'click' }),
      ).rejects.toThrow(/yoqilmagan/);
    });

    it('chegaradan tashqari summa — 400', async () => {
      const h = buildTopupHarness();
      await expect(h.service.create('user-1', '', { amount: 5000, provider: 'payme' })).rejects.toThrow(
        /10 000 so'mdan 2 000 000 so'mgacha/,
      );
      await expect(
        h.service.create('user-1', '', { amount: 2_000_001, provider: 'payme' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("qaytish manzili: WALLET_TOPUP_RETURN_URL dagi {id} to'ldirish id'si bilan", async () => {
      const h = buildTopupHarness({ returnUrl: 'angrengo://wallet/topup/{id}' });
      await h.service.create('user-1', '+998901234567', { amount: 100000, provider: 'click' });
      expect(h.click.initiate).toHaveBeenCalledWith(100000, `topup_${TOPUP_ID}`, '+998901234567', {
        returnUrl: `angrengo://wallet/topup/${TOPUP_ID}`,
      });
    });

    it('mashina o\'qiydigan kodlar (WALLET_TOPUP_*)', async () => {
      const codeOf = (p: Promise<unknown>) =>
        p.then(
          () => null,
          (e: { getResponse(): Record<string, unknown> }) => e.getResponse(),
        );
      expect(
        await codeOf(buildTopupHarness({ enabled: false }).service.create('user-1', '', { amount: 100000, provider: 'click' })),
      ).toEqual(expect.objectContaining({ code: 'WALLET_TOPUP_DISABLED' }));
      expect(
        await codeOf(buildTopupHarness().service.create('user-1', '', { amount: 5000, provider: 'payme' })),
      ).toEqual(
        expect.objectContaining({ code: 'WALLET_TOPUP_AMOUNT_OUT_OF_RANGE', details: { min: 10000, max: 2000000 } }),
      );
      expect(
        await codeOf(
          buildTopupHarness({ configured: false }).service.create('user-1', '', { amount: 50000, provider: 'payme' }),
        ),
      ).toEqual(expect.objectContaining({ code: 'WALLET_TOPUP_PROVIDER_UNAVAILABLE' }));
    });

    it('provayder kalitlari ulanmagan — 400', async () => {
      const h = buildTopupHarness({ configured: false });
      await expect(h.service.create('user-1', '', { amount: 50000, provider: 'payme' })).rejects.toThrow(
        /ulanmagan/,
      );
    });

    it("GET: faqat o'ziniki", async () => {
      const h = buildTopupHarness();
      await h.service.create('user-1', '', { amount: 50000, provider: 'payme' });
      await expect(h.service.getForUser('user-1', TOPUP_ID)).resolves.toEqual(
        expect.objectContaining({ id: TOPUP_ID, status: 'pending' }),
      );
      await expect(h.service.getForUser('user-2', TOPUP_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('markPaid / cancel', () => {
    it("to'langanda bir marta kirim, push va wallet:updated; takrorida hech narsa yozilmaydi", async () => {
      const h = buildTopupHarness();
      await h.service.create('user-1', '', { amount: 50000, provider: 'click' });

      const first = await h.service.markPaid(TOPUP_ID, { amount: 50000, externalId: 'click_1' });
      expect(first.kind).toBe('paid');
      expect(h.ledger).toEqual([
        expect.objectContaining({
          userId: 'user-1',
          amount: 50000,
          type: TransactionType.CREDIT,
          status: TransactionStatus.COMPLETED,
          externalId: `wallet_topup_${TOPUP_ID}`,
        }),
      ]);
      expect(h.notifier.balanceChanged).toHaveBeenCalledWith('user-1', {
        delta: 50000,
        reason: 'topup',
        push: expect.objectContaining({ body: "Hamyoningiz 50 000 so'mga to'ldirildi" }),
        extra: { topupId: TOPUP_ID },
      });

      const replay = await h.service.markPaid(TOPUP_ID, { amount: 50000, externalId: 'click_1' });
      expect(replay.kind).toBe('already_paid');
      expect(h.ledger).toHaveLength(1);
      expect(h.notifier.balanceChanged).toHaveBeenCalledTimes(1);
    });

    it('summa mos kelmasa — kirim yo\'q', async () => {
      const h = buildTopupHarness();
      await h.service.create('user-1', '', { amount: 50000, provider: 'payme' });
      expect((await h.service.markPaid(TOPUP_ID, { amount: 100 })).kind).toBe('amount_mismatch');
      expect(h.ledger).toHaveLength(0);
      expect(h.topups.get(TOPUP_ID)?.status).toBe(WalletTopupStatus.PENDING);
    });

    it("to'langandan keyin bekor — teskari DEBIT, manfiyga tushsa oflayn", async () => {
      let balance = 50000;
      const h = buildTopupHarness({ ledgerBalance: () => balance });
      await h.service.create('user-1', '', { amount: 50000, provider: 'payme' });
      await h.service.markPaid(TOPUP_ID, { amount: 50000 });
      balance = -20000; // haydovchi pulni allaqachon sarflagan
      const outcome = await h.service.cancel(TOPUP_ID);
      expect(outcome).toEqual(expect.objectContaining({ kind: 'cancelled', reversed: true }));
      expect(h.ledger[1]).toEqual(
        expect.objectContaining({ type: TransactionType.DEBIT, amount: 50000, externalId: `wallet_topup_reversal_${TOPUP_ID}` }),
      );
      expect(h.driversService.takeOfflineInRedis).toHaveBeenCalledWith('driver-1', expect.any(String));
      expect(h.notifier.balanceChanged).toHaveBeenLastCalledWith(
        'user-1',
        expect.objectContaining({ delta: -50000, reason: 'topup_reversal' }),
      );
      // Takror — hech narsa.
      expect((await h.service.cancel(TOPUP_ID)).kind).toBe('already_cancelled');
      expect(h.ledger).toHaveLength(2);
    });

    it("to'lanmagan to'ldirishni bekor qilish daftarga tegmaydi", async () => {
      const h = buildTopupHarness();
      await h.service.create('user-1', '', { amount: 50000, provider: 'payme' });
      expect(await h.service.cancel(TOPUP_ID, WalletTopupStatus.FAILED)).toEqual(
        expect.objectContaining({ kind: 'cancelled', reversed: false }),
      );
      expect(h.topups.get(TOPUP_ID)?.status).toBe(WalletTopupStatus.FAILED);
      expect(h.ledger).toHaveLength(0);
      // Bekor qilingandan keyin to'lov qabul qilinmaydi.
      expect((await h.service.markPaid(TOPUP_ID, { amount: 50000 })).kind).toBe('invalid_state');
    });

    it("12 soatdan eski pending'lar expired bo'ladi", async () => {
      const h = buildTopupHarness();
      await h.service.create('user-1', '', { amount: 50000, provider: 'payme' });
      const later = new Date(Date.now() + WALLET_TOPUP_TTL_MS + 1000);
      expect(await h.service.expireStale(later)).toBe(1);
      expect(h.topups.get(TOPUP_ID)?.status).toBe(WalletTopupStatus.EXPIRED);
    });
  });
});

describe('Hamyonni to\'ldirish callback\'lari', () => {
  const ref = `topup_${TOPUP_ID}`;

  // Payme / Click endi buyurtma to'lovi bilan UMUMIY protokol kodidan o'tadi
  // (`merchant/`). Bu yerda — haqiqiy `WalletTopupsService` pul qoidalari
  // bilan uchma-uch: kirim bir marta, refund teskari DEBIT, Click xatosi —
  // `failed`.
  function protocols(h: ReturnType<typeof buildTopupHarness>) {
    const merchantRepo = new FakeMerchantRepo();
    h.useMerchantRepo(merchantRepo);
    const targets = new PaymentTargetsService({} as never, h.service);
    const payme = new PaymeMerchantService(
      merchantRepo as never,
      targets,
      { verifyCallbackSignature: () => true } as never,
      h.dataSource as never,
    );
    const click = new ClickShopService(
      merchantRepo as never,
      targets,
      { verifyCallbackSignature: () => true } as never,
      h.dataSource as never,
    );
    const rpc = (method: string, params: Record<string, unknown>) =>
      payme.handle({ jsonrpc: '2.0', id: 1, method, params }, 'Basic ok');
    return { payme, click, rpc, merchantRepo };
  }

  describe('Payme Merchant API (umumiy protokol)', () => {
    it('Check → Create → Perform (takror) → CheckTransaction → Cancel (refund)', async () => {
      const h = buildTopupHarness();
      const p = protocols(h);
      await h.service.create('user-1', '', { amount: 50000, provider: 'payme' });
      const account = { order_id: ref };

      expect(await p.rpc('CheckPerformTransaction', { amount: 5_000_000, account })).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: { allow: true },
      });
      const created = await p.rpc('CreateTransaction', { id: 'payme-tx-1', time: Date.now(), amount: 5_000_000, account });
      expect(created).toMatchObject({ result: { state: 1 } });

      expect(await p.rpc('PerformTransaction', { id: 'payme-tx-1' })).toMatchObject({ result: { state: 2 } });
      expect(h.ledger).toHaveLength(1);
      expect(h.topups.get(TOPUP_ID)).toMatchObject({ status: WalletTopupStatus.PAID, externalId: 'payme_payme-tx-1' });

      expect(await p.rpc('PerformTransaction', { id: 'payme-tx-1' })).toMatchObject({ result: { state: 2 } });
      expect(h.ledger).toHaveLength(1);

      expect(await p.rpc('CheckTransaction', { id: 'payme-tx-1' })).toMatchObject({ result: { state: 2, reason: null } });

      expect(await p.rpc('CancelTransaction', { id: 'payme-tx-1', reason: 5 })).toMatchObject({ result: { state: -2 } });
      expect(h.ledger).toHaveLength(2);
      expect(h.ledger[1]).toMatchObject({ type: TransactionType.DEBIT, externalId: `wallet_topup_reversal_${TOPUP_ID}` });
    });

    it("Create: summa mos emas — −31001; boshqa faol tranzaksiya — −31052", async () => {
      const h = buildTopupHarness();
      const p = protocols(h);
      await h.service.create('user-1', '', { amount: 50000, provider: 'payme' });
      const account = { order_id: ref };
      expect(await p.rpc('CreateTransaction', { id: 'a', time: Date.now(), amount: 100, account })).toMatchObject({
        error: { code: -31001 },
      });
      await p.rpc('CreateTransaction', { id: 'a', time: Date.now(), amount: 5_000_000, account });
      expect(await p.rpc('CreateTransaction', { id: 'b', time: Date.now(), amount: 5_000_000, account })).toMatchObject({
        error: { code: -31052, data: 'order_id' },
      });
    });

    it("to'lanmagan tranzaksiyani bekor qilish — to'ldirish cancelled, daftarga tegmaydi", async () => {
      const h = buildTopupHarness();
      const p = protocols(h);
      await h.service.create('user-1', '', { amount: 50000, provider: 'payme' });
      await p.rpc('CreateTransaction', { id: 'a', time: Date.now(), amount: 5_000_000, account: { order_id: ref } });
      expect(await p.rpc('CancelTransaction', { id: 'a', reason: 3 })).toMatchObject({ result: { state: -1 } });
      expect(h.topups.get(TOPUP_ID)?.status).toBe(WalletTopupStatus.CANCELLED);
      expect(h.ledger).toHaveLength(0);
    });

    it("noma'lum topup_ havolasi — −31050", async () => {
      const h = buildTopupHarness();
      const p = protocols(h);
      const account = { order_id: `topup_${'0'.repeat(8)}-0000-0000-0000-000000000000` };
      expect(await p.rpc('CheckPerformTransaction', { amount: 100, account })).toMatchObject({
        error: { code: -31050, data: 'order_id' },
      });
    });
  });

  describe('Click SHOP API (umumiy protokol)', () => {
    const base = { click_trans_id: '777', service_id: '1', merchant_trans_id: ref, amount: '50000.00', sign_time: 't', sign_string: 's', error: '0' };

    it('prepare → complete: bir marta kirim; takror complete — −4', async () => {
      const h = buildTopupHarness();
      const p = protocols(h);
      await h.service.create('user-1', '', { amount: 50000, provider: 'click' });

      const prepared = await p.click.handle({ ...base, action: '0' });
      expect(prepared).toEqual(expect.objectContaining({ error: 0, merchant_prepare_id: 101 }));

      const completed = await p.click.handle({ ...base, action: '1', merchant_prepare_id: '101' });
      expect(completed).toEqual(expect.objectContaining({ error: 0, merchant_confirm_id: 101 }));
      expect(h.ledger).toHaveLength(1);

      const replay = await p.click.handle({ ...base, action: '1', merchant_prepare_id: '101' });
      expect(replay.error).toBe(-4);
      expect(h.ledger).toHaveLength(1);
    });

    it("complete'da Click xatosi (error < 0) — failed, kirim yo'q", async () => {
      const h = buildTopupHarness();
      const p = protocols(h);
      await h.service.create('user-1', '', { amount: 50000, provider: 'click' });
      await p.click.handle({ ...base, action: '0' });
      const res = await p.click.handle({ ...base, action: '1', merchant_prepare_id: '101', error: '-5017' });
      expect(res.error).toBe(-9);
      expect(h.topups.get(TOPUP_ID)?.status).toBe(WalletTopupStatus.FAILED);
      expect(h.ledger).toHaveLength(0);
    });

    it("noto'g'ri summa — −2; noma'lum havola — −5; noto'g'ri prepare_id — −6", async () => {
      const h = buildTopupHarness();
      const p = protocols(h);
      await h.service.create('user-1', '', { amount: 50000, provider: 'click' });
      expect((await p.click.handle({ ...base, amount: '1', action: '0' })).error).toBe(-2);
      expect((await p.click.handle({ ...base, merchant_trans_id: 'topup_x', action: '0' })).error).toBe(-5);
      expect((await p.click.handle({ ...base, action: '1', merchant_prepare_id: '9' })).error).toBe(-6);
    });
  });

  describe('UZPS', () => {
    it('PAID → kirim (tiyin), takror — OK, kirim bitta', async () => {
      const h = buildTopupHarness();
      await h.service.create('user-1', '', { amount: 50000, provider: 'uzcard' });
      const body = { order_id: ref, status: 'PAID', amount: 5_000_000, transaction_id: `uzcard_${ref}` };
      expect(await h.callbacks.handleUzcard(body)).toEqual({ success: true, message: 'OK' });
      expect(await h.callbacks.handleUzcard(body)).toEqual({ success: true, message: 'OK' });
      expect(h.ledger).toHaveLength(1);
    });
  });
});
