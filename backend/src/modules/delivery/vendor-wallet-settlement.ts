import { BadRequestException } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { FoodOrder } from '../../database/entities/food-order.entity';
import { MarketOrder } from '../../database/entities/market-order.entity';
import { PaymentMethod } from '../../database/entities/order.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import {
  computeSpendableBalance,
  lockWalletsForUpdate,
  syncDriverBalanceColumn,
} from '../payments/wallet-balance.util';
import { ERROR_CODES, codedBadRequest } from '../../common/errors/coded-error';

/**
 * Hamyon rejimida sotuvchi bilan hisob-kitob (`vendor-settlement-mode.ts`).
 *
 * Olib ketishda, BITTA DB tranzaksiyasida va kuryer hamyoni qulfi ostida:
 *   · kuryer   DEBIT  tovar summasi       `vendor_settlement_debit_<id>`
 *   · sotuvchi CREDIT tovar summasi       `vendor_settlement_credit_<id>`
 *   · sotuvchi DEBIT  komissiya           `vendor_settlement_commission_<id>`
 * Sotuvchining sof tushumi = tovar − komissiya. Komissiya FAQAT tovardan
 * (`round(tovar × commissionRate / 100)`, yetkazish haqisiz —
 * `vendor-checkout.ts` `vendorOrderCommission`, `settle*Earnings` va fiskal
 * chek bilan bir xil) — shu sabab yetkazilganda `settle*Earnings` hamyon
 * orqali hisoblangan buyurtmaga komissiyani QAYTA yozmaydi
 * (`vendorWalletSettledAt` belgisi).
 *
 * Bir martalik: buyurtmadagi shartli yozuv (`vendor_wallet_settled_at IS
 * NULL`) + `uq_transactions_vendor_settlement` unikal indeksi.
 */
/**
 * `round` — nechanchi o'tkazma (1 dan). Olib ketilgandan keyin yetkazish
 * bekor qilinib o'tkazma teskari qilinsa (`reverseVendorWalletSettlement`),
 * keyingi kuryerning o'tkazmasi `_2`, `_3` ... qo'shimchasi bilan yoziladi —
 * aks holda unikal indeks uni rad etardi. Birinchi raund belgilari o'zgarmagan.
 */
const roundSuffix = (round: number): string => (round > 1 ? `_${round}` : '');

export const VENDOR_SETTLEMENT_TAG = {
  courierDebit: (vendorOrderId: string, round = 1): string =>
    `vendor_settlement_debit_${vendorOrderId}${roundSuffix(round)}`,
  vendorCredit: (vendorOrderId: string, round = 1): string =>
    `vendor_settlement_credit_${vendorOrderId}${roundSuffix(round)}`,
  vendorCommission: (vendorOrderId: string, round = 1): string =>
    `vendor_settlement_commission_${vendorOrderId}${roundSuffix(round)}`,
} as const;

/** Teskari qatorlar — `vendor_settlement_` prefiksi tufayli o'sha unikal indeks ostida. */
export const VENDOR_SETTLEMENT_REVERSAL_TAG = {
  courierCredit: (vendorOrderId: string, round = 1): string =>
    `vendor_settlement_reversal_debit_${vendorOrderId}${roundSuffix(round)}`,
  vendorDebit: (vendorOrderId: string, round = 1): string =>
    `vendor_settlement_reversal_credit_${vendorOrderId}${roundSuffix(round)}`,
  vendorCommissionCredit: (vendorOrderId: string, round = 1): string =>
    `vendor_settlement_reversal_commission_${vendorOrderId}${roundSuffix(round)}`,
} as const;

/** `base` — FAQAT tovar summasi (yetkazish haqisiz); qarang `vendorOrderCommission`. */
export function vendorCommissionAmount(base: number, commissionRate: number): number {
  return Math.round((Number(base) * Number(commissionRate)) / 100);
}

/** `WALLET_INSUFFICIENT_FOR_VENDOR` — `details: { required, balance }` (so'm). */
export function insufficientWalletForVendor(amount: number, balance: number): BadRequestException {
  return codedBadRequest(
    ERROR_CODES.walletInsufficientForVendor,
    `Hamyonda mablag' yetarli emas: do'konga ${formatSom(amount)} so'm o'tkazish kerak, ` +
      `balansingiz ${formatSom(balance)} so'm. Avval hamyonni to'ldiring.`,
    { details: { required: amount, balance } },
  );
}

export interface VendorWalletSettlementInput {
  kind: 'food' | 'market';
  vendorOrderId: string;
  /**
   * Faqat ma'lumot uchun — komissiya bazasi EMAS: komissiya `amount` (tovar)
   * dan olinadi, `totalPrice` esa yetkazish haqini ham o'z ichiga oladi.
   */
  vendorOrderTotalPrice: number;
  vendorCommissionRate: number;
  vendorOwnerUserId: string;
  courierUserId: string;
  /** Tovar summasi (`DeliveryRideDetails.payVendor`) — komissiya bazasi ham shu. */
  amount: number;
  /** Mavjud bo'lsa saqlanadi (kuryer avval naqd rejimda belgilagan bo'lishi mumkin). */
  existingPaidAt: Date | null;
  /** Nechanchi o'tkazma: `vendorWalletReversalCount + 1` (standart 1). */
  round?: number;
}

export interface VendorWalletSettlementResult {
  /** false — allaqachon hisoblangan edi (takroriy chaqiruv). */
  settled: boolean;
  amount: number;
  commission: number;
  net: number;
}

export async function settleVendorViaWallet(
  manager: EntityManager,
  input: VendorWalletSettlementInput,
): Promise<VendorWalletSettlementResult> {
  // Komissiya FAQAT tovardan: `amount` = `totalPrice − yetkazish haqi`
  // (`deliveryRideDetails.payVendor`). Ilgari `totalPrice` dan olinardi —
  // yetkazish haqiga ham komissiya tushardi.
  const commission = vendorCommissionAmount(input.amount, input.vendorCommissionRate);
  const summary = { amount: input.amount, commission, net: input.amount - commission };

  // Qulf tartibi (#3b/#9): ikkala hamyon (saralangan), keyin buyurtma qatori —
  // teskari o'tkazma va yechish bilan bir xil.
  await lockWalletsForUpdate(manager, [input.courierUserId, input.vendorOwnerUserId]);

  const now = new Date();
  const entity = input.kind === 'food' ? FoodOrder : MarketOrder;
  const claimed = await manager.update(
    entity,
    { id: input.vendorOrderId, vendorWalletSettledAt: IsNull() },
    {
      vendorWalletSettledAt: now,
      vendorCashPaidAt: input.existingPaidAt ?? now,
      vendorCashConfirmedAt: now,
      // O'tkazma paytidagi summalar — `vendorWalletSettlement` ko'rinishi (§22).
      vendorWalletAmount: input.amount,
      vendorWalletCommission: commission,
    },
  );
  if (!claimed.affected) {
    return { settled: false, ...summary };
  }

  const ledger = manager.getRepository(Transaction);
  const balance = await computeSpendableBalance(ledger, input.courierUserId);
  if (balance < input.amount) {
    // Tranzaksiya orqaga qaytadi — buyurtma belgisi ham.
    throw insufficientWalletForVendor(input.amount, balance);
  }

  const row = (userId: string, amount: number, type: TransactionType, externalId: string) => ({
    userId,
    orderId: null,
    amount,
    type,
    paymentMethod: PaymentMethod.WALLET,
    status: TransactionStatus.COMPLETED,
    externalId,
  });
  const round = input.round ?? 1;
  await ledger.save(
    row(
      input.courierUserId,
      input.amount,
      TransactionType.DEBIT,
      VENDOR_SETTLEMENT_TAG.courierDebit(input.vendorOrderId, round),
    ),
  );
  await ledger.save(
    row(
      input.vendorOwnerUserId,
      input.amount,
      TransactionType.CREDIT,
      VENDOR_SETTLEMENT_TAG.vendorCredit(input.vendorOrderId, round),
    ),
  );
  if (commission > 0) {
    await ledger.save(
      row(
        input.vendorOwnerUserId,
        commission,
        TransactionType.DEBIT,
        VENDOR_SETTLEMENT_TAG.vendorCommission(input.vendorOrderId, round),
      ),
    );
  }
  // `drivers.balance` — daftarning keshi (§13). Ilgari o'tkazma ustunga
  // tegmasdi va ikkalasi ajralib ketardi.
  await syncDriverBalanceColumn(manager, input.courierUserId);
  return { settled: true, ...summary };
}

export interface VendorWalletReversalInput {
  kind: 'food' | 'market';
  vendorOrderId: string;
  /**
   * Bekor qilingan kuryer safari. Buyurtma allaqachon boshqa safarga
   * bog'langan bo'lsa (qayta chaqirilgan) — eski safarning hodisasi e'tiborsiz.
   */
  deliveryOrderId?: string;
  /**
   * Qayta biriktirishda: faqat SHU kuryer qilgan o'tkazma teskari qilinadi
   * (§19). Bekor qilishda berilmaydi — kim o'tkazgan bo'lsa ham.
   */
  courierUserId?: string;
}

export type VendorWalletReversalSkipReason =
  | 'not_found'
  | 'not_settled'
  | 'delivered'
  | 'stale_ride'
  | 'ledger_missing'
  | 'already_reversed'
  | 'other_courier';

export interface VendorWalletReversalResult {
  reversed: boolean;
  reason?: VendorWalletReversalSkipReason;
  courierUserId?: string;
  vendorOwnerUserId?: string;
  amount?: number;
  commission?: number;
}

/**
 * Olib ketishdagi hamyon o'tkazmasini teskari qiladi — kuryer safari tovar
 * yetkazilmasdan bekor qilinganda (docs/LEGAL-COMPLIANCE.md §14) yoki kuryer
 * qayta biriktirilganda (§19, `courierUserId` — oldingi kuryer). Chaqiruvchi
 * tranzaksiyasi ichida:
 *   · kuryer   CREDIT tovar summasi  `vendor_settlement_reversal_debit_<id>`
 *   · sotuvchi DEBIT  tovar summasi  `vendor_settlement_reversal_credit_<id>`
 *   · sotuvchi CREDIT komissiya      `vendor_settlement_reversal_commission_<id>`
 * va buyurtmadagi `vendor_wallet_settled_at` (hamda naqd belgilari) tozalanadi,
 * `vendor_wallet_reversal_count` +1 — keyingi kuryer qayta o'tkazadi.
 *
 * Bir martalik: shartli yozuv (belgi bor + hisoblagich kutilgan qiymatda) +
 * unikal indeks. Yetkazilgan buyurtmaga TEGILMAYDI. Summalar daftardagi asl
 * qatorlardan olinadi — komissiya stavkasi o'zgargan bo'lsa ham aynan qaytadi.
 */
export async function reverseVendorWalletSettlement(
  manager: EntityManager,
  input: VendorWalletReversalInput,
): Promise<VendorWalletReversalResult> {
  const entity = input.kind === 'food' ? FoodOrder : MarketOrder;

  // 1) Qulfsiz o'qish — kimning hamyonlari qulflanishini bilish uchun.
  // Qulf tartibi o'tkazma bilan bir xil (#3b/#9): avval hamyonlar
  // (kuryer + SOTUVCHI, saralangan), keyin buyurtma qatori. Ilgari bu yerda
  // qator → hamyon tartibi edi (o'tkazmada — teskarisi) va sotuvchi hamyoni
  // umuman qulflanmasdi: parallel yechish uni manfiyga tushirishi mumkin edi.
  const peek = (await manager.findOne(entity, { where: { id: input.vendorOrderId } })) as
    | (FoodOrder | MarketOrder)
    | null;
  const planned = await planReversal(manager, peek, input);
  if ('skip' in planned) return { reversed: false, reason: planned.skip };

  const locked = await lockWalletsForUpdate(manager, [planned.courierRow.userId, planned.vendorRow.userId]);

  // 2) Qulf ostida qayta o'qish va qayta tekshirish.
  const order = (await manager.findOne(entity, {
    where: { id: input.vendorOrderId },
    lock: { mode: 'pessimistic_write' },
  })) as (FoodOrder | MarketOrder) | null;
  const plan = await planReversal(manager, order, input);
  if ('skip' in plan) return { reversed: false, reason: plan.skip };
  if (!locked.includes(plan.courierRow.userId) || !locked.includes(plan.vendorRow.userId)) {
    // Qulflar orasida boshqa raund boshlangan — parallel o'zgarish.
    return { reversed: false, reason: 'already_reversed' };
  }
  const { courierRow, vendorRow, commissionRow, reversals, round } = plan;

  const claimed = await manager.update(
    entity,
    { id: plan.orderId, vendorWalletReversalCount: reversals },
    {
      vendorWalletSettledAt: null,
      vendorCashPaidAt: null,
      vendorCashConfirmedAt: null,
      vendorWalletReversalCount: round,
      // Summalar saqlanadi — teskari o'tkazma JSON'da ko'rinadi (§22).
      vendorWalletReversedAt: new Date(),
    },
  );
  if (!claimed.affected) return { reversed: false, reason: 'already_reversed' };

  const row = (userId: string, amount: number, type: TransactionType, externalId: string) => ({
    userId,
    orderId: null,
    amount,
    type,
    paymentMethod: PaymentMethod.WALLET,
    status: TransactionStatus.COMPLETED,
    externalId,
  });
  const ledger = manager.getRepository(Transaction);
  const orderId = plan.orderId;
  const amount = Number(courierRow.amount);
  const commission = commissionRow ? Number(commissionRow.amount) : 0;
  await ledger.save(
    row(courierRow.userId, amount, TransactionType.CREDIT, VENDOR_SETTLEMENT_REVERSAL_TAG.courierCredit(orderId, round)),
  );
  await ledger.save(
    row(vendorRow.userId, Number(vendorRow.amount), TransactionType.DEBIT, VENDOR_SETTLEMENT_REVERSAL_TAG.vendorDebit(orderId, round)),
  );
  if (commissionRow && commission > 0) {
    await ledger.save(
      row(
        commissionRow.userId,
        commission,
        TransactionType.CREDIT,
        VENDOR_SETTLEMENT_REVERSAL_TAG.vendorCommissionCredit(orderId, round),
      ),
    );
  }
  await syncDriverBalanceColumn(manager, courierRow.userId);
  return {
    reversed: true,
    courierUserId: courierRow.userId,
    vendorOwnerUserId: vendorRow.userId,
    amount,
    commission,
  };
}

type ReversalPlan =
  | { skip: VendorWalletReversalSkipReason }
  | {
      orderId: string;
      reversals: number;
      round: number;
      courierRow: Transaction;
      vendorRow: Transaction;
      commissionRow: Transaction | undefined;
    };

/** Teskari o'tkazma shartlari va asl daftar qatorlari (qulfsiz ham, qulf ostida ham). */
async function planReversal(
  manager: EntityManager,
  order: (FoodOrder | MarketOrder) | null,
  input: VendorWalletReversalInput,
): Promise<ReversalPlan> {
  if (!order) return { skip: 'not_found' };
  if (!order.vendorWalletSettledAt) return { skip: 'not_settled' };
  if (String(order.status) === 'delivered') return { skip: 'delivered' };
  if (input.deliveryOrderId && order.deliveryOrderId && order.deliveryOrderId !== input.deliveryOrderId) {
    return { skip: 'stale_ride' };
  }

  const reversals = order.vendorWalletReversalCount ?? 0;
  const round = reversals + 1;
  const tags = {
    courierDebit: VENDOR_SETTLEMENT_TAG.courierDebit(order.id, round),
    vendorCredit: VENDOR_SETTLEMENT_TAG.vendorCredit(order.id, round),
    vendorCommission: VENDOR_SETTLEMENT_TAG.vendorCommission(order.id, round),
  };
  const original = await manager.getRepository(Transaction).find({ where: { externalId: In(Object.values(tags)) } });
  const courierRow = original.find((row) => row.externalId === tags.courierDebit);
  const vendorRow = original.find((row) => row.externalId === tags.vendorCredit);
  const commissionRow = original.find((row) => row.externalId === tags.vendorCommission);
  if (!courierRow || !vendorRow) return { skip: 'ledger_missing' };
  if (input.courierUserId && courierRow.userId !== input.courierUserId) return { skip: 'other_courier' };
  return { orderId: order.id, reversals, round, courierRow, vendorRow, commissionRow };
}

export function formatSom(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
