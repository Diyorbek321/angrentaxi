/**
 * Antifrod bo'limi surati — asosiy xavf: PLATFORMANI CHETLAB O'TISH
 * (haydovchi va yo'lovchi ilova orqali tanishib, keyin to'g'ridan-to'g'ri
 * kelishadi; komissiya yo'qoladi). Tugagan safarlardagi "o'ziga o'zi zakaz"
 * belgilari esa `orders/fraud-rules.ts` da — bu yerda faqat ularning navbati.
 *
 * ⚠️ Bu belgilar — ayblov emas (fraud-rules.ts dagi biznes qarori): har
 * birining halol izohi bo'lishi mumkin. Qarorni odam qiladi.
 */
export interface SuspiciousDriver {
  driverUserId: string;
  name: string;
  phone: string;
  /** Davrda shu haydovchiga biriktirilgan buyurtmalar. */
  accepted: number;
  /** Ulardan bekor qilingani (kim bo'lishidan qat'i nazar). */
  cancelledAfterAccept: number;
  /** Haydovchi yetib kelgandan keyin bekor qilingani — eng kuchli belgi. */
  cancelledAfterArrival: number;
}

export interface SuspiciousPair {
  passengerId: string;
  passengerName: string;
  passengerPhone: string;
  driverUserId: string;
  driverName: string;
  driverPhone: string;
  /** Juftlikning qabul qilinib bekor qilingan buyurtmalari (30 kun). */
  cancelledTogether: number;
  /** Juftlikning tugagan safarlari (oldingi 30 kun). */
  completedTogether: number;
  /** Juftlik oxirgi marta ilovada birga yurganidan beri o'tgan kun. */
  daysSinceLastTrip: number | null;
}

export interface FraudSnapshot {
  period: { from: string; to: string };

  cancellations: {
    /** Haydovchi biriktirilgan, keyin bekor qilingan buyurtmalar. */
    afterAccept: number;
    afterArrival: number;
    afterArrivalByDriver: number;
    afterArrivalByPassenger: number;
  };

  /** Ko'p "qabul qilib bekor qilgan" haydovchilar. */
  drivers: SuspiciousDriver[];
  /** Bir-biri bilan qayta-qayta bekor qilgan juftliklar (30 kun). */
  cancelPairs: SuspiciousPair[];
  /**
   * Doimiy mijoz yo'qoldi: juftlik oldin muntazam yurgan, oxirgi 14 kunda
   * ilovada yurmagan, yo'lovchi hech kim bilan yurmagan, haydovchi esa
   * boshqalar bilan ishlayapti — ehtimol ilovasiz kelishgan.
   */
  lostRegulars: SuspiciousPair[];

  /** Tugagan safarlar bo'yicha "o'ziga o'zi zakaz" navbati (fraud-rules.ts). */
  selfOrderReview: {
    flaggedInPeriod: number;
    pending: number;
    oldestPendingHours: number | null;
  };
}
