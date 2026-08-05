import { describe, expect, it } from 'vitest';
import {
  HOME_PATH,
  LOGIN_PATH,
  PROTECTED_PREFIXES,
  resolveRouteGuard,
} from './route-guard';

// The CommonJS twin the custom Node server uses. It exists because Next
// middleware does not run behind `app.getRequestHandler()` (see server.js), so
// the guard has to be reachable outside the TypeScript build.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const serverGuard = require('../../server/route-guard.js');

/**
 * Guards against the two copies drifting apart. Drift here is silent and
 * security-relevant: whichever copy the deployed server does NOT use would keep
 * passing its own tests while production quietly stopped protecting a route.
 */
describe('route-guard: TS and CJS copies agree', () => {
  it('protects the same prefixes', () => {
    expect(serverGuard.PROTECTED_PREFIXES).toEqual([...PROTECTED_PREFIXES]);
  });

  it('uses the same login and home paths', () => {
    expect(serverGuard.LOGIN_PATH).toBe(LOGIN_PATH);
    expect(serverGuard.HOME_PATH).toBe(HOME_PATH);
  });

  const cases: Array<[string, boolean]> = [
    ['/', false],
    ['/', true],
    ['/login', false],
    ['/login', true],
    ['/dispatch', false],
    ['/dispatch', true],
    ['/dispatch/drivers', false],
    ['/orders', false],
    ['/orders/abc', false],
    ['/create-order', false],
    ['/dispatch-public', false],
    ['/something-else', false],
    ['/something-else', true],
  ];

  it.each(cases)('decides %s (session=%s) identically', (pathname, hasSession) => {
    expect(serverGuard.resolveRouteGuard(pathname, hasSession)).toEqual(
      resolveRouteGuard(pathname, hasSession)
    );
  });
});

describe('route-guard (CJS): request handling', () => {
  const readCookie = (header: string | undefined, name: string) =>
    header?.includes(`${name}=`) ? 'token' : undefined;

  function run(url: string, cookie?: string) {
    const req = { url, headers: { cookie } };
    const headers: Record<string, string> = {};
    const res = {
      statusCode: 200,
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      end: () => {},
    };
    const handled = serverGuard.applyRouteGuard(req, res, readCookie, 'manager_token');
    return { handled, status: res.statusCode, headers };
  }

  it('redirects a logged-out browser away from a protected route', () => {
    const { handled, status, headers } = run('/dispatch');
    expect(handled).toBe(true);
    expect(status).toBe(307);
    expect(headers.Location).toBe('/login?next=%2Fdispatch');
    // A cookie decides this response — it must never be shared from a cache.
    expect(headers['Cache-Control']).toBe('no-store');
  });

  it('keeps the query string out of the next= round trip', () => {
    const { headers } = run('/dispatch/drivers?page=2');
    expect(headers.Location).toBe('/login?next=%2Fdispatch%2Fdrivers');
  });

  it('lets a signed-in browser through', () => {
    expect(run('/dispatch', 'manager_token=x').handled).toBe(false);
  });

  it('never touches the BFF routes', () => {
    // /api answers 401 JSON so the client interceptor can refresh; redirecting
    // it would hand axios a 200 full of login markup.
    expect(run('/api/proxy/orders').handled).toBe(false);
    expect(run('/api/auth/refresh').handled).toBe(false);
  });

  it('never touches static assets', () => {
    expect(run('/_next/static/chunk.js').handled).toBe(false);
    expect(run('/logo.svg').handled).toBe(false);
    expect(run('/favicon.ico').handled).toBe(false);
  });

  it('does not treat a lookalike prefix as protected', () => {
    expect(run('/dispatch-public').handled).toBe(false);
  });
});
