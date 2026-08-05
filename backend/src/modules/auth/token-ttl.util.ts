// Token lifetimes are configurable through JWT_ACCESS_TTL / JWT_REFRESH_TTL so
// the operator can shorten them without a redeploy.
//
// ⚠️ The defaults below are deliberately LONG (7d access / 30d refresh) and must
// stay that way for now: the mobile app has no refresh flow yet (a 401 logs the
// user out) and the web panels do not persist the refresh token at all. Once the
// updated clients are shipped and adopted, set JWT_ACCESS_TTL to something like
// '15m' in the environment — no code change required.
export const DEFAULT_ACCESS_TTL = '7d';
export const DEFAULT_REFRESH_TTL = '30d';

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Converts a jsonwebtoken-style lifetime ('15m', '7d', '3600') to milliseconds.
 *
 * The value is needed on our side (not just inside the JWT) to stamp
 * `expiresAt` on the persisted refresh token row. A bare number is seconds,
 * matching jsonwebtoken's own convention.
 */
export function parseTtlToMs(ttl: string): number {
  const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(ttl.trim());

  if (!match) {
    throw new Error(
      `Invalid token TTL "${ttl}". Use a number of seconds or a value like 15m, 12h, 7d.`,
    );
  }

  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();

  return amount * UNIT_MS[unit];
}
