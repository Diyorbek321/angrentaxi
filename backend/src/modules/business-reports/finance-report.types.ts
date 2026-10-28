/**
 * Bir davr (kun yoki hafta) uchun moliyaviy surat. Hammasi so'mda, butun son.
 * Manbalar — `finance-report.service.ts` dagi SQL izohlarida.
 */
export interface FinanceSnapshot {
  /** Tashkent mahalliy sanalari, `to` kirmaydi: [from, to). */
  period: { from: string; to: string };

  rides: {
    completed: number;
    cancelled: number;
    /** Yo'lovchilar to'lagan jami summa (`final_price`). */
    gross: number;
    cash: number;
    card: number;
    wallet: number;
  };

  vendors: {
    foodDelivered: number;
    foodGross: number;
    marketDelivered: number;
    marketGross: number;
  };

  /** Platforma daromadi. */
  revenue: {
    rideCommission: number;
    vendorCommission: number;
    shiftPassesSold: number;
    shiftPassRevenue: number;
    shiftPassRefunds: number;
  };

  /** Platforma o'z cho'ntagidan bergan pul. */
  costs: {
    ridePromos: number;
    referralBonuses: number;
    driverBonuses: number;
  };

  cashFlow: {
    walletTopups: number;
    withdrawalsPaid: number;
  };

  /** Davr oxiridagi emas, HOZIRGI holat (kesh balans). */
  balances: {
    owedToDrivers: number;
    driversDebt: number;
    pendingWithdrawals: number;
    pendingWithdrawalsCount: number;
  };
}

/** Platformaning sof daromadi = daromad − platforma xarajati. */
export function netRevenue(s: FinanceSnapshot): number {
  const r = s.revenue;
  const c = s.costs;
  return (
    r.rideCommission +
    r.vendorCommission +
    r.shiftPassRevenue -
    r.shiftPassRefunds -
    c.ridePromos -
    c.referralBonuses -
    c.driverBonuses
  );
}
