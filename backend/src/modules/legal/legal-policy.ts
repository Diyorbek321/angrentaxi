/**
 * Oferta matnlaridagi raqamlar (docs/INCIDENT-POLICY.md — STANDART qiymatlar,
 * egasi hali tasdiqlamagan).
 *
 * Hozircha `platform_settings` da faqat komissiya stavkasi bor — u sahifa
 * ochilgan paytda sozlamadan o'qiladi (`LegalPagesController`). Qolganlari
 * keyingi bosqichlarda (049 yetkazish, 050 incidents, 052 taksi jarimalari)
 * sozlamaga aylanadi; shunda shu yerdagi standart o'rniga sozlama
 * uzatiladi — matnlar `LegalPolicyNumbers` dan o'qiydi, raqam qotirmaydi.
 */
export interface LegalPolicyNumbers {
  /** `defaultCommissionRate`, % (jonli sozlama). */
  commissionRate: number;
  /** `parcelMaxDeclaredValue`, so'm — e'lon qilingan qiymat va kompensatsiya chegarasi. */
  parcelMaxDeclaredValue: number;
  /** `dropoffFreeWaitMinutes` — manzilda bepul kutish. */
  dropoffFreeWaitMinutes: number;
  /** `returnFeePercent` — qaytarish haqi, yetkazish haqining %. */
  returnFeePercent: number;
  /** `refusalCashBlockCount` — 30 kunda shuncha rad → naqd o'chiriladi. */
  refusalCashBlockCount: number;
  /** `cardPaymentTimeoutMinutes` — to'lanmagan kartali buyurtma avtomatik bekor. */
  cardPaymentTimeoutMinutes: number;
  /** Topshirish kodi: raqamlar soni va urinishlar. */
  handoffCodeDigits: number;
  handoffCodeAttempts: number;
  /** Shikoyat muddati, safardan keyin (kun). */
  complaintWindowDays: number;
  /** Bepul bekor qilish oynasi, qabuldan keyin (daqiqa). */
  freeCancelMinutes: number;
  /** Kech bekor qilish jarimasi, so'm (haydovchiga). */
  lateCancelFee: number;
  /** Yo'lovchi chiqmadi: yetib kelgandan keyin kutish (daqiqa) va jarima (so'm). */
  noShowWaitMinutes: number;
  noShowFee: number;
  /** Jarima zinapoyasi (90 kunlik oyna). */
  strikeWindowDays: number;
  strikeWarningAt: number;
  strikeSuspendAt: number;
  suspensionDays: number;
  strikeBlockAt: number;
  /** Reyting signali: oxirgi N baho o'rtachasi < chegara. */
  ratingSignalCount: number;
  ratingSignalThreshold: number;
  /** Dalillarni saqlash (kun). */
  evidenceRetentionDays: number;
  /** E'tiroz (appeal) muddati, qarordan keyin (kun). ⚠️ Siyosatda yo'q — taklif. */
  appealWindowDays: number;
}

export const DEFAULT_LEGAL_POLICY: Readonly<LegalPolicyNumbers> = {
  commissionRate: 10,
  parcelMaxDeclaredValue: 1_000_000,
  dropoffFreeWaitMinutes: 5,
  returnFeePercent: 50,
  refusalCashBlockCount: 2,
  cardPaymentTimeoutMinutes: 15,
  handoffCodeDigits: 4,
  handoffCodeAttempts: 5,
  complaintWindowDays: 7,
  freeCancelMinutes: 2,
  lateCancelFee: 3_000,
  noShowWaitMinutes: 5,
  noShowFee: 5_000,
  strikeWindowDays: 90,
  strikeWarningAt: 1,
  strikeSuspendAt: 3,
  suspensionDays: 3,
  strikeBlockAt: 5,
  ratingSignalCount: 20,
  ratingSignalThreshold: 4.3,
  evidenceRetentionDays: 180,
  appealWindowDays: 7,
};

/** Standartlar + jonli sozlamalar (berilganlari ustun). */
export function legalPolicy(overrides: Partial<LegalPolicyNumbers> = {}): LegalPolicyNumbers {
  const clean = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => typeof v === 'number' && Number.isFinite(v)),
  ) as Partial<LegalPolicyNumbers>;
  return { ...DEFAULT_LEGAL_POLICY, ...clean };
}

/** `1000000` → `1 000 000` (bo'shliq bilan, til mustaqil). */
export function som(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
