import type { LostItemStatus } from './api';
import { t } from '@/locales';

export function lostItemStatusLabels(): Record<LostItemStatus, string> {
  return t().lib.lostItemStatus;
}

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
