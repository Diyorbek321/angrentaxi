import { NextResponse, type NextRequest } from 'next/server';
import { API_BASE_URL } from '@/lib/server/api-config';
import { ACCESS_TOKEN_COOKIE } from '@/lib/server/auth-cookies';
import { crossOriginRejection, isSameOrigin } from '@/lib/server/same-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Backend-for-frontend passthrough.
 *
 * Every call the panel makes goes through here instead of straight to the backend.
 * That is what lets the access token be `httpOnly`: the browser attaches the cookie
 * to this same-origin request, and the Bearer header is attached server-side where
 * no page script can observe it.
 *
 * The proxy is deliberately dumb — it does not interpret status codes, refresh
 * tokens or retry. A 401 is handed back unchanged so the browser's interceptor can
 * run its single-flight refresh; doing it here would mean N concurrent requests
 * each triggering their own rotation.
 */

// Headers that describe *our* hop to the backend, or that the backend must decide
// for itself. Everything else the page sent (Accept, Content-Type, …) rides along.
const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept', 'accept-language'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'content-disposition', 'content-language'];

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD']);
const SAFE_METHODS = new Set(['GET', 'HEAD']);

function buildTargetUrl(segments: string[], search: string): string | null {
  // `..` and empty segments would let a caller climb out of the API prefix and
  // aim this proxy at an arbitrary path on the backend host.
  if (segments.length === 0) return null;
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..') return null;
  }
  return `${API_BASE_URL}/${segments.join('/')}${search}`;
}

async function forward(req: NextRequest, segments: string[]): Promise<NextResponse> {
  if (!SAFE_METHODS.has(req.method) && !isSameOrigin(req)) {
    return crossOriginRejection();
  }

  const target = buildTargetUrl(segments, req.nextUrl.search);
  if (!target) {
    return NextResponse.json({ success: false, message: 'Invalid path' }, { status: 400 });
  }

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (token) headers.set('authorization', `Bearer ${token}`);

  const body = METHODS_WITHOUT_BODY.has(req.method) ? undefined : await req.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      // A zero-length buffer on POST is still a body; undefined is not.
      body: body && body.byteLength > 0 ? body : undefined,
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Serverga ulanib boʻlmadi' },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set('Cache-Control', 'no-store');

  // 204/304 must not carry a body, and the backend's own Set-Cookie headers are
  // intentionally dropped — session state on this origin is ours alone.
  const hasBody = upstream.status !== 204 && upstream.status !== 304;
  return new NextResponse(hasBody ? await upstream.arrayBuffer() : null, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type Context = { params: { path: string[] } };

export const GET = (req: NextRequest, ctx: Context) => forward(req, ctx.params.path);
export const POST = (req: NextRequest, ctx: Context) => forward(req, ctx.params.path);
export const PUT = (req: NextRequest, ctx: Context) => forward(req, ctx.params.path);
export const PATCH = (req: NextRequest, ctx: Context) => forward(req, ctx.params.path);
export const DELETE = (req: NextRequest, ctx: Context) => forward(req, ctx.params.path);
