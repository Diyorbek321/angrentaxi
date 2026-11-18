import * as Sentry from '@sentry/node';
import type { Breadcrumb, Event, NodeOptions } from '@sentry/node';

/**
 * Sentry — kutilmagan (5xx) xatolar uchun. `SENTRY_DSN` bo'lmasa butunlay
 * o'chiq: init chaqirilmaydi, `reportException` hech narsa qilmaydi.
 *
 * Shaxsiy ma'lumot chet elga ketmasin (ZRU-547, 27¹-modda): IP, cookie,
 * Authorization, so'rov tanasi va query yuborilmaydi, telefon raqamlari
 * yashiriladi. Faqat foydalanuvchi id (UUID) qolishi mumkin.
 */

type Env = Record<string, string | undefined>;

export interface ErrorRouteContext {
  method: string;
  path: string;
  statusCode: number;
}

const DROPPED_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key']);
const UZ_PHONE = /\+?998\d{9}/g;

function maskPhones(text: string | undefined): string | undefined {
  return text === undefined ? undefined : text.replace(UZ_PHONE, (m) => (m.startsWith('+') ? '+998***' : '998***'));
}

function sampleRate(raw: string | undefined): number {
  const value = Number(raw);
  return raw !== undefined && Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
}

export function buildSentryOptions(env: Env): NodeOptions | null {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return null;
  return {
    dsn,
    environment: env.NODE_ENV || 'development',
    release: env.SENTRY_RELEASE?.trim() || undefined,
    sendDefaultPii: false,
    // Bepul tarifdagi kvotani xatolarga qoldiramiz; tracing faqat atayin.
    tracesSampleRate: sampleRate(env.SENTRY_TRACES_SAMPLE_RATE),
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}

function scrubRequest(request: NonNullable<Event['request']>): Event['request'] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cookies, data, query_string, headers, ...rest } = request;
  if (!headers) return rest;
  return {
    ...rest,
    headers: Object.fromEntries(
      Object.entries(headers).filter(([k]) => !DROPPED_HEADERS.has(k.toLowerCase())),
    ),
  };
}

export function scrubEvent(event: Event): Event {
  const scrubbed: Event = { ...event };
  if (event.message !== undefined) scrubbed.message = maskPhones(event.message);
  if (event.exception?.values) {
    scrubbed.exception = {
      ...event.exception,
      values: event.exception.values.map((v) => ({ ...v, value: maskPhones(v.value) })),
    };
  }
  if (event.request) scrubbed.request = scrubRequest(event.request);
  if (event.user) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ip_address, ...user } = event.user;
    scrubbed.user = user;
  }
  return scrubbed;
}

/** Chiquvchi so'rov URL'idan query (kalit/telefon bo'lishi mumkin) olib tashlanadi. */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  const url = crumb.data?.['url'];
  return {
    ...crumb,
    ...(crumb.message !== undefined ? { message: maskPhones(crumb.message) } : {}),
    ...(typeof url === 'string' ? { data: { ...crumb.data, url: maskPhones(url.split('?')[0]) } } : {}),
  };
}

export function initErrorReporting(env: Env = process.env): boolean {
  const options = buildSentryOptions(env);
  if (!options) return false;
  Sentry.init(options);
  return true;
}

export function reportException(exception: unknown, route: ErrorRouteContext): void {
  if (!Sentry.getCurrentHub().getClient()) return;
  Sentry.withScope((scope) => {
    scope.setTag('http.method', route.method);
    scope.setTag('http.path', route.path.split('?')[0]);
    scope.setTag('http.status_code', String(route.statusCode));
    Sentry.captureException(exception);
  });
}
