import { DriverBrief, SupplySnapshot, fulfilmentRate } from './supply-report.types';

/** Bajarilish shundan past bo'lsa — haydovchi yetishmayapti. */
const FULFILMENT_THRESHOLD = 85;
/** Bajarilishni shuncha buyurtmadan kam bo'lsa baholamaymiz. */
const FULFILMENT_MIN_ORDERS = 20;
/** KYC arizasi shundan uzoq kutsa — haydovchi boshqa platformaga ketishi mumkin. */
const KYC_WAIT_ALERT_HOURS = 24;
/** Telegram'da ro'yxatdan ko'pi bilan shuncha nom. */
const LIST_LIMIT = 5;

const pad = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Haydovchilar bo'limi egasi e'tibor berishi kerak bo'lgan narsalar. */
export function supplyAlerts(s: SupplySnapshot): string[] {
  const alerts: string[] = [];

  const rate = fulfilmentRate(s);
  if (rate !== null && s.demand.orders >= FULFILMENT_MIN_ORDERS && rate < FULFILMENT_THRESHOLD) {
    const worst = s.demand.shortageHours[0];
    alerts.push(
      `Buyurtmalarning faqat ${rate}% bajarildi` +
        (worst ? ` — eng og'ir soat ${pad(worst.hour)} (${worst.unmet} ta haydovchisiz)` : '') +
        '. Shu soatga haydovchi chiqarish kerak',
    );
  }

  const { kycPending, kycOldestHours } = s.queue;
  if (kycPending > 0 && kycOldestHours !== null && kycOldestHours >= KYC_WAIT_ALERT_HOURS) {
    alerts.push(
      `${kycPending} ta haydovchi hujjat tasdig'ini kutyapti, eng eskisi ${kycOldestHours} soat — admin panel → Tasdiqlash`,
    );
  }

  if (s.drivers.negativeBalance > 0) {
    alerts.push(
      `${s.drivers.negativeBalance} ta haydovchi balansi manfiy — tizim ularni ishga chiqarmaydi. Qarzni to'lashga eslatish kerak`,
    );
  }

  if (s.churning.length > 0) {
    alerts.push(`${s.churning.length} ta haydovchi 7+ kundan beri ishlamayapti — qo'ng'iroq qilib sababini bilish kerak`);
  }

  return alerts;
}

const brief = (d: DriverBrief, suffix: string): string => `  ${escapeHtml(d.name)} — ${suffix}`;

export function formatSupplyReport(title: string, s: SupplySnapshot): string {
  const rate = fulfilmentRate(s);
  const unmet = s.demand.noDriverFound + s.demand.passengerGaveUp;
  const alerts = supplyAlerts(s);
  const d = s.drivers;

  const lines = [
    `🚗 <b>${title}</b>`,
    '',
    `📦 <b>Bajarildi: ${rate === null ? '—' : `${rate}%`}</b> (${s.demand.completed} / ${s.demand.orders} buyurtma)`,
    `  Haydovchi topilmadi: ${s.demand.noDriverFound} · yo'lovchi kutib ketdi: ${s.demand.passengerGaveUp}`,
    ...(unmet > 0 && s.demand.shortageHours.length > 0
      ? [
          `  Og'ir soatlar: ${s.demand.shortageHours
            .map((h) => `${pad(h.hour)} (${h.unmet}/${h.orders})`)
            .join(', ')}`,
        ]
      : []),
    '',
    `👥 <b>Faol haydovchilar: ${s.activity.activeDrivers}</b> / ${d.approved} tasdiqlangan`,
    `  Hozir onlayn: ${d.onlineNow} · yangi ro'yxatdan o'tgan: ${d.newRegistrations}`,
    `  Tasdiq kutyapti: ${d.pendingApproval} · KYC navbatda: ${s.queue.kycPending} · bloklangan: ${d.blocked}`,
    ...(s.topDrivers.length > 0
      ? ['', '🏆 <b>Eng faollar</b>', ...s.topDrivers.slice(0, 3).map((t) => brief(t, `${t.rides} safar`))]
      : []),
    ...(s.churning.length > 0
      ? [
          '',
          '📉 <b>Ketib qolayotganlar</b>',
          ...s.churning.slice(0, LIST_LIMIT).map((c) => brief(c, `${c.daysSinceLastRide} kun`)),
          ...(s.churning.length > LIST_LIMIT ? [`  … yana ${s.churning.length - LIST_LIMIT} ta`] : []),
        ]
      : []),
    '',
    ...(alerts.length > 0
      ? ['⚠️ <b>Diqqat</b>', ...alerts.map((a) => `  • ${a}`)]
      : ["✅ Haydovchilar bo'yicha hammasi me'yorida."]),
  ];
  return lines.join('\n');
}
