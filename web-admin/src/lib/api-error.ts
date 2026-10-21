/**
 * Backend xato konvertini o'qish (docs/LEGAL-COMPLIANCE.md §21).
 *
 * Konvert: `{ success: false, message, statusCode, … }`; kodli xatolarda
 * qo'shimcha `code`, `reasons[]`, `details`. UI matnga emas, `code` ga tayanadi.
 */

import { t } from '@/locales';

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

/** Ma'lum kodlar uchun qisqa sarlavhalar (toast title), faol tilda. */
export function apiErrorTitles(): Readonly<Record<string, string>> {
  return t().shell.apiErrorTitle;
}

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
  return (code && apiErrorTitles()[code]) || fallback;
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
