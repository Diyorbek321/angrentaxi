import type { LeadDetails, LeadStatus } from './api';

/** Tafsilot kalitlari — panelda doim bir xil tartibda. */
export const LEAD_DETAIL_KEYS: readonly (keyof LeadDetails)[] = [
  'carModel',
  'carYear',
  'vehicle',
  'businessName',
  'businessType',
  'address',
  'comment',
];

/** Bo'sh bo'lmagan tafsilotlar, tartib bilan. */
export function leadDetailEntries(details: LeadDetails): [keyof LeadDetails, string][] {
  return LEAD_DETAIL_KEYS.filter((k) => details[k] !== undefined && details[k] !== '').map((k) => [
    k,
    String(details[k]),
  ]);
}

/** Yakuniy holatdagi arizada tezkor tugmalar ko'rinmaydi. */
export function isLeadFinal(status: LeadStatus): boolean {
  return status === 'accepted' || status === 'rejected';
}
