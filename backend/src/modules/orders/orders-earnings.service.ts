// Driver-facing earnings aggregates (GET /orders/earnings/*): today's gross
// revenue, and the today / last-7-days / last-30-days breakdown
// (gross / commission / withheld tax / shift passes / net). Read-only analytics over the orders + transactions ledger — it
// never computes commission itself, only sums what completion already booked.
import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { DriverEarningsBreakdown, DriverEarningsPeriod } from './orders.types';
import { TAX_WITHHOLDING_LEDGER_TAG } from '../tax/tax-withholding';
import { ShiftPassesService } from '../shift-passes/shift-passes.service';

/**
 * Haydovchining bitta safardagi yalpi yo'l haqi. Taksi promo kodini platforma
 * to'laydi (LEGAL-COMPLIANCE §26a): `final_price` — yo'lovchi to'lagani,
 * chegirma esa haydovchiga alohida qoplanadi, shuning uchun yalpi daromad
 * chegirmagacha bo'lgan summa.
 */
export const DRIVER_GROSS_FARE_SQL =
  'COALESCE(o.final_price, o.estimated_price) + COALESCE(o.discount_amount, 0)';

@Injectable()
export class OrdersEarningsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    // Ixtiyoriy: yo'q bo'lsa smena narxi 0 (eski wiring'dagi spec'lar).
    @Optional() private readonly shiftPasses?: ShiftPassesService,
  ) {}

  async getDriverEarningsToday(driverId: string): Promise<{ today: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const revenueResult = await this.orderRepository
      .createQueryBuilder('o')
      .select('SUM(o.final_price)', 'total')
      .where('o.driver_id = :driverId', { driverId })
      .andWhere('o.status = :s', { s: 'completed' })
      .andWhere('o.created_at >= :d', { d: today })
      .getRawOne<{ total: string }>();

    return { today: parseFloat(revenueResult?.total ?? '0') || 0 };
  }

  async getDriverEarningsBreakdown(driverId: string): Promise<DriverEarningsBreakdown> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // "This week" = last 7 days including today; "this month" = last 30 days
    // including today (rolling windows, not calendar week/month).
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);

    const startOfMonth = new Date(startOfToday);
    startOfMonth.setDate(startOfMonth.getDate() - 29);

    const [today, week, month] = await Promise.all([
      this.getDriverEarningsForPeriod(driverId, startOfToday),
      this.getDriverEarningsForPeriod(driverId, startOfWeek),
      this.getDriverEarningsForPeriod(driverId, startOfMonth),
    ]);

    return { today, week, month };
  }

  private async getDriverEarningsForPeriod(
    driverId: string,
    from: Date,
  ): Promise<DriverEarningsPeriod> {
    // Commission per trip is already computed and persisted as a DEBIT
    // transaction at completion time (see completeTrip), so sum that ledger
    // entry directly rather than recomputing from the driver's current
    // commission rate (which may have changed since the trip happened).
    //
    // Withheld tax is joined the same way (its own `tax_withholding` row per
    // order). Both joins match at most one row per order (tax: unique index;
    // commission: one row written per completion), so SUM over the join does
    // not multiply the gross.
    const result = await this.orderRepository
      .createQueryBuilder('o')
      .leftJoin(
        Transaction,
        't',
        't.order_id = o.id AND t.user_id = o.driver_id AND t.external_id = :commissionExternalId',
        { commissionExternalId: 'commission' },
      )
      .leftJoin(
        Transaction,
        'tx',
        'tx.order_id = o.id AND tx.user_id = o.driver_id AND tx.external_id = :taxExternalId',
        { taxExternalId: TAX_WITHHOLDING_LEDGER_TAG },
      )
      .select(`COALESCE(SUM(${DRIVER_GROSS_FARE_SQL}), 0)`, 'gross')
      .addSelect('COALESCE(SUM(t.amount), 0)', 'commission')
      .addSelect('COALESCE(SUM(tx.amount), 0)', 'tax')
      // Chaqiq (tips) — buyurtmaning o'z ustuni (har buyurtmada bitta qiymat;
      // yuqoridagi join'lar buyurtma qatorini ko'paytirmaydi).
      .addSelect('COALESCE(SUM(o.tip_amount), 0)', 'tips')
      .addSelect('COUNT(DISTINCT o.id)', 'trips')
      .where('o.driver_id = :driverId', { driverId })
      .andWhere('o.status = :s', { s: OrderStatus.COMPLETED })
      .andWhere('o.created_at >= :from', { from })
      .getRawOne<{ gross: string; commission: string; tax?: string; tips?: string; trips: string }>();

    const gross = parseFloat(result?.gross ?? '0') || 0;
    const commission = parseFloat(result?.commission ?? '0') || 0;
    const taxWithheld = parseFloat(result?.tax ?? '0') || 0;
    const trips = parseInt(result?.trips ?? '0', 10) || 0;
    const tips = parseFloat(result?.tips ?? '0') || 0;
    const shiftPassCost = this.shiftPasses ? await this.shiftPasses.totalCostSince(driverId, from) : 0;

    const net = gross - commission - taxWithheld - shiftPassCost;
    return {
      gross,
      commission,
      taxWithheld,
      shiftPassCost,
      // `net` — yo'l haqidan sof daromad; chaqiq KIRMAYDI (eski ma'no saqlangan).
      net,
      trips,
      // Chaqiq hamyonga to'liq (komissiyasiz, soliqsiz) tushadi — alohida.
      tips,
      netWithTips: net + tips,
    };
  }
}
