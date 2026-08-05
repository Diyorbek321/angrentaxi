/**
 * Route-guard decision table for the custom Node server.
 *
 * WHY THIS EXISTS (and duplicates src/lib/route-guard.ts):
 *
 * Next.js middleware does not run when the app is served through a custom
 * server via `app.getRequestHandler()` — the standalone `server.js` Next
 * generates is what wires middleware in, and this panel replaces that server in
 * order to hook the HTTP `upgrade` event for the socket.io proxy. Deploying the
 * custom server without this module silently drops the middleware route guard:
 * `/dispatch` answers 200 to a logged-out browser instead of redirecting.
 *
 * So the same decision table has to be reachable from plain CommonJS, outside
 * the TypeScript build. `route-guard.contract.test.ts` asserts this file and
 * `src/lib/route-guard.ts` stay in agreement, so the duplication cannot drift.
 *
 * ⚠️ Same caveat as the TS copy: this is a *coarse* gate, not authentication.
 * It only observes whether a session cookie exists — the JWT signing key lives
 * in the backend, so a hand-written cookie gets past it. Its only job is to stop
 * a logged-out browser from rendering a dispatcher screen. The backend remains
 * the real boundary.
 */

/** Segments the panel serves only to a signed-in dispatcher. */
const PROTECTED_PREFIXES = ['/dispatch', '/orders', '/create-order'];

const LOGIN_PATH = '/login';
const HOME_PATH = '/dispatch';

/** Paths the guard must never touch: Next internals, the BFF, and static files. */
const EXEMPT = /^\/(?:api|_next\/static|_next\/image|favicon\.ico)|\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/;

function isExemptPath(pathname) {
  return EXEMPT.test(pathname);
}

function isProtectedPath(pathname) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function resolveRouteGuard(pathname, hasSession) {
  if (pathname === '/') {
    return { action: 'redirect', to: hasSession ? HOME_PATH : LOGIN_PATH };
  }

  if (pathname === LOGIN_PATH) {
    return hasSession ? { action: 'redirect', to: HOME_PATH } : { action: 'continue' };
  }

  if (isProtectedPath(pathname) && !hasSession) {
    return { action: 'redirect', to: LOGIN_PATH, withNext: true };
  }

  return { action: 'continue' };
}

/**
 * Applies the guard to a raw Node request. Returns true when it has answered
 * the request (and the caller must not hand it to Next), false otherwise.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {(cookieHeader: string | undefined, name: string) => string | undefined} readCookie
 * @param {string} cookieName
 */
function applyRouteGuard(req, res, readCookie, cookieName) {
  const url = req.url || '/';
  const pathname = url.split('?')[0];

  if (isExemptPath(pathname)) return false;

  const hasSession = Boolean(readCookie(req.headers.cookie, cookieName));
  const decision = resolveRouteGuard(pathname, hasSession);

  if (decision.action !== 'redirect') return false;

  const location = decision.withNext
    ? `${decision.to}?next=${encodeURIComponent(pathname)}`
    : decision.to;

  res.statusCode = 307;
  res.setHeader('Location', location);
  // A cookie decides this response, so a shared cache must not reuse it.
  res.setHeader('Cache-Control', 'no-store');
  res.end();
  return true;
}

module.exports = {
  PROTECTED_PREFIXES,
  LOGIN_PATH,
  HOME_PATH,
  applyRouteGuard,
  isExemptPath,
  isProtectedPath,
  resolveRouteGuard,
};
