import { NextResponse, type NextRequest } from 'next/server';
import { API_BASE_URL } from '@/lib/server/api-config';
import {
  REFRESH_TOKEN_COOKIE,
  clearSessionCookies,
  setSessionCookies,
} from '@/lib/server/auth-cookies';
import { crossOriginRejection, isSameOrigin } from '@/lib/server/same-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Swaps the refresh cookie for a fresh token pair.
 *
 * The backend rotates refresh tokens: the one we present is revoked the moment it
 * is accepted, and replaying a revoked token kills every session the user has. So
 * this handler must be called at most once per rotation — the browser side keeps
 * a single-flight lock for that (see `lib/session.ts`).
 *
 * Older backend builds answered with only `{ accessToken }`. That still works:
 * `setSessionCookies` leaves the refresh cookie untouched when no new one arrives.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return crossOriginRejection();

  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    const res = NextResponse.json(
      { success: false, message: 'No refresh token' },
      { status: 401 }
    );
    clearSessionCookies(res);
    return res;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
  } catch {
    // A network blip is not proof the session is gone — keep the cookies so the
    // next attempt can still succeed.
    return NextResponse.json(
      { success: false, message: 'Serverga ulanib boʻlmadi' },
      { status: 502 }
    );
  }

  const payload = (await upstream.json().catch(() => null)) as {
    data?: { accessToken?: string; refreshToken?: string };
  } | null;

  if (!upstream.ok || !payload?.data?.accessToken) {
    const res = NextResponse.json(
      { success: false, message: 'Session expired' },
      { status: 401 }
    );
    clearSessionCookies(res);
    return res;
  }

  const res = NextResponse.json({ success: true });
  setSessionCookies(res, {
    accessToken: payload.data.accessToken,
    refreshToken: payload.data.refreshToken,
  });
  return res;
}
