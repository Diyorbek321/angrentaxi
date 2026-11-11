import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FinanceSnapshot } from './finance-report.types';
import { ReportPeriod, addDays, periodDays } from './report-period';
import { LOCAL, RIDE_SERVICE_TYPES, SUM, TZ } from './report-sql';

@Injectable()
export class FinanceReportService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async snapshot(period: ReportPeriod): Promise<FinanceSnapshot> {
    const params = [period.from, period.to];
    const [rides, vendors, ledger, passes, flow, balances] = await Promise.all([
      this.one(
        `SELECT
           (COUNT(*) FILTER (WHERE status = 'completed' AND ${LOCAL('completed_at')}))::int AS completed,
           (COUNT(*) FILTER (WHERE status = 'cancelled' AND ${LOCAL('created_at')}))::int AS cancelled,
           ${SUM(`final_price`, `status = 'completed' AND ${LOCAL('completed_at')}`)} AS gross,
           ${SUM(`final_price`, `status = 'completed' AND payment_method = 'cash' AND ${LOCAL('completed_at')}`)} AS cash,
           ${SUM(`final_price`, `status = 'completed' AND payment_method = 'card' AND ${LOCAL('completed_at')}`)} AS card,
           ${SUM(`final_price`, `status = 'completed' AND payment_method = 'wallet' AND ${LOCAL('completed_at')}`)} AS wallet
         FROM orders
         WHERE service_type IN ${RIDE_SERVICE_TYPES}
           AND (${LOCAL('completed_at')} OR ${LOCAL('created_at')})`,
        params,
      ),
      this.one(
        `SELECT
           (SELECT COUNT(*)::int FROM food_orders WHERE status = 'delivered' AND ${LOCAL('created_at')}) AS food_delivered,
           (SELECT ${SUM('total_price')} FROM food_orders WHERE status = 'delivered' AND ${LOCAL('created_at')}) AS food_gross,
           (SELECT COUNT(*)::int FROM market_orders WHERE status = 'delivered' AND ${LOCAL('created_at')}) AS market_delivered,
           (SELECT ${SUM('total_price')} FROM market_orders WHERE status = 'delivered' AND ${LOCAL('created_at')}) AS market_gross`,
        params,
      ),
      // Hamyon daftari — har harakat `external_id` belgisidan taniladi
      // (payments/wallet-balance.util.ts). Faqat COMPLETED qatorlar.
      this.one(
        `SELECT
           ${SUM(`amount`, `type = 'debit' AND external_id = 'commission'`)} AS ride_commission,
           ${SUM(
             `CASE WHEN type = 'debit' THEN amount ELSE -amount END`,
             `external_id LIKE 'food\\_order\\_commission\\_%' OR external_id LIKE 'market\\_order\\_commission\\_%'
               OR external_id LIKE 'vendor\\_settlement\\_commission\\_%'
               OR external_id LIKE 'vendor\\_settlement\\_reversal\\_commission\\_%'`,
           )} AS vendor_commission,
           ${SUM(`amount`, `type = 'credit' AND external_id LIKE 'ride\\_promo\\_%'`)} AS ride_promos,
           ${SUM(`amount`, `type = 'credit' AND external_id LIKE 'referral\\_bonus\\_%'`)} AS referral_bonuses,
           ${SUM(`amount`, `type = 'credit' AND (bonus_rule_id IS NOT NULL OR external_id IN ('fare_bonus', 'tip_bonus'))`)} AS driver_bonuses
         FROM transactions
         WHERE status = 'completed' AND ${LOCAL('created_at')}`,
        params,
      ),
      this.one(
        `SELECT
           (COUNT(*) FILTER (WHERE status <> 'cancelled' AND ${TZ('created_at')}))::int AS sold,
           ${SUM(`price`, `status <> 'cancelled' AND ${TZ('created_at')}`)} AS revenue,
           ${SUM(`refund_amount`, `${TZ('cancelled_at')}`)} AS refunds
         FROM driver_shift_passes
         WHERE ${TZ('created_at')} OR ${TZ('cancelled_at')}`,
        params,
      ),
      this.one(
        `SELECT
           (SELECT ${SUM('amount')} FROM wallet_topups WHERE status = 'paid' AND ${TZ('paid_at')}) AS topups,
           (SELECT ${SUM('amount')} FROM withdrawal_requests WHERE status = 'paid' AND ${LOCAL('processed_at')}) AS withdrawals_paid`,
        params,
      ),
      this.one(
        `SELECT
           (SELECT ${SUM('GREATEST(balance, 0)')} FROM drivers) AS owed_to_drivers,
           (SELECT ${SUM('GREATEST(-balance, 0)')} FROM drivers) AS drivers_debt,
           (SELECT ${SUM('amount')} FROM withdrawal_requests WHERE status IN ('pending', 'approved')) AS pending_withdrawals,
           (SELECT COUNT(*)::int FROM withdrawal_requests WHERE status IN ('pending', 'approved')) AS pending_withdrawals_count`,
        [],
      ),
    ]);

    return {
      period,
      rides: {
        completed: rides.completed,
        cancelled: rides.cancelled,
        gross: rides.gross,
        cash: rides.cash,
        card: rides.card,
        wallet: rides.wallet,
      },
      vendors: {
        foodDelivered: vendors.food_delivered,
        foodGross: vendors.food_gross,
        marketDelivered: vendors.market_delivered,
        marketGross: vendors.market_gross,
      },
      revenue: {
        rideCommission: ledger.ride_commission,
        vendorCommission: ledger.vendor_commission,
        shiftPassesSold: passes.sold,
        shiftPassRevenue: passes.revenue,
        shiftPassRefunds: passes.refunds,
      },
      costs: {
        ridePromos: ledger.ride_promos,
        referralBonuses: ledger.referral_bonuses,
        driverBonuses: ledger.driver_bonuses,
      },
      cashFlow: {
        walletTopups: flow.topups,
        withdrawalsPaid: flow.withdrawals_paid,
      },
      balances: {
        owedToDrivers: balances.owed_to_drivers,
        driversDebt: balances.drivers_debt,
        pendingWithdrawals: balances.pending_withdrawals,
        pendingWithdrawalsCount: balances.pending_withdrawals_count,
      },
    };
  }

  /**
   * Taqqoslash asosi: `period` dan oldingi `weeks` ta shu uzunlikdagi davrning
   * o'rtachasi (kunlik hisobot uchun — oldingi 7 kun, kun bo'yicha o'rtacha).
   */
  async baseline(period: ReportPeriod, samples = 7): Promise<FinanceSnapshot> {
    const days = periodDays(period);
    const from = addDays(period.from, -days * samples);
    const total = await this.snapshot({ from, to: period.from });
    return scaleSnapshot(total, 1 / samples);
  }

  private async one(sql: string, params: string[]): Promise<Record<string, number>> {
    const rows = (await this.dataSource.query(sql, params)) as Array<Record<string, number>>;
    return rows[0];
  }
}

/** Oqim ko'rsatkichlarini ko'paytiradi; joriy balanslar o'zgarmaydi. */
export function scaleSnapshot(s: FinanceSnapshot, factor: number): FinanceSnapshot {
  const scale = <T extends Record<string, number>>(o: T): T =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v * factor])) as T;
  return {
    ...s,
    rides: scale(s.rides),
    vendors: scale(s.vendors),
    revenue: scale(s.revenue),
    costs: scale(s.costs),
    cashFlow: scale(s.cashFlow),
  };
}
