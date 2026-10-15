/**
 * Backend xato konvertini o'qish (docs/LEGAL-COMPLIANCE.md §21).
 *
 * Konvert: `{ success: false, message, statusCode, … }`; kodli xatolarda
 * qo'shimcha `code`, `reasons[]`, `details`. UI matnga emas, `code` ga tayanadi.
 */

export interface ApiErrorReason {
  code: string;
  message: string;
}

export interface ParsedApiError {
  /** `LEGAL_NOT_ELIGIBLE` kabi o'zgarmas kod; kodsiz xatoda `null`. */
  code: string | null;
  /** Backend `message` (satr yoki class-validator massivi `; ` bilan) yoki `null`. */
  message: string | null;
  reasons: ApiErrorReason[];
  details: Record<string, unknown>;
  statusCode: number | null;
}

/** Ma'lum kodlar uchun qisqa o'zbekcha sarlavhalar (toast title). */
export const API_ERROR_TITLE: Readonly<Record<string, string>> = {
  LEGAL_NOT_ELIGIBLE: 'Huquqiy talablar bajarilmagan',
  WALLET_NEGATIVE_BALANCE: 'Hamyon qoldigʻi manfiy',
  WALLET_INSUFFICIENT_FOR_VENDOR: 'Hamyonda mablagʻ yetarli emas',
  SHIFT_PASS_DISABLED: 'Smena oʻchirilgan',
  SHIFT_PASS_ACTIVE: 'Faol smena bor',
  SHIFT_PASS_INSUFFICIENT_BALANCE: 'Smena uchun mablagʻ yetarli emas',
  WALLET_TOPUP_TOO_MANY_PENDING: 'Ochiq toʻlovlar koʻp',
  WALLET_WITHDRAWAL_ON_HOLD: 'Mablagʻ hali ushlab turilgan',
  LEGAL_PROFILE_LOCKED: 'Huquqiy profil qulflangan',
  LEGAL_PROFILE_DUPLICATE: 'Takroriy JShShIR yoki STIR',
  MANUAL_ADJUSTMENT_LIMIT: 'Tuzatish chegarasidan oshdi',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseReasons(raw: unknown): ApiErrorReason[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!isRecord(item)) return [];
    const code = typeof item.code === 'string' ? item.code : '';
    const message = typeof item.message === 'string' ? item.message.trim() : '';
    return message ? [{ code, message }] : [];
  });
}

function parseMessage(raw: unknown): string | null {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw)) {
    const parts = raw.filter((m): m is string => typeof m === 'string' && m.trim() !== '');
    if (parts.length > 0) return parts.join('; ');
  }
  return null;
}

/** Axios xatosidan (yoki istalgan qiymatdan) konvert maydonlarini xavfsiz ajratadi. */
export function parseApiError(err: unknown): ParsedApiError {
  const response = isRecord(err) && isRecord(err.response) ? err.response : null;
  const data = response && isRecord(response.data) ? response.data : null;
  const status = data?.statusCode ?? response?.status;
  return {
    code: data && typeof data.code === 'string' && data.code ? data.code : null,
    message: data ? parseMessage(data.message) : null,
    reasons: data ? parseReasons(data.reasons) : [],
    details: data && isRecord(data.details) ? data.details : {},
    statusCode: typeof status === 'number' ? status : null,
  };
}

/**
 * Foydalanuvchiga ko'rsatiladigan bitta matn. Sabablar bo'lsa (masalan
 * LEGAL_NOT_ELIGIBLE) `message` o'rniga aniq ro'yxat qaytadi.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const parsed = parseApiError(err);
  if (parsed.reasons.length > 0) return parsed.reasons.map((r) => r.message).join('; ');
  return parsed.message ?? fallback;
}

/** Toast sarlavhasi: ma'lum kod bo'lsa uning nomi, aks holda zaxira. */
export function apiErrorTitle(err: unknown, fallback: string): string {
  const { code } = parseApiError(err);
  return (code && API_ERROR_TITLE[code]) || fallback;
}

/** `details` dagi son (so'm, kun…); yo'q yoki son emas — `null`. */
export function apiErrorDetailNumber(err: unknown, key: string): number | null {
  const value = parseApiError(err).details[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** `details` dagi satr; yo'q yoki bo'sh — `null`. */
export function apiErrorDetailText(err: unknown, key: string): string | null {
  const value = parseApiError(err).details[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
