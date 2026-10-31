import { FraudSnapshot, SuspiciousPair } from './fraud-report.types';
import { escapeHtml, formatWait } from './html';

/** "O'ziga o'zi zakaz" navbatidagi safar shundan uzoq kutsa — bonus qarori kechikyapti. */
const REVIEW_WAIT_ALERT_HOURS = 48;
const LIST_LIMIT = 5;

const pairLabel = (p: SuspiciousPair): string =>
  `${escapeHtml(p.driverName)} ↔ ${escapeHtml(p.passengerName)}`;

export function fraudAlerts(s: FraudSnapshot): string[] {
  const alerts: string[] = [];

  if (s.drivers.length > 0) {
    alerts.push(
      `${s.drivers.length} ta haydovchi buyurtmani qabul qilib bekor qilishni ko'p qilyapti — qo'ng'iroq qilib sababini so'rash kerak`,
    );
  }
  if (s.cancelPairs.length > 0) {
    alerts.push(
      `${s.cancelPairs.length} ta juftlik (haydovchi + yo'lovchi) bir-biri bilan qayta-qayta bekor qilyapti — ilovasiz kelishish belgisi`,
    );
  }
  if (s.lostRegulars.length > 0) {
    alerts.push(
      `${s.lostRegulars.length} ta doimiy mijoz o'z haydovchisi bilan ilovada yurmay qo'ydi, haydovchi esa ishlayapti — yo'lovchiga qo'ng'iroq qilib so'rash kerak`,
    );
  }
  const r = s.selfOrderReview;
  if (r.pending > 0 && r.oldestPendingHours !== null && r.oldestPendingHours >= REVIEW_WAIT_ALERT_HOURS) {
    alerts.push(
      `${r.pending} ta shubhali safar menejer qarorini kutyapti, eng eskisi ${formatWait(r.oldestPendingHours)} — menejer paneli → Shubhali safarlar`,
    );
  }
  return alerts;
}

export function formatFraudReport(title: string, s: FraudSnapshot): string {
  const c = s.cancellations;
  const alerts = fraudAlerts(s);
  const list = <T>(items: T[], line: (item: T) => string): string[] => [
    ...items.slice(0, LIST_LIMIT).map((i) => `  ${line(i)}`),
    ...(items.length > LIST_LIMIT ? [`  … yana ${items.length - LIST_LIMIT} ta`] : []),
  ];

  const lines = [
    `🛡 <b>${title}</b>`,
    '',
    `❌ Qabul qilingach bekor: ${c.afterAccept} · yetib kelgach bekor: ${c.afterArrival}` +
      (c.afterArrival > 0 ? ` (haydovchi ${c.afterArrivalByDriver}, yo'lovchi ${c.afterArrivalByPassenger})` : ''),
    `🔎 O'ziga o'zi zakaz shubhasi: ${s.selfOrderReview.flaggedInPeriod} · navbatda: ${s.selfOrderReview.pending}`,
    ...(s.drivers.length > 0
      ? [
          '',
          "🚗 <b>Ko'p bekor qiladigan haydovchilar</b>",
          ...list(
            s.drivers,
            (d) =>
              `${escapeHtml(d.name)} — ${d.cancelledAfterAccept}/${d.accepted} bekor, ${d.cancelledAfterArrival} tasi yetib kelgach`,
          ),
        ]
      : []),
    ...(s.cancelPairs.length > 0
      ? ['', '🔁 <b>Birga bekor qiladigan juftliklar</b>', ...list(s.cancelPairs, (p) => `${pairLabel(p)} — ${p.cancelledTogether} marta`)]
      : []),
    ...(s.lostRegulars.length > 0
      ? [
          '',
          "👻 <b>Yo'qolgan doimiy mijozlar</b>",
          ...list(
            s.lostRegulars,
            (p) => `${pairLabel(p)} — ${p.completedTogether} safar, ${p.daysSinceLastTrip} kundan beri yo'q`,
          ),
        ]
      : []),
    '',
    ...(alerts.length > 0
      ? ['⚠️ <b>Diqqat</b>', ...alerts.map((a) => `  • ${a}`), '', "<i>Belgilar — ayblov emas: avval odam bilan gaplashing.</i>"]
      : ["✅ Shubhali holat yo'q."]),
  ];
  return lines.join('\n');
}
