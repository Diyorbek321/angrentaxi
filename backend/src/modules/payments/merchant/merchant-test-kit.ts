/* Test yordamchilari — faqat *.spec.ts lardan import qilinadi. */
import { MerchantTransaction } from '../../../database/entities/merchant-transaction.entity';
import { PaymentTarget, TargetPayOutcome, TargetRef } from './payment-targets.service';

type Where = Record<string, unknown>;

function matches(row: MerchantTransaction, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = (row as unknown as Record<string, unknown>)[key];
    const op = expected as { _type?: string; _value?: unknown } | null;
    if (op && typeof op === 'object' && op._type === 'lessThan') {
      return actual instanceof Date && actual.getTime() < (op._value as Date).getTime();
    }
    if (op && typeof op === 'object' && op._type === 'between') {
      const [from, to] = op._value as [number, number];
      return typeof actual === 'number' && actual >= from && actual <= to;
    }
    return actual === expected;
  });
}

/** `merchant_transactions` uchun xotiradagi repozitoriy (unikal indekslar bilan). */
export class FakeMerchantRepo {
  rows: MerchantTransaction[] = [];
  private seq = 100;

  async findOne(options: { where: Where }): Promise<MerchantTransaction | null> {
    const row = this.rows.find((candidate) => matches(candidate, options.where));
    return row ? { ...row } : null;
  }

  async find(options: { where: Where; order?: Record<string, 'ASC' | 'DESC'> }): Promise<MerchantTransaction[]> {
    return this.rows
      .filter((row) => matches(row, options.where))
      .sort((a, b) => Number(a.providerTime ?? 0) - Number(b.providerTime ?? 0))
      .map((row) => ({ ...row }));
  }

  async save(input: Partial<MerchantTransaction>): Promise<MerchantTransaction> {
    const duplicate = this.rows.some(
      (row) =>
        (row.provider === input.provider && row.externalId === input.externalId) ||
        (input.provider === 'payme' &&
          input.state === 1 &&
          row.provider === 'payme' &&
          row.state === 1 &&
          row.targetRef === input.targetRef),
    );
    if (duplicate) throw Object.assign(new Error('duplicate key'), { code: '23505' });
    this.seq += 1;
    const row = {
      id: `mt-${this.seq}`,
      seq: String(this.seq),
      performTime: null,
      cancelTime: null,
      reason: null,
      providerTime: null,
      account: null,
      ...input,
    } as MerchantTransaction;
    this.rows.push(row);
    return { ...row };
  }

  async update(where: Where, patch: Partial<MerchantTransaction>): Promise<{ affected: number }> {
    let affected = 0;
    this.rows = this.rows.map((row) => {
      if (!matches(row, where)) return row;
      affected += 1;
      return { ...row, ...patch };
    });
    return { affected };
  }
}

/** Nishonlar: havola → holat. `markPaid` bir martalik (externalId bo'yicha). */
export class FakeTargets {
  targets = new Map<string, PaymentTarget & { paidBy?: string }>();
  released: Array<{ ref: string; failed: boolean }> = [];
  refunded: Array<{ ref: string; externalId: string }> = [];

  add(ref: string, amount: number, status: PaymentTarget['status'] = 'payable', kind: PaymentTarget['kind'] = 'order'): void {
    this.targets.set(ref, { kind, ref, amount, status });
  }

  async load(ref: unknown): Promise<PaymentTarget | null> {
    const target = typeof ref === 'string' ? this.targets.get(ref) : undefined;
    return target ? { kind: target.kind, ref: target.ref, amount: target.amount, status: target.status } : null;
  }

  async markPaid(ref: TargetRef, input: { amount: number; externalId: string }): Promise<TargetPayOutcome> {
    const target = this.targets.get(ref.ref);
    if (!target) return 'not_found';
    if (Math.abs(target.amount - input.amount) >= 0.01) return 'amount_mismatch';
    if (target.status === 'paid') return target.paidBy === input.externalId ? 'already_paid' : 'not_payable';
    if (target.status !== 'payable') return 'not_payable';
    this.targets.set(ref.ref, { ...target, status: 'paid', paidBy: input.externalId });
    return 'paid';
  }

  bound: Array<{ ref: string; provider: string; externalId: string }> = [];

  async bind(ref: TargetRef, provider: string, externalId: string): Promise<'bound' | 'busy' | 'not_payable'> {
    this.bound.push({ ref: ref.ref, provider, externalId });
    return 'bound';
  }

  async release(ref: TargetRef, failed = false): Promise<void> {
    this.released.push({ ref: ref.ref, failed });
  }

  async refund(ref: TargetRef, externalId: string): Promise<void> {
    this.refunded.push({ ref: ref.ref, externalId });
    const target = this.targets.get(ref.ref);
    if (target) this.targets.set(ref.ref, { ...target, status: 'closed' });
  }
}

/**
 * `DataSource.transaction` soxtasi: tranzaksiyalar KETMA-KET bajariladi —
 * `merchant_transactions` qatoridagi `FOR UPDATE` qulfining xotiradagi
 * o'xshashi. Ichkarida `getRepository()` merchant repozitoriyni qaytaradi.
 */
export class FakeMerchantDataSource {
  private tail: Promise<unknown> = Promise.resolve();
  transactions = 0;

  constructor(private readonly repo: FakeMerchantRepo) {}

  transaction<T>(work: (manager: unknown) => Promise<T>): Promise<T> {
    const manager = { getRepository: () => this.repo };
    const run = this.tail.then(() => {
      this.transactions += 1;
      return work(manager);
    });
    this.tail = run.catch(() => undefined);
    return run;
  }
}
