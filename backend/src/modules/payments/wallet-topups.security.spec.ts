import { ConflictException } from '@nestjs/common';
import { WalletTopupStatus } from '../../database/entities/wallet-topup.entity';
import { buildTopupHarness } from './wallet-topups.test-kit';
import { PaymentTargetsService } from './merchant/payment-targets.service';
import { PaymeMerchantService } from './merchant/payme-merchant.service';
import { ClickShopService } from './merchant/click-shop.service';
import { FakeMerchantRepo } from './merchant/merchant-test-kit';

/**
 * Hamyonni to'ldirish — xavfsizlik regressiyalari (security review 2026-10-15):
 *  #1  bitta to'ldirish ikki provayderdan ikki marta yechilmasin: provayderga va
 *      birinchi faol tranzaksiyaga bog'lanadi; PAID + boshqa externalId → rad.
 *  #7  UZPS: `status` imzoda yo'q — PAID dan oldin provayder status API'si,
 *      saqlangan tranzaksiya id'si mos bo'lishi shart.
 *  #10 summalar butun tiyinda.
 *  #13 bir foydalanuvchida ko'pi bilan 3 ta ochiq (pending) to'ldirish.
 */
const uzTx = (topupId: string): string => `uzcard_topup_${topupId}`;

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

const clickBase = (ref: string) => ({
  click_trans_id: '777',
  service_id: '1',
  merchant_trans_id: ref,
  amount: '50000.00',
  sign_time: 't',
  sign_string: 's',
  error: '0',
});

describe('Hamyonni to\'ldirish — xavfsizlik', () => {
  describe('#1 provayderga va birinchi tranzaksiyaga bog\'lash', () => {
    it("Click to'ldirishini Payme orqali to'lab bo'lmaydi (−31051)", async () => {
      const h = buildTopupHarness();
      const p = protocols(h);
      const created = await h.service.create('user-1', '', { amount: 50000, provider: 'click' });
      const account = { order_id: `topup_${created.topupId}` };
      expect(await p.rpc('CheckPerformTransaction', { amount: 5_000_000, account })).toMatchObject({
        error: { code: -31051 },
      });
      expect(
        await p.rpc('CreateTransaction', { id: 'pm-1', time: Date.now(), amount: 5_000_000, account }),
      ).toMatchObject({ error: { code: -31051 } });
      expect(p.merchantRepo.rows).toHaveLength(0);
    });

    it("Payme to'ldirishini Click orqali tayyorlab bo'lmaydi", async () => {
      const h = buildTopupHarness();
      const p = protocols(h);
      const created = await h.service.create('user-1', '', { amount: 50000, provider: 'payme' });
      const res = await p.click.handle({ ...clickBase(`topup_${created.topupId}`), action: '0' });
      expect(res.error).not.toBe(0);
      expect(p.merchantRepo.rows).toHaveLength(0);
    });

    it("Payme CreateTransaction to'ldirishni tranzaksiyaga bog'laydi", async () => {
      const h = buildTopupHarness();
      const p = protocols(h);
      const created = await h.service.create('user-1', '', { amount: 50000, provider: 'payme' });
      await p.rpc('CreateTransaction', {
        id: 'pm-1',
        time: Date.now(),
        amount: 5_000_000,
        account: { order_id: `topup_${created.topupId}` },
      });
      expect(h.topups.get(created.topupId)?.externalId).toBe('payme_pm-1');
    });

    it("Click Prepare bog'laydi; boshqa click_trans_id bilan ikkinchi Prepare rad etiladi", async () => {
      const h = buildTopupHarness();
      const p = protocols(h);
      const created = await h.service.create('user-1', '', { amount: 50000, provider: 'click' });
      const ref = `topup_${created.topupId}`;
      expect((await p.click.handle({ ...clickBase(ref), action: '0' })).error).toBe(0);
      expect(h.topups.get(created.topupId)?.externalId).toBe('click_777');
      const second = await p.click.handle({ ...clickBase(ref), click_trans_id: '778', action: '0' });
      expect(second.error).toBe(-9);
    });

    it("PAID + boshqa externalId → invalid_state (ikkinchi yechim qabul qilinmaydi)", async () => {
      const h = buildTopupHarness();
      const created = await h.service.create('user-1', '', { amount: 50000, provider: 'payme' });
      expect((await h.service.markPaid(created.topupId, { amount: 50000, externalId: 'payme_a' })).kind).toBe('paid');
      expect((await h.service.markPaid(created.topupId, { amount: 50000, externalId: 'payme_b' })).kind).toBe(
        'invalid_state',
      );
      expect((await h.service.markPaid(created.topupId, { amount: 50000, externalId: 'payme_a' })).kind).toBe(
        'already_paid',
      );
      expect(h.ledger).toHaveLength(1);
    });

    it('markPaid boshqa provayderdan — invalid_state', async () => {
      const h = buildTopupHarness();
      const created = await h.service.create('user-1', '', { amount: 50000, provider: 'click' });
      const outcome = await h.service.markPaid(created.topupId, {
        amount: 50000,
        externalId: 'payme_x',
        provider: 'payme',
      });
      expect(outcome.kind).toBe('invalid_state');
      expect(h.ledger).toHaveLength(0);
    });
  });

  describe('#10 butun tiyin', () => {
    it("so'mda 0.004 farq ham mos emas", async () => {
      const h = buildTopupHarness();
      const created = await h.service.create('user-1', '', { amount: 50000, provider: 'payme' });
      expect((await h.service.markPaid(created.topupId, { amount: 50000.004 })).kind).toBe('amount_mismatch');
    });

    it('UZPS kasr tiyin — AMOUNT_MISMATCH', async () => {
      const h = buildTopupHarness();
      const created = await h.service.create('user-1', '', { amount: 50000, provider: 'uzcard' });
      const res = await h.callbacks.handleUzcard({
        order_id: `topup_${created.topupId}`,
        status: 'PAID',
        amount: 5_000_000.4,
        transaction_id: uzTx(created.topupId),
      });
      expect(res).toEqual({ success: false, message: 'AMOUNT_MISMATCH' });
      expect(h.ledger).toHaveLength(0);
    });
  });

  describe('#7 UZPS status imzoda yo\'q', () => {
    const paid = (topupId: string, transactionId: string | undefined) => ({
      order_id: `topup_${topupId}`,
      status: 'PAID',
      amount: 5_000_000,
      transaction_id: transactionId,
    });

    it("provayder status API'si PAID demasa — kirim yo'q", async () => {
      const h = buildTopupHarness();
      const created = await h.service.create('user-1', '', { amount: 50000, provider: 'uzcard' });
      h.uzcard.fetchStatus.mockResolvedValueOnce('PENDING');
      expect(await h.callbacks.handleUzcard(paid(created.topupId, uzTx(created.topupId)))).toEqual({
        success: false,
        message: 'NOT_CONFIRMED',
      });
      expect(h.ledger).toHaveLength(0);
      expect(h.uzcard.fetchStatus).toHaveBeenCalledWith(uzTx(created.topupId));
    });

    it("saqlangan tranzaksiya id'si mos kelmasa — INVALID_STATE", async () => {
      const h = buildTopupHarness();
      const created = await h.service.create('user-1', '', { amount: 50000, provider: 'uzcard' });
      expect(await h.callbacks.handleUzcard(paid(created.topupId, 'someone-else'))).toEqual({
        success: false,
        message: 'INVALID_STATE',
      });
      expect(h.ledger).toHaveLength(0);
    });

    it("transaction_id yo'q — rad", async () => {
      const h = buildTopupHarness();
      const created = await h.service.create('user-1', '', { amount: 50000, provider: 'uzcard' });
      const res = await h.callbacks.handleUzcard(paid(created.topupId, undefined));
      expect(res.success).toBe(false);
      expect(h.ledger).toHaveLength(0);
    });

    it("CANCELLED dan keyin PAID — kirim yo'q", async () => {
      const h = buildTopupHarness();
      const created = await h.service.create('user-1', '', { amount: 50000, provider: 'uzcard' });
      const ref = `topup_${created.topupId}`;
      await h.callbacks.handleUzcard({ order_id: ref, status: 'CANCELLED', transaction_id: uzTx(created.topupId) });
      const res = await h.callbacks.handleUzcard(paid(created.topupId, uzTx(created.topupId)));
      expect(res).toEqual({ success: false, message: 'INVALID_STATE' });
      expect(h.ledger).toHaveLength(0);
    });

    it("to'langan to'ldirishga soxta CANCELLED — provayder hali PAID desa teskari yozilmaydi", async () => {
      const h = buildTopupHarness();
      const created = await h.service.create('user-1', '', { amount: 50000, provider: 'uzcard' });
      await h.callbacks.handleUzcard(paid(created.topupId, uzTx(created.topupId)));
      expect(h.ledger).toHaveLength(1);
      const res = await h.callbacks.handleUzcard({
        order_id: `topup_${created.topupId}`,
        status: 'CANCELLED',
        transaction_id: uzTx(created.topupId),
      });
      expect(res.success).toBe(false);
      expect(h.ledger).toHaveLength(1);
      expect(h.topups.get(created.topupId)?.status).toBe(WalletTopupStatus.PAID);
    });
  });

  describe('#13 ochiq to\'ldirishlar chegarasi', () => {
    it('bir xil summa+provayder — mavjud pending qayta ishlatiladi', async () => {
      const h = buildTopupHarness();
      const first = await h.service.create('user-1', '', { amount: 50000, provider: 'payme' });
      const again = await h.service.create('user-1', '', { amount: 50000, provider: 'payme' });
      expect(again.topupId).toBe(first.topupId);
      expect(h.topups.size).toBe(1);
    });

    it('4-chi ochiq to\'ldirish — 409 WALLET_TOPUP_TOO_MANY_PENDING', async () => {
      const h = buildTopupHarness();
      await h.service.create('user-1', '', { amount: 50000, provider: 'payme' });
      await h.service.create('user-1', '', { amount: 60000, provider: 'payme' });
      await h.service.create('user-1', '', { amount: 70000, provider: 'click' });
      const err = await h.service.create('user-1', '', { amount: 80000, provider: 'payme' }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toMatchObject({ code: 'WALLET_TOPUP_TOO_MANY_PENDING' });
      expect(h.topups.size).toBe(3);
      // Boshqa foydalanuvchiga ta'sir qilmaydi.
      await expect(h.service.create('user-2', '', { amount: 80000, provider: 'payme' })).resolves.toBeDefined();
    });
  });
});
