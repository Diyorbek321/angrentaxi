import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, Repository } from 'typeorm';
import {
  MERCHANT_TX_STATE,
  MerchantTransaction,
} from '../../../database/entities/merchant-transaction.entity';
import { PaymeProvider } from '../payme.provider';
import { PaymentTarget, PaymentTargetsService } from './payment-targets.service';
import { MoneyContext, newMoneyContext, runAfterCommit } from '../money-context';
import { somToTiyin, strictTiyin } from '../tiyin';
import {
  PAYME_ACCOUNT_FIELD,
  PAYME_ERRORS,
  PAYME_REASON,
  PAYME_TIMEOUT_MS,
  PaymeRpcResponse,
  paymeError,
  paymeRequestId,
  paymeResult,
} from './payme-rpc';

const PG_UNIQUE_VIOLATION = '23505';

type Params = Record<string, unknown>;

/** Ichki nazorat oqimi: protokol xatosini qaytarish uchun. */
class PaymeFault extends Error {
  constructor(
    readonly error: (typeof PAYME_ERRORS)[keyof typeof PAYME_ERRORS],
    readonly data?: string,
  ) {
    super(`Payme ${error.code}`);
  }
}

const ms = (value: Date | null | undefined): number => (value ? new Date(value).getTime() : 0);

function isObject(value: unknown): value is Params {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Payme Merchant API (developer.help.paycom.uz) — buyurtma to'lovi va
 * hamyonni to'ldirish uchun YAGONA implementatsiya.
 *
 *  · Javob — xom JSON-RPC 2.0 (`@RawResponse()`), HTTP 200; hech qachon
 *    `throw` qilmaydi (ichki xato → −32400).
 *  · Basic auth `Paycom:<kalit>` (−32504).
 *  · Summalar tiyinda (×100). `account.order_id` — buyurtma UUID'i yoki
 *    `topup_<id>`.
 *  · Tranzaksiya holati `merchant_transactions` da; pul qoidalari nishon
 *    servisida (`PaymentTargetsService`).
 */
@Injectable()
export class PaymeMerchantService {
  private readonly logger = new Logger(PaymeMerchantService.name);

  constructor(
    @InjectRepository(MerchantTransaction)
    private readonly repo: Repository<MerchantTransaction>,
    private readonly targets: PaymentTargetsService,
    private readonly provider: PaymeProvider,
    private readonly dataSource: DataSource,
  ) {}

  async handle(body: unknown, authHeader: string | undefined): Promise<PaymeRpcResponse> {
    const id = paymeRequestId(body);
    if (!this.provider.verifyCallbackSignature(isObject(body) ? body : {}, authHeader ?? '')) {
      this.logger.warn('Payme callback rejected: invalid Basic auth');
      return paymeError(id, PAYME_ERRORS.insufficientPrivilege);
    }
    if (!isObject(body) || typeof body['method'] !== 'string' || !isObject(body['params'])) {
      return paymeError(id, PAYME_ERRORS.invalidRequest);
    }
    const method = body['method'];
    const params = body['params'];

    try {
      return paymeResult(id, await this.dispatch(method, params));
    } catch (err) {
      if (err instanceof PaymeFault) return paymeError(id, err.error, err.data);
      this.logger.error(`Payme ${method} failed: ${(err as Error).message}`, (err as Error).stack);
      return paymeError(id, PAYME_ERRORS.system);
    }
  }

  private dispatch(method: string, params: Params): Promise<Record<string, unknown>> {
    switch (method) {
      case 'CheckPerformTransaction':
        return this.checkPerform(params);
      case 'CreateTransaction':
        return this.create(params);
      case 'PerformTransaction':
        return this.perform(params);
      case 'CancelTransaction':
        return this.cancel(params);
      case 'CheckTransaction':
        return this.check(params);
      case 'GetStatement':
        return this.statement(params);
      default:
        throw new PaymeFault(PAYME_ERRORS.methodNotFound, method);
    }
  }

  // ------------------------------------------------------------- metodlar

  private async checkPerform(params: Params): Promise<Record<string, unknown>> {
    await this.validateAccount(params);
    return { allow: true };
  }

  private async create(params: Params): Promise<Record<string, unknown>> {
    const paymeId = this.requireString(params, 'id');
    const time = this.requireNumber(params, 'time');

    const existing = await this.findTx(paymeId);
    if (existing) {
      if (existing.state !== MERCHANT_TX_STATE.created) throw new PaymeFault(PAYME_ERRORS.cannotPerform);
      if (this.expired(existing)) {
        await this.cancelByTimeout(existing);
        throw new PaymeFault(PAYME_ERRORS.cannotPerform);
      }
      return this.createView(existing);
    }

    if (Date.now() - time >= PAYME_TIMEOUT_MS) throw new PaymeFault(PAYME_ERRORS.cannotPerform);
    const target = await this.validateAccount(params);
    // To'ldirish birinchi faol tranzaksiyaga bog'lanadi (#1): boshqa
    // tranzaksiya (yoki boshqa provayder) uni ikkinchi marta to'lay olmaydi.
    const bound = await this.targets.bind(target, 'payme', `payme_${paymeId}`);
    if (bound === 'busy') throw new PaymeFault(PAYME_ERRORS.orderBusy, PAYME_ACCOUNT_FIELD);
    if (bound !== 'bound') throw new PaymeFault(PAYME_ERRORS.orderNotPayable, PAYME_ACCOUNT_FIELD);

    let saved: MerchantTransaction;
    try {
      saved = await this.repo.save({
        provider: 'payme',
        externalId: paymeId,
        targetKind: target.kind,
        targetRef: target.ref,
        amount: target.amount,
        state: MERCHANT_TX_STATE.created,
        providerTime: time,
        account: { [PAYME_ACCOUNT_FIELD]: target.ref },
        createTime: new Date(Date.now()),
      });
    } catch (err) {
      if ((err as { code?: string }).code !== PG_UNIQUE_VIOLATION) throw err;
      // Parallel: shu id bilan yaratilgan bo'lsa — o'sha; aks holda boshqa faol tranzaksiya.
      const winner = await this.findTx(paymeId);
      if (winner?.state === MERCHANT_TX_STATE.created) return this.createView(winner);
      throw new PaymeFault(PAYME_ERRORS.orderBusy, PAYME_ACCOUNT_FIELD);
    }
    this.logger.log(`Payme CreateTransaction ${paymeId} for ${target.kind} ${target.ref}`);
    return this.createView(saved);
  }

  /**
   * Holat da'vosi (`created → performed`) va pul effekti BITTA DB
   * tranzaksiyasida, merchant qatori `FOR UPDATE` qulfi ostida (security
   * review #8): parallel `CancelTransaction` shu qulfni kutadi va izchil
   * holatni ko'radi — "Payme bekor qildi, pul esa hamyonda qoldi" holati yo'q.
   */
  private async perform(params: Params): Promise<Record<string, unknown>> {
    const paymeId = this.requireString(params, 'id');
    let ctx: MoneyContext | null = null;
    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
      ctx = newMoneyContext(manager);
      const repo = manager.getRepository(MerchantTransaction);
      const tx = await this.lockTx(repo, paymeId);
      if (!tx) return { fault: PAYME_ERRORS.transactionNotFound };
      if (tx.state === MERCHANT_TX_STATE.performed) return { view: this.performView(tx) };
      if (tx.state !== MERCHANT_TX_STATE.created) return { fault: PAYME_ERRORS.cannotPerform };
      if (this.expired(tx)) {
        await this.cancelByTimeout(tx, ctx);
        return { fault: PAYME_ERRORS.cannotPerform };
      }

      const outcome = await this.targets.markPaid(
        { kind: tx.targetKind, ref: tx.targetRef },
        { amount: Number(tx.amount), externalId: `payme_${tx.externalId}`, provider: 'payme' },
        ctx,
      );
      if (outcome !== 'paid' && outcome !== 'already_paid') {
        this.logger.warn(`Payme PerformTransaction ${tx.externalId} refused: ${outcome}`);
        return { fault: PAYME_ERRORS.cannotPerform };
      }

      const performTime = new Date(Date.now());
      await repo.update(
        { id: tx.id, state: MERCHANT_TX_STATE.created },
        { state: MERCHANT_TX_STATE.performed, performTime },
      );
      return { view: this.performView({ ...tx, state: MERCHANT_TX_STATE.performed, performTime }) };
    });
    await runAfterCommit(ctx, (err) => this.logger.error(`Payme perform side effect failed: ${err.message}`));
    if ('fault' in result && result.fault) throw new PaymeFault(result.fault);
    return (result as { view: Record<string, unknown> }).view;
  }

  /** Cancel ham o'sha qator qulfi ostida — Perform bilan ketma-ket (#8). */
  private async cancel(params: Params): Promise<Record<string, unknown>> {
    const paymeId = this.requireString(params, 'id');
    const reason = typeof params['reason'] === 'number' ? params['reason'] : PAYME_REASON.unknown;
    let ctx: MoneyContext | null = null;
    const view = await this.dataSource.transaction(async (manager: EntityManager) => {
      ctx = newMoneyContext(manager);
      const repo = manager.getRepository(MerchantTransaction);
      const tx = await this.lockTx(repo, paymeId);
      if (!tx) return null;
      const ref = { kind: tx.targetKind, ref: tx.targetRef };
      const cancelTime = new Date(Date.now());
      let current: MerchantTransaction = tx;

      if (tx.state === MERCHANT_TX_STATE.created) {
        current = { ...tx, state: MERCHANT_TX_STATE.cancelled, cancelTime, reason };
        await repo.update({ id: tx.id, state: MERCHANT_TX_STATE.created }, { state: current.state, cancelTime, reason });
        await this.targets.release(ref, false, ctx);
      } else if (tx.state === MERCHANT_TX_STATE.performed) {
        current = { ...tx, state: MERCHANT_TX_STATE.cancelledAfterPerform, cancelTime, reason };
        await repo.update({ id: tx.id, state: MERCHANT_TX_STATE.performed }, { state: current.state, cancelTime, reason });
        this.logger.warn(`Payme refund of ${tx.externalId} (${tx.targetKind} ${tx.targetRef}), reason ${reason}`);
        await this.targets.refund(ref, `payme_${tx.externalId}`, ctx);
      }
      return { transaction: current.seq, cancel_time: ms(current.cancelTime), state: current.state };
    });
    await runAfterCommit(ctx, (err) => this.logger.error(`Payme cancel side effect failed: ${err.message}`));
    if (!view) throw new PaymeFault(PAYME_ERRORS.transactionNotFound);
    return view;
  }

  private async check(params: Params): Promise<Record<string, unknown>> {
    const tx = await this.requireTx(params);
    return {
      create_time: ms(tx.createTime),
      perform_time: ms(tx.performTime),
      cancel_time: ms(tx.cancelTime),
      transaction: tx.seq,
      state: tx.state,
      reason: tx.reason ?? null,
    };
  }

  private async statement(params: Params): Promise<Record<string, unknown>> {
    const from = this.requireNumber(params, 'from');
    const to = this.requireNumber(params, 'to');
    const rows = await this.repo.find({
      where: { provider: 'payme', providerTime: Between(from, to) },
      order: { providerTime: 'ASC' },
    });
    return {
      transactions: rows.map((tx) => ({
        id: tx.externalId,
        time: Number(tx.providerTime),
        amount: Math.round(Number(tx.amount) * 100),
        account: tx.account ?? { [PAYME_ACCOUNT_FIELD]: tx.targetRef },
        create_time: ms(tx.createTime),
        perform_time: ms(tx.performTime),
        cancel_time: ms(tx.cancelTime),
        transaction: tx.seq,
        state: tx.state,
        reason: tx.reason ?? null,
      })),
    };
  }

  // ------------------------------------------------------------- yordamchi

  /**
   * `account.order_id` + summa: CheckPerformTransaction va CreateTransaction
   * uchun umumiy. Faol (state 1) boshqa tranzaksiya — −31052; muddati o'tgan
   * bo'lsa avval bekor qilinadi.
   */
  private async validateAccount(params: Params): Promise<PaymentTarget> {
    const account = params['account'];
    const ref = isObject(account) ? account[PAYME_ACCOUNT_FIELD] : undefined;
    // Payme summani BUTUN tiyinda yuboradi — kasr yoki farq 1 tiyin ham rad (#10).
    const amountTiyin = strictTiyin(params['amount']);
    if (amountTiyin === null) throw new PaymeFault(PAYME_ERRORS.invalidAmount);
    const target = await this.targets.load(ref, 'payme');
    if (!target) throw new PaymeFault(PAYME_ERRORS.orderNotFound, PAYME_ACCOUNT_FIELD);
    if (target.status !== 'payable') throw new PaymeFault(PAYME_ERRORS.orderNotPayable, PAYME_ACCOUNT_FIELD);
    if (somToTiyin(target.amount) !== amountTiyin) throw new PaymeFault(PAYME_ERRORS.invalidAmount);

    const active = await this.repo.findOne({
      where: { provider: 'payme', targetRef: target.ref, state: MERCHANT_TX_STATE.created },
    });
    if (active && active.externalId !== params['id']) {
      if (!this.expired(active)) throw new PaymeFault(PAYME_ERRORS.orderBusy, PAYME_ACCOUNT_FIELD);
      await this.cancelByTimeout(active);
    }
    return target;
  }

  private expired(tx: MerchantTransaction): boolean {
    return Date.now() - ms(tx.createTime) > PAYME_TIMEOUT_MS;
  }

  /** `ctx` — Perform tranzaksiyasi ichida (qator allaqachon qulflangan). */
  private async cancelByTimeout(tx: MerchantTransaction, ctx?: MoneyContext): Promise<void> {
    const repo = ctx ? ctx.manager.getRepository(MerchantTransaction) : this.repo;
    const claimed = await repo.update(
      { id: tx.id, state: MERCHANT_TX_STATE.created },
      { state: MERCHANT_TX_STATE.cancelled, cancelTime: new Date(Date.now()), reason: PAYME_REASON.timeout },
    );
    if (claimed.affected) {
      this.logger.log(`Payme transaction ${tx.externalId} cancelled by timeout`);
      await this.targets.release({ kind: tx.targetKind, ref: tx.targetRef }, false, ctx);
    }
  }

  private lockTx(repo: Repository<MerchantTransaction>, paymeId: string): Promise<MerchantTransaction | null> {
    return repo.findOne({
      where: { provider: 'payme', externalId: paymeId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private findTx(paymeId: string): Promise<MerchantTransaction | null> {
    return this.repo.findOne({ where: { provider: 'payme', externalId: paymeId } });
  }

  private async requireTx(params: Params): Promise<MerchantTransaction> {
    const tx = await this.findTx(this.requireString(params, 'id'));
    if (!tx) throw new PaymeFault(PAYME_ERRORS.transactionNotFound);
    return tx;
  }

  private requireString(params: Params, key: string): string {
    const value = params[key];
    if (typeof value !== 'string' || !value) throw new PaymeFault(PAYME_ERRORS.invalidRequest, key);
    return value;
  }

  private requireNumber(params: Params, key: string): number {
    const value = params[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new PaymeFault(PAYME_ERRORS.invalidRequest, key);
    return value;
  }

  private createView(tx: MerchantTransaction): Record<string, unknown> {
    return { create_time: ms(tx.createTime), transaction: tx.seq, state: tx.state };
  }

  private performView(tx: MerchantTransaction): Record<string, unknown> {
    return { transaction: tx.seq, perform_time: ms(tx.performTime), state: tx.state };
  }
}

