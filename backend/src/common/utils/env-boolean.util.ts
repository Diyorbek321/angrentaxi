/**
 * Muhit o'zgaruvchisidagi boolean — ANIQ o'qiladi.
 *
 * ⚠️ NEGA. `validateEnv` `enableImplicitConversion: true` bilan ishlaydi va u
 * `Boolean("false") === true` qiladi. ConfigService validatsiyadan o'tgan
 * qiymatni qaytaradi — ya'ni `OTP_BYPASS_ENABLED=false` yozilgan server
 * bypass'ni YOQIQ deb o'qirdi. `formBoolean` (forma maydonlari) bilan bir xil
 * sabab: xom qiymat `obj[key]` dan o'qiladi (`envBoolean` transform).
 *
 * `true`/`1` → true; `false`/`0`/`no`/`off`/bo'sh/yo'q → false;
 * boshqa satr o'zgarmay qaytadi — `@IsBoolean` uni rad etadi va ilova
 * ko'tarilmaydi (tushunarsiz qiymat jimgina "yoqiq" ham, "o'chiq" ham bo'lmaydi).
 */
export function parseEnvBoolean(raw: unknown): unknown {
  if (raw === undefined || raw === null) return false;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw !== 'string') return raw;
  const value = raw.trim().toLowerCase();
  if (value === 'true' || value === '1') return true;
  if (value === '' || value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  return raw;
}

/** `@Transform(envBoolean)` — implicit conversion'dan OLDINGI xom qiymat bilan. */
export function envBoolean({ obj, key }: { obj: Record<string, unknown>; key: string }): unknown {
  return parseEnvBoolean(obj[key]);
}
