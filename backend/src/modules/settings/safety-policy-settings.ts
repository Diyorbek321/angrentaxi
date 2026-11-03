/**
 * Xavfsizlik, taksi jarimalari va dalillarni saqlash sozlamalari
 * (docs/INCIDENT-POLICY.md §4–§6, migratsiyalar 051–053). Hammasi
 * `platform_settings` da — kodda raqam qotirilmaydi, admin
 * `PATCH /settings/global` bilan o'zgartiradi.
 */
export interface SafetyPolicySettings {
  /** Ulashish havolasi safar tugagach yana shuncha daqiqa ochiq (§4). */
  tripShareGraceMinutes: number;
  /** Qabuldan shuncha daqiqa ichida (haydovchi yetib kelmagan) — bepul bekor qilish (§5). */
  freeCancelMinutes: number;
  /** Kech bekor qilish jarimasi, so'm — to'liq haydovchiga. 0 — o'chiq. */
  lateCancelFee: number;
  /** Haydovchi yetib kelgach shuncha daqiqa kutgandan keyin "chiqmadi" belgilay oladi. */
  noShowWaitMinutes: number;
  /** "Yo'lovchi chiqmadi" jarimasi, so'm — to'liq haydovchiga. 0 — o'chiq. */
  noShowFee: number;
  /** Haydovchi bir kunda shuncha qabul qilingan buyurtmani bekor qilsa — menejerga signal. */
  driverCancelSignalCount: number;
}

/** Standart qiymatlar — migratsiyalar bilan bir xil (ustuni yo'q eski qator uchun ham). */
export const DEFAULT_SAFETY_POLICY_SETTINGS: SafetyPolicySettings = {
  tripShareGraceMinutes: 30,
  freeCancelMinutes: 2,
  lateCancelFee: 3000,
  noShowWaitMinutes: 5,
  noShowFee: 5000,
  driverCancelSignalCount: 3,
};

/** PATCH chegaralari — DTO va spec shu yerdan oladi. */
export const SAFETY_POLICY_LIMITS: Record<keyof SafetyPolicySettings, { min: number; max: number }> = {
  tripShareGraceMinutes: { min: 0, max: 240 },
  freeCancelMinutes: { min: 0, max: 30 },
  lateCancelFee: { min: 0, max: 100_000 },
  noShowWaitMinutes: { min: 1, max: 60 },
  noShowFee: { min: 0, max: 100_000 },
  driverCancelSignalCount: { min: 1, max: 50 },
};

export const SAFETY_POLICY_FIELDS = Object.keys(DEFAULT_SAFETY_POLICY_SETTINGS) as ReadonlyArray<
  keyof SafetyPolicySettings
>;

/** Qatordan o'qish; ustun yo'q (eski qator / qo'lda yig'ilgan spec) — standart. */
export function toSafetyPolicySettings(
  row: Partial<Record<keyof SafetyPolicySettings, number | string | null>>,
): SafetyPolicySettings {
  const entries = SAFETY_POLICY_FIELDS.map((key) => {
    const value = Number(row[key] ?? DEFAULT_SAFETY_POLICY_SETTINGS[key]);
    return [key, Number.isFinite(value) ? value : DEFAULT_SAFETY_POLICY_SETTINGS[key]] as const;
  });
  return Object.fromEntries(entries) as unknown as SafetyPolicySettings;
}
