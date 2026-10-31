import type { PendingVerification, VerificationKind } from './api';
import { t } from '@/locales';

/** One driver's pending submissions of one kind — reviewed together. */
export interface VerificationGroup {
  key: string;
  driverId: string;
  driverName: string | null;
  driverPhone: string | null;
  kind: VerificationKind;
  items: PendingVerification[];
  /** Oldest submission in the group — the queue is worked oldest first. */
  submittedAt: string;
}

/**
 * Groups the flat queue by driver and kind.
 *
 * A vehicle inspection arrives as seven separate photos; reviewing them one
 * row at a time would hide the car as a whole (front fine, trunk full of
 * junk). Grouping shows the whole inspection at once.
 */
export function groupVerifications(entries: PendingVerification[]): VerificationGroup[] {
  const groups = new Map<string, VerificationGroup>();
  for (const entry of entries) {
    const key = `${entry.driverId}:${entry.kind}`;
    const existing = groups.get(key);
    if (existing) {
      groups.set(key, {
        ...existing,
        items: [...existing.items, entry],
        submittedAt: entry.submittedAt < existing.submittedAt ? entry.submittedAt : existing.submittedAt,
      });
    } else {
      groups.set(key, {
        key,
        driverId: entry.driverId,
        driverName: entry.driverName,
        driverPhone: entry.driverPhone,
        kind: entry.kind,
        items: [entry],
        submittedAt: entry.submittedAt,
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

export function kindLabels(): Record<VerificationKind, string> {
  return t().lib.verificationKind;
}

/**
 * VMQ 200 bo'yicha taksi hujjatlari (migratsiya 025). Backend `label` ni
 * o'zi yuboradi; bu xarita — u bo'sh kelsa yoki eski backend bo'lsa zaxira.
 */
export function legalDocumentLabels(): Record<string, string> {
  return t().lib.legalDocument;
}

const LEGAL_DOCUMENT_CODES = ['taxi_licence', 'medical_check', 'carrier_insurance', 'tech_inspection'];

export function isLegalDocument(code: string): boolean {
  return LEGAL_DOCUMENT_CODES.includes(code);
}

export function verificationLabel(entry: Pick<PendingVerification, 'code' | 'label'>): string {
  const label = entry.label?.trim();
  if (label && label !== entry.code) return label;
  return legalDocumentLabels()[entry.code] ?? label ?? entry.code;
}

/**
 * Tasdiqlashdagi «amal qilish muddati» (YYYY-MM-DD). Bo'sh — ruxsat
 * (backend talabning `cadenceDays` hisobini oladi, huquqiy hujjatlarda
 * 365 kun). Muddati o'tgan hujjat tasdiqlanmaydi — rad etiladi.
 */
export function validateValidUntil(value: string, today: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(`${v}T00:00:00Z`).getTime())) {
    return t().lib.validUntil.invalidDate;
  }
  if (v <= today) return t().lib.validUntil.expired;
  return null;
}
