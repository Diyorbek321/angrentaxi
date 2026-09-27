import type { LostItemStatus } from './api';

export const LOST_ITEM_STATUS_LABEL: Record<LostItemStatus, string> = {
  open: 'Haydovchi javobini kutmoqda',
  found: 'Topildi — topshirishni kelishing',
  not_found: 'Haydovchi topmadi',
  returned: 'Qaytarildi',
  closed: 'Yopildi',
};

/**
 * What the dispatcher should do next. `found` is the only state that needs a
 * human: the driver has the item and someone must arrange the handover.
 */
export function needsDispatcher(status: LostItemStatus): boolean {
  return status === 'found' || status === 'not_found';
}

export function isFinal(status: LostItemStatus): boolean {
  return status === 'returned' || status === 'closed';
}
