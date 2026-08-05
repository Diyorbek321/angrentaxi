import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE } from '@/lib/server/auth-cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Hands the *access* token to the page so socket.io can authenticate its handshake.
 *
 * Be honest about what this costs: the websocket goes straight from the browser to
 * the backend host, which is a different origin, so the cookie is never attached
 * and socket.io has no way to read it. The token has to be in JS for the handshake
 * to work at all, and anything that can call this endpoint can get it.
 *
 * What it still buys, and the reason it is scoped this narrowly:
 *   - the *refresh* token stays unreachable, so a script cannot mint itself a
 *     long-lived session — it is limited to the current access token's lifetime;
 *   - the access token is never at rest in a place a script can scrape passively
 *     (document.cookie), only obtainable through a deliberate same-origin call.
 *
 * Proxying the websocket through this Next server would remove the exposure
 * entirely and is the right long-term fix; it is not a cookie change.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json(
    { success: true, data: { token } },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
