import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Transaction } from '../../database/entities/transaction.entity';
import { outstandingWalletDebt, walletDebtBlockedError } from '../orders/outstanding-wallet-debt';
import { DeliveryIncidentSettings } from '../settings/delivery-incident-settings';
import { assertNotSuspended } from '../incidents/suspension';

/**
 * Ovqat/market checkout darvozalari (docs/INCIDENT-POLICY.md §2):
 *
 *  1. To'lanmagan qarz (masalan rad etilgan naqd yetkazishning yetkazish +
 *     qaytarish haqi) — yangi buyurtma yo'q. Ilgari bu tekshiruv faqat kuryer
 *     safari yaratilganda (sotuvchi "tayyor" deganda) ishlardi va buyurtma
 *     oshxonada qotib qolardi; endi checkout'da, mijozga aniq sabab bilan.
 *  2. Oynada `refusalCashBlockCount` marta yetkazishni qabul qilmagan mijoz
 *     ovqat/marketni NAQD to'lay olmaydi (karta — mumkin).
 */
export type RawQuery = (sql: string, params: unknown[]) => Promise<unknown>;

export async function countRecentDeliveryRefusals(
  query: RawQuery,
  customerId: string,
  since: Date,
): Promise<number> {
  const rows = (await query(
    `SELECT COUNT(*)::int AS refusals FROM orders
      WHERE passenger_id = $1 AND delivery_failed_at IS NOT NULL AND delivery_failed_at >= $2
        AND service_type IN ('food', 'market')`,
    [customerId, since],
  )) as Array<{ refusals: number | string }>;
  return Number(rows[0]?.refusals ?? 0);
}

export function refusalCashBlockedMessage(windowDays: number, refusals: number): string {
  return (
    `So'nggi ${windowDays} kunda ${refusals} marta yetkazishni qabul qilmadingiz — ` +
    "ovqat va market buyurtmasini faqat karta bilan to'lash mumkin"
  );
}

export async function assertCustomerMayCheckout(
  deps: { query: RawQuery; transactions: Repository<Transaction> },
  input: {
    customerId: string;
    isCash: boolean;
    settings: Pick<DeliveryIncidentSettings, 'refusalCashBlockCount' | 'refusalWindowDays'>;
    now?: Date;
  },
): Promise<void> {
  const debt = await outstandingWalletDebt(deps.transactions, input.customerId);
  if (debt > 0) {
    throw walletDebtBlockedError(debt);
  }
  const now = input.now ?? new Date();
  if (input.isCash) await assertCashNotRefusalBlocked(deps.query, input.customerId, input.settings, now);
  await assertCustomerNotSuspended(deps.query, input.customerId, now);
}

async function assertCashNotRefusalBlocked(
  query: RawQuery,
  customerId: string,
  settings: Pick<DeliveryIncidentSettings, 'refusalCashBlockCount' | 'refusalWindowDays'>,
  now: Date,
): Promise<void> {
  const since = new Date(now.getTime() - settings.refusalWindowDays * 86_400_000);
  const refusals = await countRecentDeliveryRefusals(query, customerId, since);
  if (refusals >= settings.refusalCashBlockCount) {
    throw new BadRequestException(refusalCashBlockedMessage(settings.refusalWindowDays, refusals));
  }
}

/** Vaqtincha to'xtatilgan mijoz yangi buyurtma bermaydi (INCIDENT-POLICY §3). */
async function assertCustomerNotSuspended(query: RawQuery, customerId: string, now: Date): Promise<void> {
  const rows = (await query(
    'SELECT suspended_until AS "suspendedUntil", suspension_reason AS "suspensionReason" FROM users WHERE id = $1',
    [customerId],
  )) as Array<{ suspendedUntil?: Date | null; suspensionReason?: string | null }> | undefined;
  const state = Array.isArray(rows) ? rows[0] : undefined;
  if (state?.suspendedUntil) {
    assertNotSuspended({ suspendedUntil: state.suspendedUntil, suspensionReason: state.suspensionReason ?? null }, 'new_order', now);
  }
}
