import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/server/auth-cookies';
import { LOGIN_PATH, resolveRouteGuard } from '@/lib/route-guard';

/**
 * Server-side route gate. See `lib/route-guard.ts` for what this can and cannot
 * prove — in short: cookie presence only, never token validity.
 *
 * Either cookie counts as a session. The access token may already have expired
 * (its TTL is a backend setting and can change without this code knowing), and in
 * that case the refresh cookie is what says the user still has a live session;
 * the axios interceptor will trade it in on the first 401.
 */
export function middleware(req: NextRequest) {
  const hasSession = Boolean(
    req.cookies.get(ACCESS_TOKEN_COOKIE)?.value || req.cookies.get(REFRESH_TOKEN_COOKIE)?.value
  );

  const decision = resolveRouteGuard(req.nextUrl.pathname, hasSession);
  if (decision.action === 'continue') return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = decision.to;
  url.search = '';
  if (decision.withNext && decision.to === LOGIN_PATH) {
    url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  }
  return NextResponse.redirect(url);
}

export const config = {
  // /api is excluded on purpose: those routes answer with 401 JSON, which the
  // interceptor turns into a refresh. Redirecting them to an HTML login page
  // would hand axios a 200 full of markup and hide the failure.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
