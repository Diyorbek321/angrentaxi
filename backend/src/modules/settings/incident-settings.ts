/**
 * Shikoyat va hodisa sozlamalari (docs/INCIDENT-POLICY.md §3, migratsiya
 * 050). Hammasi `platform_settings` da — kodda raqam qotirilmaydi, admin
 * `PATCH /settings/global` bilan o'zgartiradi.
 */
export interface IncidentSettings {
  /** Buyurtma tugaganidan keyin shikoyat shuncha kun ichida qoldiriladi. */
  incidentReportWindowDays: number;
  /** Natija chiqqandan keyin e'tiroz (apellyatsiya) muddati, kun. */
  incidentAppealWindowDays: number;
  /** Vaqtincha to'xtatish standarti, kun (menejer o'zgartira oladi). */
  suspensionDays: number;
  /** Jarima zinapoyasi oynasi, kun — tasdiqlangan shikoyatlar shu oynada sanaladi. */
  strikeWindowDays: number;
  /** Shuncha tasdiqlangan shikoyat — ogohlantirish taklif qilinadi. */
  strikeWarningAt: number;
  /** Shuncha — vaqtincha to'xtatish taklif qilinadi. */
  strikeSuspensionAt: number;
  /** Shuncha — blok uchun adminga yuboriladi. */
  strikeBlockAt: number;
  /** Reyting signali: oxirgi shuncha baho. */
  ratingSignalWindow: number;
  /** Reyting signali: o'rtacha shundan past bo'lsa menejer navbatiga. */
  ratingSignalThreshold: number;
  /** Bitta haydovchiga reyting signali shuncha kunda ko'pi bilan bir marta. */
  ratingSignalCooldownDays: number;
  /** Shu bahodan past-teng + izoh — hodisa qoralamasi (izohlar o'qilsin). */
  lowRatingIncidentMaxScore: number;
}

/** Standart qiymatlar — migratsiya 050 bilan bir xil (ustuni yo'q eski qator uchun ham). */
export const DEFAULT_INCIDENT_SETTINGS: IncidentSettings = {
  incidentReportWindowDays: 7,
  incidentAppealWindowDays: 7,
  suspensionDays: 3,
  strikeWindowDays: 90,
  strikeWarningAt: 1,
  strikeSuspensionAt: 3,
  strikeBlockAt: 5,
  ratingSignalWindow: 20,
  ratingSignalThreshold: 4.3,
  ratingSignalCooldownDays: 30,
  lowRatingIncidentMaxScore: 2,
};

/** PATCH chegaralari — DTO va spec shu yerdan oladi. */
export const INCIDENT_SETTINGS_LIMITS: Record<keyof IncidentSettings, { min: number; max: number }> = {
  incidentReportWindowDays: { min: 1, max: 90 },
  incidentAppealWindowDays: { min: 1, max: 90 },
  suspensionDays: { min: 1, max: 90 },
  strikeWindowDays: { min: 7, max: 365 },
  strikeWarningAt: { min: 1, max: 50 },
  strikeSuspensionAt: { min: 1, max: 50 },
  strikeBlockAt: { min: 1, max: 50 },
  ratingSignalWindow: { min: 5, max: 200 },
  ratingSignalThreshold: { min: 1, max: 5 },
  ratingSignalCooldownDays: { min: 1, max: 365 },
  lowRatingIncidentMaxScore: { min: 0, max: 4 },
};

export const INCIDENT_SETTINGS_FIELDS = Object.keys(DEFAULT_INCIDENT_SETTINGS) as ReadonlyArray<
  keyof IncidentSettings
>;

/** Qatordan o'qish; ustun yo'q (eski qator / qo'lda yig'ilgan spec) — standart. */
export function toIncidentSettings(
  row: Partial<Record<keyof IncidentSettings, number | string | null>>,
): IncidentSettings {
  const entries = INCIDENT_SETTINGS_FIELDS.map((key) => {
    const value = Number(row[key] ?? DEFAULT_INCIDENT_SETTINGS[key]);
    return [key, Number.isFinite(value) ? value : DEFAULT_INCIDENT_SETTINGS[key]] as const;
  });
  return Object.fromEntries(entries) as unknown as IncidentSettings;
}

/**
 * Zinapoya pog'onalari o'sib borishi shart (1 ≤ ogohlantirish ≤ to'xtatish
 * ≤ blok) — aks holda "3-shikoyatda blok, 5-da ogohlantirish" kabi
 * ma'nosiz qoida saqlanib qolardi. Birlashtirilgan (joriy + o'zgarish)
 * qiymatlarda tekshiriladi.
 */
export function strikeLadderError(
  s: Pick<IncidentSettings, 'strikeWarningAt' | 'strikeSuspensionAt' | 'strikeBlockAt'>,
): string | null {
  if (s.strikeWarningAt <= s.strikeSuspensionAt && s.strikeSuspensionAt <= s.strikeBlockAt) return null;
  return "Jarima zinapoyasi: ogohlantirish ≤ to'xtatish ≤ blok bo'lishi kerak";
}
