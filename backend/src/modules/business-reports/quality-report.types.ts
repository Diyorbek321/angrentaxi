/** Yo'lovchi qo'ygan past baho (izoh bilan) — haydovchi bilan gaplashish uchun. */
export interface LowRating {
  orderId: string;
  driverUserId: string;
  driverName: string;
  score: number;
  comment: string | null;
  /** Toshkent vaqti, `YYYY-MM-DD HH:MM`. */
  createdAt: string;
}

export interface DriverAtRisk {
  driverUserId: string;
  name: string;
  phone: string;
  /** Oxirgi (ko'pi bilan 20) bahoning o'rtachasi. */
  recentAvg: number;
  recentCount: number;
}

/**
 * Sifat va qo'llab-quvvatlash bo'limi surati. `support.open/unanswered`,
 * `sos.active`, `lostItems.open` — HOZIRGI holat; qolganlari davr bo'yicha.
 */
export interface QualitySnapshot {
  period: { from: string; to: string };

  ratings: {
    /** Yo'lovchilar haydovchiga qo'ygan baholar. */
    count: number;
    average: number | null;
    /** ≤ 3 yulduz. */
    low: number;
    /** Davrdagi tugagan safarlar — baho qo'yilish ulushini hisoblash uchun. */
    completedRides: number;
    /** Haydovchilar yo'lovchiga qo'ygan ≤ 2 baho. */
    lowPassengerRatings: number;
    lowList: LowRating[];
  };

  driversAtRisk: DriverAtRisk[];

  support: {
    openedInPeriod: number;
    /** Davrda ochilgan murojaatlarga birinchi javob vaqti (median, daqiqa). */
    medianFirstResponseMin: number | null;
    openNow: number;
    /** Oxirgi xabar foydalanuvchidan — operator javobini kutyapti. */
    unanswered: number;
    oldestUnansweredHours: number | null;
  };

  sos: {
    inPeriod: number;
    active: number;
    oldestActiveMinutes: number | null;
  };

  lostItems: {
    reportedInPeriod: number;
    open: number;
    oldestOpenHours: number | null;
  };
}

/** Baho qo'yilgan safarlar ulushi (%); safar bo'lmasa `null`. */
export function ratingCoverage(s: QualitySnapshot): number | null {
  return s.ratings.completedRides > 0
    ? Math.round((s.ratings.count / s.ratings.completedRides) * 100)
    : null;
}
