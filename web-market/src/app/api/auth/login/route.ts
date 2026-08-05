import { NextResponse, type NextRequest } from 'next/server';
import { API_BASE_URL } from '@/lib/server/api-config';
import { setSessionCookies } from '@/lib/server/auth-cookies';
import { crossOriginRejection, isSameOrigin } from '@/lib/server/same-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Exchanges an OTP for a session.
 *
 * The tokens never reach the browser's JS: they are read out of the backend
 * response here and written straight into httpOnly cookies. Only the user
 * profile is returned, because the panel chrome needs a name to render.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return crossOriginRejection();

  let body: { phone?: unknown; code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
  }

  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!phone || !code) {
    return NextResponse.json(
      { success: false, message: 'Telefon raqam va kod talab qilinadi' },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Serverga ulanib boʻlmadi' },
      { status: 502 }
    );
  }

  const payload = (await upstream.json().catch(() => null)) as {
    data?: { accessToken?: string; refreshToken?: string; user?: { role?: string } };
    message?: string;
  } | null;

  if (!upstream.ok || !payload?.data?.accessToken || !payload.data.user) {
    return NextResponse.json(
      { success: false, message: payload?.message || 'Notoʻgʻri kod' },
      { status: upstream.ok ? 502 : upstream.status }
    );
  }

  const { accessToken, refreshToken, user } = payload.data;

  // The role gate used to live in the login page, where the session cookie was
  // already written before the check ran and anyone could skip it by calling the
  // backend directly. It is not an authorization boundary — the backend still
  // enforces permissions per endpoint — but it stops a token for the wrong kind
  // of account from being planted in this panel's cookie at all.
  if (user.role !== 'market') {
    return NextResponse.json(
      { success: false, message: 'Bu panel faqat sotuvchilar uchun' },
      { status: 403 }
    );
  }

  const res = NextResponse.json({ success: true, data: { user } });
  setSessionCookies(res, { accessToken, refreshToken });
  return res;
}
