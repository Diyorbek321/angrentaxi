import { FinanceSnapshot, netRevenue } from './finance-report.types';

/** Shundan ko'p pasayish — ogohlantirish (0.3 = 30%). */
const DROP_THRESHOLD = 0.3;
/** Bekor qilish ulushi shundan yuqori bo'lsa — ogohlantirish. */
const CANCEL_RATE_THRESHOLD = 0.25;
/** Bekor qilish ulushini shuncha buyurtmadan kam bo'lsa baholamaymiz. */
const CANCEL_RATE_MIN_ORDERS = 20;

export function formatSom(value: number): string {
  const rounded = Math.round(value);
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return rounded < 0 ? `−${grouped}` : grouped;
}

function dropPercent(current: number, baseline: number): number | null {
  if (baseline <= 0) return null;
  const drop = (baseline - current) / baseline;
  return drop >= DROP_THRESHOLD ? Math.round(drop * 100) : null;
}

/**
 * Egasi e'tibor berishi kerak bo'lgan narsalar. `baseline` — shu uzunlikdagi
 * davr uchun o'rtacha (masalan, oldingi 7 kunning bir kunlik o'rtachasi);
 * `null` bo'lsa taqqoslash qilinmaydi.
 */
export function financeAlerts(current: FinanceSnapshot, baseline: FinanceSnapshot | null): string[] {
  const alerts: string[] = [];
  const net = netRevenue(current);

  if (baseline) {
    const ridesDrop = dropPercent(current.rides.completed, baseline.rides.completed);
    if (ridesDrop !== null) {
      alerts.push(
        `Safarlar odatdagidan ${ridesDrop}% kam (${current.rides.completed} ta, o'rtacha ${Math.round(baseline.rides.completed)} ta)`,
      );
    }
    const baselineNet = netRevenue(baseline);
    const netDrop = dropPercent(net, baselineNet);
    if (netDrop !== null) {
      alerts.push(
        `Sof daromad odatdagidan ${netDrop}% kam (${formatSom(net)}, o'rtacha ${formatSom(baselineNet)} so'm)`,
      );
    }
  }

  if (net < 0) {
    alerts.push(`Platforma zarar bilan ishladi: ${formatSom(net)} so'm — promo/bonus xarajatini tekshiring`);
  }

  const orders = current.rides.completed + current.rides.cancelled;
  if (orders >= CANCEL_RATE_MIN_ORDERS && current.rides.cancelled / orders > CANCEL_RATE_THRESHOLD) {
    alerts.push(
      `Buyurtmalarning ${Math.round((current.rides.cancelled / orders) * 100)}% bekor qilindi — haydovchi yetishmayaptimi?`,
    );
  }

  const b = current.balances;
  if (b.pendingWithdrawalsCount > 0) {
    alerts.push(
      `${b.pendingWithdrawalsCount} ta pul yechish so'rovi kutyapti (${formatSom(b.pendingWithdrawals)} so'm) — admin panel → To'lovlar`,
    );
  }

  return alerts;
}

export function formatFinanceReport(
  title: string,
  s: FinanceSnapshot,
  baseline: FinanceSnapshot | null,
): string {
  const r = s.revenue;
  const c = s.costs;
  const costs = c.ridePromos + c.referralBonuses + c.driverBonuses;
  const alerts = financeAlerts(s, baseline);

  const lines = [
    `📊 <b>${title}</b>`,
    '',
    `💰 <b>Platforma sof daromadi: ${formatSom(netRevenue(s))} so'm</b>`,
    `  ▸ Taksi komissiyasi: ${formatSom(r.rideCommission)}`,
    `  ▸ Ovqat/market komissiyasi: ${formatSom(r.vendorCommission)}`,
    `  ▸ Smena passlari (${r.shiftPassesSold} ta): ${formatSom(r.shiftPassRevenue)}`,
    ...(r.shiftPassRefunds > 0 ? [`  ▸ Qaytarilgan passlar: ${formatSom(-r.shiftPassRefunds)}`] : []),
    `  ▸ Promo va bonuslar: ${formatSom(-costs)}`,
    '',
    `🚕 <b>Safarlar: ${s.rides.completed} ta</b> (bekor: ${s.rides.cancelled})`,
    `  Aylanma ${formatSom(s.rides.gross)} · naqd ${formatSom(s.rides.cash)} · karta ${formatSom(s.rides.card)} · hamyon ${formatSom(s.rides.wallet)}`,
    `🍔 Ovqat: ${s.vendors.foodDelivered} ta · ${formatSom(s.vendors.foodGross)}   🛒 Market: ${s.vendors.marketDelivered} ta · ${formatSom(s.vendors.marketGross)}`,
    '',
    `💳 Hamyonga to'ldirildi: ${formatSom(s.cashFlow.walletTopups)} · haydovchilarga to'landi: ${formatSom(s.cashFlow.withdrawalsPaid)}`,
    '',
    '📌 <b>Hozirgi holat</b>',
    `  Haydovchilarga qarzimiz: ${formatSom(s.balances.owedToDrivers)}`,
    `  Haydovchilarning platformaga qarzi: ${formatSom(s.balances.driversDebt)}`,
    '',
    ...(alerts.length > 0
      ? ['⚠️ <b>Diqqat</b>', ...alerts.map((a) => `  • ${a}`)]
      : ["✅ Hamma ko'rsatkich me'yorida."]),
  ];
  return lines.join('\n');
}
