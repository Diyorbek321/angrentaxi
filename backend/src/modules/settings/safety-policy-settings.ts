/**
 * Xavfsizlik, taksi jarimalari va dalillarni saqlash sozlamalari
 * (docs/INCIDENT-POLICY.md §4–§6, migratsiyalar 051–053). Hammasi
 * `platform_settings` da — kodda raqam qotirilmaydi, admin
 * `PATCH /settings/global` bilan o'zgartiradi.
 */
export interface SafetyPolicySettings {
  /** Ulashish havolasi safar tugagach yana shuncha daqiqa ochiq (§4). */
  tripShareGraceMinutes: number;
}

/** Standart qiymatlar — migratsiyalar bilan bir xil (ustuni yo'q eski qator uchun ham). */
export const DEFAULT_SAFETY_POLICY_SETTINGS: SafetyPolicySettings = {
  tripShareGraceMinutes: 30,
};

/** PATCH chegaralari — DTO va spec shu yerdan oladi. */
export const SAFETY_POLICY_LIMITS: Record<keyof SafetyPolicySettings, { min: number; max: number }> = {
  tripShareGraceMinutes: { min: 0, max: 240 },
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
