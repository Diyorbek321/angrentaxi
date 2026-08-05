import { NextResponse, type NextRequest } from 'next/server';

/**
 * Once the token lives in a cookie, the browser attaches it to *any* request the
 * page's origin receives — including one a hostile site triggers. `SameSite=strict`
 * already stops that, but it is a single point of failure, so state-changing
 * requests additionally have to come from our own origin.
 *
 * A missing Origin header is allowed: same-origin GET/HEAD navigations and some
 * older clients omit it entirely, and rejecting those would break the panel
 * without buying anything (a cross-site attacker's browser always sends one).
 */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  // Behind Railway's router the request URL and the Host header can disagree, so
  // every host the edge might have rewritten to counts as "us".
  const allowed = new Set(
    [req.nextUrl.host, req.headers.get('host'), req.headers.get('x-forwarded-host')].filter(
      (h): h is string => Boolean(h)
    )
  );
  try {
    return allowed.has(new URL(origin).host);
  } catch {
    return false;
  }
}

export function crossOriginRejection(): NextResponse {
  return NextResponse.json(
    { success: false, message: 'Cross-origin request rejected' },
    { status: 403 }
  );
}
