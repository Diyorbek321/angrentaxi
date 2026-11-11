import { QualitySnapshot, ratingCoverage } from './quality-report.types';
import { escapeHtml, formatWait } from './html';

/** O'rtacha baho shundan past — sifat tushyapti. */
const AVERAGE_ALERT = 4.5;
/** O'rtachani shuncha bahodan kam bo'lsa baholamaymiz. */
const AVERAGE_MIN_COUNT = 10;
/** Bitta davrda shuncha past baho — tasodif emas. */
const LOW_RATINGS_ALERT = 3;
/** Javobsiz murojaat shundan uzoq kutsa — ogohlantirish. */
const SUPPORT_WAIT_ALERT_HOURS = 4;
/** Unutilgan buyum arizasi shundan uzoq ochiq tursa. */
const LOST_ITEM_ALERT_HOURS = 24;
const LIST_LIMIT = 5;
const COMMENT_MAX = 120;

export function qualityAlerts(s: QualitySnapshot): string[] {
  const alerts: string[] = [];

  if (s.sos.active > 0) {
    alerts.push(
      `🚨 ${s.sos.active} ta SOS hali yopilmagan` +
        (s.sos.oldestActiveMinutes !== null ? `, eng eskisi ${s.sos.oldestActiveMinutes} daqiqa` : '') +
        ' — darhol tekshiring: menejer paneli → Istisnolar',
    );
  }

  const sup = s.support;
  if (sup.unanswered > 0 && sup.oldestUnansweredHours !== null && sup.oldestUnansweredHours >= SUPPORT_WAIT_ALERT_HOURS) {
    alerts.push(
      `${sup.unanswered} ta murojaat javob kutyapti, eng eskisi ${formatWait(sup.oldestUnansweredHours)} — menejer paneli → Qo'llab-quvvatlash`,
    );
  }

  const r = s.ratings;
  if (r.average !== null && r.count >= AVERAGE_MIN_COUNT && r.average < AVERAGE_ALERT) {
    alerts.push(`Haydovchilarga o'rtacha baho ${r.average.toFixed(1)} — ${AVERAGE_ALERT} dan past`);
  }
  if (r.low >= LOW_RATINGS_ALERT) {
    alerts.push(`${r.low} ta past baho (≤3★) — izohlarni o'qib, haydovchilar bilan gaplashing`);
  }

  if (s.driversAtRisk.length > 0) {
    alerts.push(
      `${s.driversAtRisk.length} ta haydovchining oxirgi baholari ${AVERAGE_ALERT} dan past — suhbat va kerak bo'lsa o'qitish`,
    );
  }

  const lost = s.lostItems;
  if (lost.open > 0 && lost.oldestOpenHours !== null && lost.oldestOpenHours >= LOST_ITEM_ALERT_HOURS) {
    alerts.push(
      `${lost.open} ta unutilgan buyum arizasi ochiq, eng eskisi ${formatWait(lost.oldestOpenHours)} — yo'lovchi kutyapti`,
    );
  }

  return alerts;
}

const shorten = (text: string): string =>
  text.length > COMMENT_MAX ? `${text.slice(0, COMMENT_MAX - 1)}…` : text;

export function formatQualityReport(title: string, s: QualitySnapshot): string {
  const r = s.ratings;
  const coverage = ratingCoverage(s);
  const alerts = qualityAlerts(s);

  const lines = [
    `⭐ <b>${title}</b>`,
    '',
    `<b>O'rtacha baho: ${r.average === null ? '—' : r.average.toFixed(1)}</b> (${r.count} ta baho` +
      (coverage === null ? ')' : `, ${coverage}% safarga baho qo'yildi)`),
    `  Past baho (≤3★): ${r.low} · haydovchilar yomon baholagan yo'lovchi: ${r.lowPassengerRatings}`,
    ...(r.lowList.length > 0
      ? [
          '',
          '👎 <b>Past baholar</b>',
          ...r.lowList.slice(0, LIST_LIMIT).map(
            (l) =>
              `  ${escapeHtml(l.driverName)} — ${l.score}★` +
              (l.comment ? `: «${escapeHtml(shorten(l.comment))}»` : ''),
          ),
        ]
      : []),
    ...(s.driversAtRisk.length > 0
      ? [
          '',
          '📉 <b>Bahosi tushayotgan haydovchilar</b>',
          ...s.driversAtRisk
            .slice(0, LIST_LIMIT)
            .map((d) => `  ${escapeHtml(d.name)} — ${d.recentAvg.toFixed(1)} (oxirgi ${d.recentCount} ta)`),
        ]
      : []),
    '',
    `💬 <b>Support:</b> yangi ${s.support.openedInPeriod} · ochiq ${s.support.openNow} · javobsiz ${s.support.unanswered}`,
    ...(s.support.medianFirstResponseMin !== null
      ? [`  Birinchi javob (median): ${s.support.medianFirstResponseMin} daqiqa`]
      : []),
    `🆘 SOS: ${s.sos.inPeriod} · 🎒 Unutilgan buyum: ${s.lostItems.reportedInPeriod} (ochiq ${s.lostItems.open})`,
    '',
    ...(alerts.length > 0
      ? ['⚠️ <b>Diqqat</b>', ...alerts.map((a) => `  • ${a}`)]
      : ["✅ Sifat bo'yicha hammasi me'yorida."]),
  ];
  return lines.join('\n');
}
