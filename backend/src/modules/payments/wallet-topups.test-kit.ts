/* Test yordamchisi — faqat *.spec.ts lardan import qilinadi. */
import { randomUUID } from 'crypto';
import { WalletTopup } from '../../database/entities/wallet-topup.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { MerchantTransaction } from '../../database/entities/merchant-transaction.entity';
import { WalletTopupsService } from './wallet-topups.service';
import { WalletTopupCallbacksService } from './wallet-topup-callbacks.service';

/** Birinchi yaratilgan to'ldirishning id'si (keyingilari — tasodifiy UUID). */
export const WALLET_TOPUP_TEST_ID = '11111111-2222-3333-4444-555555555555';

/**
 * Hamyonni Payme/Click/UZPS orqali to'ldirish — docs/LEGAL-COMPLIANCE.md §11.
 * Xotiradagi soxta baza: `wallet_topups` + daftar (unikal `external_id`).
 * Barcha tranzaksiyalar bitta `manager` ustida (merchant repo ham ulanadi).
 */
export function buildTopupHarness(
  opts: { enabled?: boolean; configured?: boolean; ledgerBalance?: () => number; returnUrl?: string } = {},
) {
  const topups = new Map<string, WalletTopup>();
  const ledger: Array<Partial<Transaction>> = [];
  let seq = 100;
  let merchantRepo: unknown = null;
  const settings = {
    walletTopupEnabled: opts.enabled ?? true,
    walletTopupMin: 10000,
    walletTopupMax: 2000000,
    walletTopupPresets: [50000, 100000, 200000],
  };

  const matches = (row: WalletTopup, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([key, value]) => {
      const actual = (row as unknown as Record<string, unknown>)[key];
      if (value && typeof value === 'object' && '_type' in (value as object)) {
        const op = value as { _type: string; _value: unknown };
        if (op._type === 'isNull') return actual === null || actual === undefined;
        if (op._type === 'lessThan') return (actual as Date) < (op._value as Date);
        if (op._type === 'moreThan') return (actual as Date) > (op._value as Date);
      }
      return actual === value;
    });

  const update = (where: Record<string, unknown>, changes: Partial<WalletTopup>) => {
    let affected = 0;
    for (const [id, row] of topups) {
      if (matches(row, where)) {
        topups.set(id, { ...row, ...changes });
        affected += 1;
      }
    }
    return { affected };
  };

  const find = async ({ where }: { where?: Record<string, unknown> } = {}) =>
    [...topups.values()].filter((row) => !where || matches(row, where)).map((row) => ({ ...row }));

  const repo = {
    create: (row: Partial<WalletTopup>) => row,
    save: jest.fn(async (row: Partial<WalletTopup>) => {
      const id = topups.has(WALLET_TOPUP_TEST_ID) ? randomUUID() : WALLET_TOPUP_TEST_ID;
      const saved = { id, seq: String(seq++), createdAt: new Date(), ...row } as WalletTopup;
      topups.set(saved.id, saved);
      return saved;
    }),
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const row = [...topups.values()].find((candidate) => matches(candidate, where));
      return row ? { ...row } : null;
    }),
    find: jest.fn(find),
    update: jest.fn(async (where: Record<string, unknown>, changes: Partial<WalletTopup>) =>
      update(where, changes),
    ),
  };

  const ledgerRepo = {
    save: jest.fn(async (row: Partial<Transaction>) => {
      if (ledger.some((existing) => existing.externalId === row.externalId)) {
        throw new Error('duplicate key value violates unique constraint "uq_transactions_wallet_topup"');
      }
      ledger.push(row);
      return row;
    }),
  };

  const balance = opts.ledgerBalance ?? (() => 0);
  const manager = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('UPDATE drivers')) {
        const value = balance();
        return [[{ driver_id: 'driver-1', balance: String(value), is_online: value >= 0, was_online: true }], 1];
      }
      return [];
    }),
    findOne: jest.fn(async (_entity: unknown, { where }: { where: Record<string, unknown> }) =>
      repo.findOne({ where }),
    ),
    find: jest.fn(async (_entity: unknown, options: { where?: Record<string, unknown> }) => find(options)),
    save: jest.fn(async (_entity: unknown, row: Partial<WalletTopup>) => repo.save(row)),
    create: jest.fn((_entity: unknown, row: Partial<WalletTopup>) => row),
    update: jest.fn(async (_entity: unknown, where: Record<string, unknown>, changes: Partial<WalletTopup>) =>
      update(where, changes),
    ),
    getRepository: jest.fn((entity?: unknown) => {
      if (entity === MerchantTransaction && merchantRepo) return merchantRepo;
      if (entity === WalletTopup) return repo;
      return ledgerRepo;
    }),
  };
  const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };
  const provider = (name: string) => ({
    isConfigured: jest.fn(() => opts.configured ?? true),
    initiate: jest.fn(async (amount: number, reference: string) => ({
      url: `https://${name}.example/pay?ref=${reference}&amount=${amount}`,
      id: `${name}_${reference}`,
      provider: name,
    })),
  });
  const payme = provider('payme');
  const click = provider('click');
  const uzcard = {
    ...provider('uzcard'),
    // UZPS status API'si (`GET /payment/status/<id>`) — standart: to'langan.
    fetchStatus: jest.fn(async (_transactionId: string): Promise<string | null> => 'PAID'),
  };
  const driversService = { takeOfflineInRedis: jest.fn() };
  const notifier = { balanceChanged: jest.fn() };
  const settingsService = { getWalletTopupSettings: jest.fn(async () => settings) };

  const service = new WalletTopupsService(
    repo as never,
    dataSource as never,
    settingsService as never,
    payme as never,
    click as never,
    uzcard as never,
    driversService as never,
    notifier as never,
    { get: (key: string) => (key === 'WALLET_TOPUP_RETURN_URL' ? (opts.returnUrl ?? '') : undefined) } as never,
  );
  const callbacks = new WalletTopupCallbacksService(service, uzcard as never);
  return {
    service,
    callbacks,
    topups,
    ledger,
    payme,
    click,
    uzcard,
    notifier,
    driversService,
    settings,
    dataSource,
    manager,
    /** Merchant protokollari shu harness tranzaksiyasida ishlashi uchun. */
    useMerchantRepo: (merchant: unknown): void => {
      merchantRepo = merchant;
    },
  };
}
