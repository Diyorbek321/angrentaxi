import { Injectable, Logger, Optional } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { FoodOrder } from '../../database/entities/food-order.entity';
import { MarketOrder } from '../../database/entities/market-order.entity';
import { Order, PaymentMethod } from '../../database/entities/order.entity';
import { Restaurant } from '../../database/entities/restaurant.entity';
import { Store } from '../../database/entities/store.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';
import { DriversService } from '../drivers/drivers.service';
import { WalletNotifierService } from '../drivers/wallet-notifier.service';
import { FiscalReceiptsService } from '../fiscal/fiscal-receipts.service';
import { TAX_WITHHOLDING_LEDGER_TAG } from '../tax/tax-withholding';
import { formatSom } from '../delivery/vendor-wallet-settlement';
import { lockWalletForUpdate, syncDriverBalanceColumn } from './wallet-balance.util';
import { localized } from '../notifications/push-text';

/**
 * Qaytarib olish qatorlari — `uq_transactions_refund_clawback` unikal indeksi
 * ostida (migratsiya 029): bitta buyurtma/safarga bitta.
 */
export const REFUND_CLAWBACK_TAG = {
  /** `orderId` — taksi safari yoki ovqat/market kuryer safari (`orders.id`). */
  driver: (orderId: string): string => `refund_clawback_driver_${orderId}`,
  /** `vendorOrderId` — `food_orders.id` / `market_orders.id`. */
  vendor: (vendorOrderId: string): string => `refund_clawback_vendor_${vendorOrderId}`,
} as const;

export type ClawbackRole = 'driver' | 'vendor';

export interface RefundClawbackEntry {
  userId: string;
  role: ClawbackRole;
  amount: number;
  tag: string;
  /** Push/hodisadagi buyurtma id'si (taksi/kuryer safari yoki sotuvchi buyurtmasi). */
  orderId: string;
}

interface ClawbackParty {
  role: ClawbackRole;
  userId: string;
  /** Ulush qaysi buyurtma bo'yicha (push `orderId`, haydovchi uchun daftar `order_id`). */
  orderId: string;
  /** Sotuvchi: tovar CREDIT va komissiya DEBIT belgilari. */
  vendorTags?: { credit: string; commission: string };
  auditTarget: { type: 'order' | 'food_order' | 'market_order'; id: string };
}

interface RefundPlan {
  parties: ClawbackParty[];
  /** Fiskal qaytarish cheki yoziladigan buyurtmalar (asl sotuv cheki bo'yicha). */
  fiscalOrderIds: string[];
}

const PG_UNIQUE_VIOLATION = '23505';
/** Haydovchi safar oyoqlari (`orders-completion.service.ts`): yo'l haqi CREDIT, komissiya va soliq DEBIT. */
const DRIVER_DEBIT_TAGS: readonly string[] = ['commission', TAX_WITHHOLDING_LEDGER_TAG];

/**
 * To'langan karta buyurtmasi provayder orqali QAYTARILDI (Payme
 * CancelTransaction state 2 → −2, UZPS CANCELLED) — biznes qarori
 * (2026-10-15, docs/LEGAL-COMPLIANCE.md §23):
 *
 *  · haydovchi/kuryer hamyoniga ALLAQACHON ochilgan sof ulush (yo'l haqi −
 *    komissiya − soliq) va sotuvchiga tushgan sof ulush (tovar − komissiya)
 *    hamyondan DEBIT bilan qaytarib olinadi — `refund_clawback_<rol>_<id>`,
 *    bir martalik (oldindan tekshiruv + unikal indeks);
 *  · hali ochilmagan (PENDING) oyoqlar `refunded` bo'ladi — hech qachon
 *    yechib olinadigan pulga aylanmaydi, DEBIT kerak emas;
 *  · `drivers.balance` sinxroni; manfiyga tushsa oflayn (mavjud qoida, §13);
 *  · amallar jurnali (`payment.refund_clawback`, tizim amali) — pul harakati
 *    bilan BITTA tranzaksiyada; commit'dan keyin push + `wallet:updated`;
 *  · fiskal qaytarish cheki (asl sotuv chekiga bog'langan).
 *
 * Hech qachon `throw` qilmaydi — chaqiruvchi provayder callback'i.
 */
@Injectable()
export class OrderRefundClawbackService {
  private readonly logger = new Logger(OrderRefundClawbackService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly auditLog: AuditLogService,
    @Optional() private readonly driversService?: DriversService,
    @Optional() private readonly notifier?: WalletNotifierService,
    @Optional() private readonly fiscal?: FiscalReceiptsService,
  ) {}

  /** `paymentRef` — karta to'lovi nishoni: taksi `orders.id` yoki `food_orders.id` / `market_orders.id`. */
  async clawbackForRefundedPayment(paymentRef: string, providerExternalId: string): Promise<RefundClawbackEntry[]> {
    let plan: RefundPlan;
    try {
      plan = await this.plan(paymentRef);
    } catch (err) {
      this.logger.error(`Refund clawback: ${paymentRef} rejasi tuzilmadi: ${(err as Error).message}`);
      return [];
    }

    const entries: RefundClawbackEntry[] = [];
    for (const party of plan.parties) {
      const entry = await this.clawbackParty(party, providerExternalId);
      if (entry) entries.push(entry);
    }
    for (const orderId of plan.fiscalOrderIds) {
      await this.fiscal?.recordOrderRefund(orderId);
    }
    return entries;
  }

  // ------------------------------------------------------------- ichki

  private async plan(paymentRef: string): Promise<RefundPlan> {
    const manager = this.dataSource.manager;
    const taxi = await manager.findOne(Order, { where: { id: paymentRef } });
    if (taxi) {
      return {
        parties: taxi.driverId ? [this.driverParty(taxi.id, taxi.driverId, { type: 'order', id: taxi.id })] : [],
        fiscalOrderIds: [taxi.id],
      };
    }

    const food = await manager.findOne(FoodOrder, { where: { id: paymentRef } });
    if (food) {
      const restaurant = await manager.findOne(Restaurant, { where: { id: food.restaurantId } });
      return this.vendorPlan('food', food.id, restaurant?.ownerUserId ?? null, food.deliveryOrderId ?? null);
    }

    const market = await manager.findOne(MarketOrder, { where: { id: paymentRef } });
    if (market) {
      const store = await manager.findOne(Store, { where: { id: market.storeId } });
      return this.vendorPlan('market', market.id, store?.ownerUserId ?? null, market.deliveryOrderId ?? null);
    }
    return { parties: [], fiscalOrderIds: [] };
  }

  private async vendorPlan(
    kind: 'food' | 'market',
    vendorOrderId: string,
    ownerUserId: string | null,
    deliveryOrderId: string | null,
  ): Promise<RefundPlan> {
    const auditTarget = { type: kind === 'food' ? 'food_order' : 'market_order', id: vendorOrderId } as const;
    const parties: ClawbackParty[] = [];
    if (ownerUserId) {
      // Belgilar `food.service` / `market.service` dagi `settle*Earnings` bilan bir xil.
      parties.push({
        role: 'vendor',
        userId: ownerUserId,
        orderId: vendorOrderId,
        vendorTags: {
          credit: `${kind}_order_${vendorOrderId}`,
          commission: `${kind}_order_commission_${vendorOrderId}`,
        },
        auditTarget,
      });
    }
    const fiscalOrderIds = [vendorOrderId];
    if (deliveryOrderId) {
      const ride = await this.dataSource.manager.findOne(Order, { where: { id: deliveryOrderId } });
      if (ride?.driverId) parties.push(this.driverParty(ride.id, ride.driverId, auditTarget));
      fiscalOrderIds.push(deliveryOrderId);
    }
    return { parties, fiscalOrderIds };
  }

  private driverParty(orderId: string, driverUserId: string, auditTarget: ClawbackParty['auditTarget']): ClawbackParty {
    return { role: 'driver', userId: driverUserId, orderId, auditTarget };
  }

  private tagFor(party: ClawbackParty): string {
    return party.role === 'driver'
      ? REFUND_CLAWBACK_TAG.driver(party.orderId)
      : REFUND_CLAWBACK_TAG.vendor(party.orderId);
  }

  private async clawbackParty(party: ClawbackParty, providerExternalId: string): Promise<RefundClawbackEntry | null> {
    const tag = this.tagFor(party);
    let wentOfflineDriverId: string | null = null;
    let amount = 0;
    try {
      amount = await this.dataSource.transaction(async (manager: EntityManager) => {
        await lockWalletForUpdate(manager, party.userId);
        const ledger = manager.getRepository(Transaction);
        if (await ledger.findOne({ where: { externalId: tag } })) return 0;

        const share =
          party.role === 'driver'
            ? await this.driverShare(ledger, party)
            : await this.vendorShare(ledger, party);
        if (share <= 0) return 0;

        await ledger.save({
          userId: party.userId,
          orderId: party.role === 'driver' ? party.orderId : null,
          amount: share,
          type: TransactionType.DEBIT,
          paymentMethod: PaymentMethod.CARD,
          status: TransactionStatus.COMPLETED,
          externalId: tag,
        });
        const synced = await syncDriverBalanceColumn(manager, party.userId);
        if (synced.wentOffline) wentOfflineDriverId = synced.driverId;
        await this.auditLog.record(
          {
            actorUserId: null,
            action: AUDIT_ACTIONS.paymentRefundClawback,
            targetType: party.auditTarget.type,
            targetId: party.auditTarget.id,
            amount: share,
            note: 'Karta to‘lovi provayder orqali qaytarildi — ulush hamyondan qaytarib olindi',
            metadata: {
              userId: party.userId,
              role: party.role,
              orderId: party.orderId,
              ledgerTag: tag,
              providerExternalId,
              balanceAfter: synced.driverId ? synced.balance : null,
              wentOffline: synced.wentOffline,
            },
          },
          manager,
        );
        return share;
      });
    } catch (err) {
      if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION) return null; // parallel callback
      this.logger.error(`Refund clawback ${tag} bajarilmadi: ${(err as Error).message}`, (err as Error).stack);
      return null;
    }
    if (amount <= 0) return null;

    this.logger.warn(`Refund clawback: ${party.role} ${party.userId} −${amount} so'm (${tag})`);
    if (wentOfflineDriverId) {
      await this.driversService?.takeOfflineInRedis(wentOfflineDriverId, 'balance went negative after refund clawback');
    }
    await this.notifier?.balanceChanged(party.userId, {
      delta: -amount,
      reason: 'refund_clawback',
      push: {
        text: localized({
          uz: {
            title: "To'lov mijozga qaytarildi",
            body:
              party.role === 'driver'
                ? `Safar uchun karta to'lovi mijozga qaytarildi — ulushingiz ${formatSom(amount)} so'm hamyondan qaytarib olindi`
                : `Buyurtma uchun karta to'lovi mijozga qaytarildi — ${formatSom(amount)} so'm hisobingizdan qaytarib olindi`,
          },
          ru: {
            title: 'Платёж возвращён клиенту',
            body:
              party.role === 'driver'
                ? `Оплата картой за поездку возвращена клиенту — ваша доля ${formatSom(amount)} сум списана с кошелька`
                : `Оплата картой за заказ возвращена клиенту — ${formatSom(amount)} сум списано с вашего счёта`,
          },
        }),
        event: 'payment_refund_clawback',
      },
      extra: { orderId: party.orderId },
    });
    return { userId: party.userId, role: party.role, amount, tag, orderId: party.orderId };
  }

  /**
   * Haydovchining shu safardagi KARTA oyoqlari: COMPLETED — ochilgan sof ulush
   * (yo'l haqi − komissiya − soliq); PENDING — hali ochilmagan, `refunded`
   * qilinadi (endi hech qachon ochilmaydi). Chaqiq (tips) hamyondan to'langan —
   * karta qaytarimiga kirmaydi.
   */
  private async driverShare(
    ledger: ReturnType<EntityManager['getRepository']>,
    party: ClawbackParty,
  ): Promise<number> {
    const legs = (await ledger.find({
      where: { orderId: party.orderId, userId: party.userId, paymentMethod: PaymentMethod.CARD },
    })) as Transaction[];
    const isFare = (row: Transaction) => row.type === TransactionType.CREDIT && row.externalId == null;
    const isDeduction = (row: Transaction) =>
      row.type === TransactionType.DEBIT && DRIVER_DEBIT_TAGS.includes(row.externalId ?? '');
    const payoutLegs = legs.filter((row) => isFare(row) || isDeduction(row));

    let share = 0;
    for (const row of payoutLegs) {
      if (row.status === TransactionStatus.COMPLETED) {
        share += (isFare(row) ? 1 : -1) * Number(row.amount);
      } else if (row.status === TransactionStatus.PENDING) {
        await ledger.update({ id: row.id, status: TransactionStatus.PENDING }, { status: TransactionStatus.REFUNDED });
      }
    }
    return Math.round(share * 100) / 100;
  }

  /** Sotuvchiga tushgan sof ulush: `<kind>_order_<id>` CREDIT − `<kind>_order_commission_<id>` DEBIT. */
  private async vendorShare(
    ledger: ReturnType<EntityManager['getRepository']>,
    party: ClawbackParty,
  ): Promise<number> {
    if (!party.vendorTags) return 0;
    const rows = (await ledger.find({
      where: {
        userId: party.userId,
        externalId: In([party.vendorTags.credit, party.vendorTags.commission]),
        status: TransactionStatus.COMPLETED,
      },
    })) as Transaction[];
    const credit = rows
      .filter((row) => row.externalId === party.vendorTags?.credit && row.type === TransactionType.CREDIT)
      .reduce((sum, row) => sum + Number(row.amount), 0);
    // Faqat karta buyurtmasida CREDIT bor; naqd buyurtmada faqat komissiya — ulush yo'q.
    if (credit <= 0) return 0;
    const commission = rows
      .filter((row) => row.externalId === party.vendorTags?.commission && row.type === TransactionType.DEBIT)
      .reduce((sum, row) => sum + Number(row.amount), 0);
    return Math.round((credit - commission) * 100) / 100;
  }
}
