import { NextResponse, type NextRequest } from 'next/server';
import { API_BASE_URL } from '@/lib/server/api-config';
import { REFRESH_TOKEN_COOKIE, clearSessionCookies } from '@/lib/server/auth-cookies';
import { crossOriginRejection, isSameOrigin } from '@/lib/server/same-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ends the session.
 *
 * Order matters: the backend is told to revoke the refresh token *first*, while we
 * still have it, and the cookies are cleared afterwards no matter how that call
 * went. Clearing first would leave a live refresh token on the server with nothing
 * left to revoke it with.
 *
 * The backend's /auth/logout takes the refresh token in the body and needs no
 * Authorization header; it answers 200 even for an unknown or already-revoked
 * token, so there is nothing to branch on.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return crossOriginRejection();

  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
    } catch {
      // Best effort. A logout the user asked for always clears this browser,
      // even when the backend is unreachable.
    }
  }

  const res = NextResponse.json({ success: true });
  clearSessionCookies(res);
  return res;
}
