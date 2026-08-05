/**
 * Route-guard decision table, kept free of Next.js types so it can be exercised
 * directly in tests.
 *
 * ⚠️ This is a *coarse* gate, not authentication. All it can observe is whether a
 * session cookie exists — the JWT signing key lives in the backend, so the edge
 * cannot tell a valid token from a forged or expired one. Anyone can hand-write a
 * `manager_token` cookie and get past this. Its only job is to stop a logged-out
 * browser from rendering a dispatcher screen before the client-side redirect
 * kicks in. Every request that actually returns data is still authorized by the
 * backend, and that remains the real boundary.
 */

/** Segments the panel serves only to a signed-in dispatcher. */
export const PROTECTED_PREFIXES = ['/dispatch', '/orders', '/create-order'] as const;

export const LOGIN_PATH = '/login';
export const HOME_PATH = '/dispatch';

export type GuardDecision =
  | { action: 'continue' }
  | { action: 'redirect'; to: string; withNext?: boolean };

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function resolveRouteGuard(pathname: string, hasSession: boolean): GuardDecision {
  if (pathname === '/') {
    return { action: 'redirect', to: hasSession ? HOME_PATH : LOGIN_PATH };
  }

  if (pathname === LOGIN_PATH) {
    // Sending an already-signed-in user back to the login form is just a dead end.
    return hasSession ? { action: 'redirect', to: HOME_PATH } : { action: 'continue' };
  }

  if (isProtectedPath(pathname) && !hasSession) {
    return { action: 'redirect', to: LOGIN_PATH, withNext: true };
  }

  return { action: 'continue' };
}

/**
 * Guards the `?next=` round trip. Only a plain absolute path on this origin is
 * allowed back — `//evil.com` and `https://evil.com` are browser-valid redirect
 * targets and would turn the login page into an open redirect.
 */
export function sanitizeNextPath(next: string | null | undefined, fallback = HOME_PATH): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
