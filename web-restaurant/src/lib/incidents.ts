import api, { type ApiResponse } from './api';

/**
 * Sotuvchi shikoyati (docs/INCIDENT-POLICY.md §3): do'kon/restoran kuryer
 * yoki mijoz haqida yozadi va o'z murojaatlarini ko'radi. Muddat, ishtirok
 * va takror tekshiruvi — serverda; bu yerda faqat tugma ko'rinishi.
 */
export type IncidentVertical = 'food' | 'market';
export type IncidentSubject = 'courier' | 'customer';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'rejected';

/** backend `CATEGORIES_BY_SIDE.vendor` bilan bir xil. */
export const VENDOR_INCIDENT_CATEGORIES = [
  'rude',
  'no_show',
  'did_not_pay',
  'damaged_goods',
  'harassment',
  'safety',
  'other',
] as const;
export type VendorIncidentCategory = (typeof VENDOR_INCIDENT_CATEGORIES)[number];

export interface MyIncident {
  id: string;
  vertical: IncidentVertical | 'taxi' | null;
  orderId: string | null;
  category: string;
  description: string;
  status: IncidentStatus;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** Tugash holatlari — shikoyat shundan keyin (7 kun ichida, server tekshiradi). */
const REPORTABLE_STATUSES = ['delivered', 'returned', 'returning', 'cancelled'];

export function canReportOrder(order: { status: string; updatedAt?: string | null }, now: Date, windowDays = 7): boolean {
  if (!REPORTABLE_STATUSES.includes(order.status)) return false;
  if (!order.updatedAt) return true;
  return now.getTime() - new Date(order.updatedAt).getTime() <= windowDays * 86_400_000;
}

/** Aniq tanlanmasa — kelmadi/to'lamadi mijoz haqida, qolgani kuryer. */
export function defaultSubjectFor(category: VendorIncidentCategory): IncidentSubject {
  return category === 'no_show' || category === 'did_not_pay' ? 'customer' : 'courier';
}

export interface ReportInput {
  vertical: IncidentVertical;
  orderId: string;
  category: VendorIncidentCategory;
  description: string;
  subject: IncidentSubject;
}

/** Kiritishni tekshiradi; `null` — yuborsa bo'ladi. */
export function reportProblem(input: Pick<ReportInput, 'description'>): 'description' | null {
  const length = input.description.trim().length;
  return length < 3 || length > 1000 ? 'description' : null;
}

export const incidentsApi = {
  report: (input: ReportInput) =>
    api.post<ApiResponse<{ id: string }>>('/incidents', { ...input, description: input.description.trim() }),
  mine: () => api.get<ApiResponse<MyIncident[]>>('/incidents/mine'),
};
