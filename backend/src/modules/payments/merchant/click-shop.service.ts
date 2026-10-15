import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, LessThan, Repository } from 'typeorm';
import {
  MERCHANT_TX_STATE,
  MerchantTransaction,
} from '../../../database/entities/merchant-transaction.entity';
import { ClickProvider } from '../click.provider';
import { PaymentTargetsService } from './payment-targets.service';
import { MoneyContext, newMoneyContext, runAfterCommit } from '../money-context';
import { sameSomAmount } from '../tiyin';

/** Prepare'dan keyin Complete kutiladigan standart vaqt (daqiqa). */
const DEFAULT_PREPARE_TTL_MINUTES = 60;

/** Click SHOP API action kodlari. */
export const CLICK_ACTION = { prepare: 0, complete: 1 } as const;

/** Click SHOP API xato kodlari (docs.click.uz → SHOP API → Ошибки). */
export const CLICK_ERRORS = {
  success: { error: 0, error_note: 'Success' },
  signFailed: { error: -1, error_note: 'SIGN CHECK FAILED!' },
  incorrectAmount: { error: -2, error_note: 'Incorrect parameter amount' },
  actionNotFound: { error: -3, error_note: 'Action not found' },
  alreadyPaid: { error: -4, error_note: 'Already paid' },
  userNotFound: { error: -5, error_note: 'User does not exist' },
  transactionNotFound: { error: -6, error_note: 'Transaction does not exist' },
  updateFailed: { error: -7, error_note: 'Failed to update user' },
  badRequest: { error: -8, error_note: 'Error in request from click' },
  cancelled: { error: -9, error_note: 'Transaction cancelled' },
} as const;

type ClickError = (typeof CLICK_ERRORS)[keyof typeof CLICK_ERRORS];

/**
 * Click SHOP API javobi. Prepare: `merchant_prepare_id`; Complete:
 * `merchant_confirm_id`. Xom (`@RawResponse()`), HTTP 200.
 */
export interface ClickShopResponse {
  click_trans_id: string;
  merchant_trans_id: string;
  merchant_prepare_id?: number;
  merchant_confirm_id?: number;
  error: number;
  error_note: string;
}

const REQUIRED_FIELDS = [
  'click_trans_id',
  'service_id',
  'merchant_trans_id',
  'amount',
  'action',
  'sign_time',
  'sign_string',
] as const;

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/**
 * Click SHOP API — buyurtma to'lovi va hamyonni to'ldirish uchun YAGONA
 * implementatsiya (`merchant_trans_id`: buyurtma UUID'i yoki `topup_<id>`).
 *
 *  · action 0 = Prepare → `merchant_transactions` (state 1),
 *    `merchant_prepare_id = seq`.
 *  · action 1 = Complete → `merchant_prepare_id` tekshiriladi; Click `error < 0`
 *    yuborsa — bekor (−9); aks holda nishonga pul (bir martalik).
 *  · Imzo: md5(click_trans_id + service_id + SECRET + merchant_trans_id +
 *    [merchant_prepare_id — faqat Complete] + amount + action + sign_time)
 *    (`ClickProvider.verifyCallbackSignature`).
 *  · Summa so'mda ("25000.00"). Hech qachon `throw` qilmaydi (ichki xato → −7).
 */
@Injectable()
export class ClickShopService {
  private readonly logger = new Logger(ClickShopService.name);

  constructor(
    @InjectRepository(MerchantTransaction)
    private readonly repo: Repository<MerchantTransaction>,
    private readonly targets: PaymentTargetsService,
    private readonly provider: ClickProvider,
    private readonly dataSource: DataSource,
    // `CLICK_PREPARE_TTL_MINUTES` (standart 60) — tozalash cron'i uchun.
    @Optional() private readonly config?: ConfigService,
  ) {}

  /**
   * Prepare'dan keyin `CLICK_PREPARE_TTL_MINUTES` ichida Complete kelmagan
   * Click tranzaksiyalari → `state = −1` (bekor), `cancel_time`. Pulga ta'siri
   * YO'Q va nishonga tegilmaydi (to'ldirish o'z 12 soatlik muddati bilan
   * yopiladi, buyurtma qayta to'lanadi). Kech kelgan Complete — −9.
   */
  async expireStalePrepares(now: Date = new Date()): Promise<number> {
    const ttlMinutes = Number(this.config?.get<number>('CLICK_PREPARE_TTL_MINUTES', DEFAULT_PREPARE_TTL_MINUTES));
    const ttl = Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : DEFAULT_PREPARE_TTL_MINUTES;
    const result = await this.repo.update(
      {
        provider: 'click',
        state: MERCHANT_TX_STATE.created,
        createTime: LessThan(new Date(now.getTime() - ttl * 60 * 1000)),
      },
      { state: MERCHANT_TX_STATE.cancelled, cancelTime: now },
    );
    return result.affected ?? 0;
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'click-prepare-cleanup' })
  async handlePrepareCleanupTick(): Promise<void> {
    try {
      const expired = await this.expireStalePrepares();
      if (expired > 0) this.logger.log(`${expired} ta Complete'siz Click Prepare bekor qilindi`);
    } catch (err) {
      this.logger.error(`Click prepare cleanup failed: ${(err as Error).message}`);
    }
  }

  async handle(body: Record<string, unknown>): Promise<ClickShopResponse> {
    const echo = {
      click_trans_id: text(body['click_trans_id']),
      merchant_trans_id: text(body['merchant_trans_id']),
    };
    const reply = (error: ClickError, extra: Partial<ClickShopResponse> = {}): ClickShopResponse => ({
      ...echo,
      ...extra,
      error: error.error,
      error_note: error.error_note,
    });

    const action = Number(body['action']);
    if (
      REQUIRED_FIELDS.some((field) => text(body[field]) === '') ||
      (action === CLICK_ACTION.complete && text(body['merchant_prepare_id']) === '')
    ) {
      return reply(CLICK_ERRORS.badRequest);
    }
    if (!this.provider.verifyCallbackSignature(body)) {
      this.logger.warn(`Click callback rejected: bad signature (click_trans_id=${echo.click_trans_id})`);
      return reply(CLICK_ERRORS.signFailed);
    }
    if (action !== CLICK_ACTION.prepare && action !== CLICK_ACTION.complete) {
      return reply(CLICK_ERRORS.actionNotFound);
    }

    try {
      return action === CLICK_ACTION.prepare
        ? await this.prepare(body, echo.click_trans_id, reply)
        : await this.complete(body, echo.click_trans_id, reply);
    } catch (err) {
      this.logger.error(`Click action ${action} failed: ${(err as Error).message}`, (err as Error).stack);
      return reply(CLICK_ERRORS.updateFailed);
    }
  }

  private async prepare(
    body: Record<string, unknown>,
    clickTransId: string,
    reply: (error: ClickError, extra?: Partial<ClickShopResponse>) => ClickShopResponse,
  ): Promise<ClickShopResponse> {
    // To'ldirish faqat o'z provayderi orqali (#1): boshqasiga — `closed` (−9).
    const target = await this.targets.load(body['merchant_trans_id'], 'click');
    if (!target) return reply(CLICK_ERRORS.userNotFound);

    const existing = await this.findTx(clickTransId);
    if (existing) {
      if (existing.targetRef !== target.ref) return reply(CLICK_ERRORS.transactionNotFound);
      if (existing.state === MERCHANT_TX_STATE.performed) return reply(CLICK_ERRORS.alreadyPaid);
      if (existing.state !== MERCHANT_TX_STATE.created) return reply(CLICK_ERRORS.cancelled);
      return reply(CLICK_ERRORS.success, { merchant_prepare_id: Number(existing.seq) });
    }

    if (target.status === 'paid') return reply(CLICK_ERRORS.alreadyPaid);
    if (target.status !== 'payable') return reply(CLICK_ERRORS.cancelled);
    if (!sameSomAmount(body['amount'], target.amount)) return reply(CLICK_ERRORS.incorrectAmount);

    // Birinchi Prepare to'ldirishni o'ziga bog'laydi (#1); boshqa
    // click_trans_id bilan ikkinchi to'lov urinishi — −9.
    const bound = await this.targets.bind(target, 'click', `click_${clickTransId}`);
    if (bound !== 'bound') return reply(CLICK_ERRORS.cancelled);

    const saved = await this.repo.save({
      provider: 'click',
      externalId: clickTransId,
      targetKind: target.kind,
      targetRef: target.ref,
      amount: target.amount,
      state: MERCHANT_TX_STATE.created,
      providerTime: null,
      account: null,
      createTime: new Date(),
    });
    this.logger.log(`Click prepare ${clickTransId} for ${target.kind} ${target.ref} → ${saved.seq}`);
    return reply(CLICK_ERRORS.success, { merchant_prepare_id: Number(saved.seq) });
  }

  /**
   * Holat da'vosi va pul effekti BITTA tranzaksiyada, merchant qatori
   * `FOR UPDATE` qulfi ostida (#8). Click `error < 0` faqat mos (havola,
   * prepare_id, summa) tayyorlangan tranzaksiyani bekor qiladi (#11):
   * `error` maydoni imzoga kirmaydi.
   */
  private async complete(
    body: Record<string, unknown>,
    clickTransId: string,
    reply: (error: ClickError, extra?: Partial<ClickShopResponse>) => ClickShopResponse,
  ): Promise<ClickShopResponse> {
    let ctx: MoneyContext | null = null;
    const response = await this.dataSource.transaction(async (manager: EntityManager) => {
      ctx = newMoneyContext(manager);
      const repo = manager.getRepository(MerchantTransaction);
      const tx = await repo.findOne({
        where: { provider: 'click', externalId: clickTransId },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !tx ||
        String(tx.seq) !== text(body['merchant_prepare_id']) ||
        tx.targetRef !== text(body['merchant_trans_id'])
      ) {
        return reply(CLICK_ERRORS.transactionNotFound);
      }
      const confirm = { merchant_confirm_id: Number(tx.seq) };
      const ref = { kind: tx.targetKind, ref: tx.targetRef };

      if (tx.state === MERCHANT_TX_STATE.performed) return reply(CLICK_ERRORS.alreadyPaid, confirm);
      if (tx.state !== MERCHANT_TX_STATE.created) return reply(CLICK_ERRORS.cancelled, confirm);
      if (!sameSomAmount(body['amount'], Number(tx.amount))) return reply(CLICK_ERRORS.incorrectAmount);

      // Click o'z tomonidagi xatoni (`error < 0`, masalan mablag' yetmadi) shu
      // yerda bildiradi — to'lov bo'lmadi.
      if (Number(body['error'] ?? 0) < 0) {
        await repo.update(
          { id: tx.id, state: MERCHANT_TX_STATE.created },
          { state: MERCHANT_TX_STATE.cancelled, cancelTime: new Date() },
        );
        await this.targets.release(ref, true, ctx);
        return reply(CLICK_ERRORS.cancelled, confirm);
      }

      const amount = Number(tx.amount);
      const outcome = await this.targets.markPaid(
        ref,
        { amount, externalId: `click_${clickTransId}`, provider: 'click' },
        ctx,
      );
      switch (outcome) {
        case 'paid':
        case 'already_paid':
          await repo.update(
            { id: tx.id, state: MERCHANT_TX_STATE.created },
            { state: MERCHANT_TX_STATE.performed, performTime: new Date() },
          );
          this.logger.log(`Click complete ${clickTransId}: ${tx.targetKind} ${tx.targetRef} paid`);
          return reply(CLICK_ERRORS.success, confirm);
        case 'amount_mismatch':
          return reply(CLICK_ERRORS.incorrectAmount);
        case 'not_found':
          return reply(CLICK_ERRORS.userNotFound);
        default: {
          // Nishon boshqa yo'l bilan to'langan yoki yopilgan.
          const target = await this.targets.load(tx.targetRef);
          return reply(target?.status === 'paid' ? CLICK_ERRORS.alreadyPaid : CLICK_ERRORS.cancelled, confirm);
        }
      }
    });
    await runAfterCommit(ctx, (err) => this.logger.error(`Click complete side effect failed: ${err.message}`));
    return response;
  }

  private findTx(clickTransId: string): Promise<MerchantTransaction | null> {
    return this.repo.findOne({ where: { provider: 'click', externalId: clickTransId } });
  }
}
