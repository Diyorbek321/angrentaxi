import { ForbiddenException } from '@nestjs/common';
import { ERROR_CODES, codedForbidden } from '../../common/errors/coded-error';

/**
 * Vaqtincha to'xtatish (docs/INCIDENT-POLICY.md §3). Qaror: kirish
 * TO'SILMAYDI — foydalanuvchi ilovada sababini va muddatini ko'radi va
 * e'tiroz bera oladi. To'siladi: haydovchining onlayn chiqishi va
 * yo'lovchi/mijozning yangi buyurtmasi.
 */
export interface SuspensionState {
  suspendedUntil: Date | string | null;
  suspensionReason: string | null;
}

export type SuspensionAction = 'go_online' | 'new_order';

export function isSuspended(state: SuspensionState | null | undefined, now: Date = new Date()): boolean {
  if (!state?.suspendedUntil) return false;
  return new Date(state.suspendedUntil).getTime() > now.getTime();
}

/** Toshkent vaqti `DD.MM.YYYY HH:mm` — xabar matnida. */
export function formatTashkent(date: Date | string): string {
  const d = new Date(new Date(date).getTime() + 5 * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function suspensionError(state: SuspensionState, action: SuspensionAction): ForbiddenException {
  const until = new Date(state.suspendedUntil as Date | string);
  const reason = state.suspensionReason?.trim() || '—';
  const when = formatTashkent(until);
  const message =
    action === 'go_online'
      ? `Hisobingiz ${when} gacha vaqtincha to'xtatilgan: ${reason}. Bu muddatda onlayn chiqa olmaysiz.`
      : `Hisobingiz ${when} gacha vaqtincha to'xtatilgan: ${reason}. Bu muddatda yangi buyurtma bera olmaysiz.`;
  return codedForbidden(
    ERROR_CODES.accountSuspended,
    message,
    { details: { until: until.toISOString(), reason: state.suspensionReason ?? null } },
  );
}

export function assertNotSuspended(
  state: SuspensionState | null | undefined,
  action: SuspensionAction,
  now: Date = new Date(),
): void {
  if (state && isSuspended(state, now)) throw suspensionError(state, action);
}
