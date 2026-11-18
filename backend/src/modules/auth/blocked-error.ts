import { UnauthorizedException } from '@nestjs/common';
import { ERROR_CODES, codedUnauthorized } from '../../common/errors/coded-error';

/** O'chirilgan hisobning `block_reason` i — ilovaga ko'rsatilmaydi. */
const HIDDEN_REASONS = ['account_deleted'];

/**
 * Bloklangan hisob — 401, xabar o'zgarmagan ("Account is blocked", lug'atda
 * uz/ru), QO'SHIMCHA `code: ACCOUNT_BLOCKED` va admin yozgan sabab
 * (docs/INCIDENT-POLICY.md §3: foydalanuvchi nega bloklanganini bilsin).
 */
export function accountBlockedError(user: { blockReason?: string | null }): UnauthorizedException {
  const reason = user.blockReason && !HIDDEN_REASONS.includes(user.blockReason) ? user.blockReason : null;
  return codedUnauthorized(ERROR_CODES.accountBlocked, 'Account is blocked', { details: { reason } });
}
