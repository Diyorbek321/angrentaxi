import type { NextResponse } from 'next/server';

/**
 * Session cookies for the market vendor panel.
 *
 * Both are `httpOnly`, so no script running in the page — including one injected
 * through an XSS hole — can read them. They are only ever attached by the browser
 * to this app's own origin, where the route handlers under /api/* read them and
 * forward the access token to the backend as a Bearer header.
 *
 * `access_token` keeps the name the panel has always used, so an old
 * JS-readable cookie is overwritten (same name + path) the first time a user
 * logs in against this build instead of lingering next to the new one.
 */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

// Cookie lifetime is not token lifetime. The backend is the only thing that can
// judge whether a JWT is still valid; these numbers only decide how long the
// browser bothers to keep sending them. Access keeps the 7 days the panel used
// before, refresh gets the 30 days the backend issues them for.
const ACCESS_MAX_AGE = 60 * 60 * 24 * 7;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

const BASE_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

export interface TokenPair {
  accessToken: string;
  /**
   * Optional on purpose: older backend builds answered /auth/refresh with only an
   * access token. When it is missing we leave the existing refresh cookie alone
   * rather than wiping a session that is still perfectly good.
   */
  refreshToken?: string | null;
}

export function setSessionCookies(res: NextResponse, tokens: TokenPair): void {
  res.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...BASE_COOKIE,
    maxAge: ACCESS_MAX_AGE,
  });
  if (tokens.refreshToken) {
    res.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...BASE_COOKIE,
      maxAge: REFRESH_MAX_AGE,
    });
  }
}

export function clearSessionCookies(res: NextResponse): void {
  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]) {
    res.cookies.set(name, '', { ...BASE_COOKIE, maxAge: 0 });
  }
}
