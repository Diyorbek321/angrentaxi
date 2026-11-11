/**
 * Oferta va rozilik (docs/LEGAL-COMPLIANCE.md §28) — faqat o'qish.
 *   GET /admin/legal/acceptances
 */
import api, { API_PROXY_BASE_URL, type ApiResponse } from './api';

export type LegalDocumentCode = 'terms' | 'driver-terms' | 'vendor-terms' | 'privacy';

export interface LegalDocumentSummary {
  document: LegalDocumentCode;
  version: string;
  summary: { uz: string; ru: string };
  /** Joriy versiyani qabul qilganlar. */
  acceptedCurrent: number;
  /** Shu hujjat talab qilinadigan faol (bloklanmagan) foydalanuvchilar. */
  requiredUsers: number;
  versions: Array<{ version: string; users: number; lastAcceptedAt: string | null }>;
}

export const legalDocumentsApi = {
  acceptances: () =>
    api.get<ApiResponse<{ documents: LegalDocumentSummary[] }>>('/admin/legal/acceptances'),
};

/** Joriy versiyani qabul qilganlar ulushi, %; talab qilinadigan foydalanuvchi bo'lmasa `null`. */
export function acceptanceShare(doc: Pick<LegalDocumentSummary, 'acceptedCurrent' | 'requiredUsers'>): number | null {
  if (doc.requiredUsers <= 0) return null;
  return Math.min(100, Math.round((doc.acceptedCurrent / doc.requiredUsers) * 100));
}

/** Faqat eski versiyani qabul qilganlar (qayta rozilik kutilmoqda). */
export function olderVersionUsers(doc: Pick<LegalDocumentSummary, 'version' | 'versions'>): number {
  return doc.versions.filter((v) => v.version !== doc.version).reduce((sum, v) => sum + v.users, 0);
}

/** Ommaviy matn sahifasi — panel proksisi orqali (backend `/legal/<hujjat>`). */
export function documentUrl(document: LegalDocumentCode, lang: 'uz' | 'ru'): string {
  return `${API_PROXY_BASE_URL}/legal/${document}?lang=${lang}`;
}
