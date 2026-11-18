import * as Sentry from '@sentry/node';
import type { Event } from '@sentry/node';
import {
  buildSentryOptions,
  reportException,
  scrubBreadcrumb,
  scrubEvent,
} from './error-reporting';

describe('error-reporting', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('buildSentryOptions', () => {
    it('returns null without a DSN — Sentry stays off', () => {
      expect(buildSentryOptions({})).toBeNull();
      expect(buildSentryOptions({ SENTRY_DSN: '  ' })).toBeNull();
    });

    it('never sends default PII and tags the release and environment', () => {
      const options = buildSentryOptions({
        SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1',
        NODE_ENV: 'production',
        SENTRY_RELEASE: '6eec124',
      });
      expect(options).toMatchObject({
        dsn: 'https://key@o1.ingest.sentry.io/1',
        environment: 'production',
        release: '6eec124',
        sendDefaultPii: false,
        tracesSampleRate: 0,
      });
      expect(options?.beforeSend).toBe(scrubEvent);
      expect(options?.beforeBreadcrumb).toBe(scrubBreadcrumb);
    });

    it('reads a valid traces sample rate and ignores a broken one', () => {
      const base = { SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1' };
      expect(buildSentryOptions({ ...base, SENTRY_TRACES_SAMPLE_RATE: '0.2' })?.tracesSampleRate).toBe(0.2);
      expect(buildSentryOptions({ ...base, SENTRY_TRACES_SAMPLE_RATE: 'abc' })?.tracesSampleRate).toBe(0);
      expect(buildSentryOptions({ ...base, SENTRY_TRACES_SAMPLE_RATE: '5' })?.tracesSampleRate).toBe(0);
    });
  });

  describe('scrubEvent', () => {
    it('drops auth headers, cookies, body, query and the user IP', () => {
      const event: Event = {
        request: {
          url: '/api/v1/orders',
          headers: { authorization: 'Bearer secret', cookie: 'a=b', 'user-agent': 'okhttp' },
          cookies: { a: 'b' },
          data: { phone: '+998901234567' },
          query_string: 'phone=998901234567',
        },
        user: { id: 'u-1', ip_address: '1.2.3.4' },
      };
      const scrubbed = scrubEvent(event);
      expect(scrubbed.request?.headers).toEqual({ 'user-agent': 'okhttp' });
      expect(scrubbed.request?.cookies).toBeUndefined();
      expect(scrubbed.request?.data).toBeUndefined();
      expect(scrubbed.request?.query_string).toBeUndefined();
      expect(scrubbed.user).toEqual({ id: 'u-1' });
    });

    it('masks Uzbek phone numbers in the message and exception values', () => {
      const event: Event = {
        message: 'User +998901234567 not found',
        exception: { values: [{ type: 'Error', value: 'duplicate key 998931913308' }] },
      };
      const scrubbed = scrubEvent(event);
      expect(scrubbed.message).toBe('User +998*** not found');
      expect(scrubbed.exception?.values?.[0].value).toBe('duplicate key 998***');
    });

    it('does not mutate the original event', () => {
      const event: Event = { message: '+998901234567', request: { headers: { cookie: 'x' } } };
      scrubEvent(event);
      expect(event.message).toBe('+998901234567');
      expect(event.request?.headers).toEqual({ cookie: 'x' });
    });
  });

  describe('scrubBreadcrumb', () => {
    it('drops the query string from outgoing request URLs and masks phones', () => {
      const crumb = scrubBreadcrumb({
        category: 'http',
        message: 'SMS to +998901234567',
        data: { url: 'https://notify.eskiz.uz/api/message?phone=998901234567&token=x', method: 'POST' },
      });
      expect(crumb.message).toBe('SMS to +998***');
      expect(crumb.data).toEqual({ url: 'https://notify.eskiz.uz/api/message', method: 'POST' });
    });

    it('leaves a breadcrumb without URL or message untouched', () => {
      expect(scrubBreadcrumb({ category: 'console', level: 'info' })).toEqual({ category: 'console', level: 'info' });
    });
  });

  describe('reportException', () => {
    it('is a no-op while Sentry is not initialised', () => {
      jest.spyOn(Sentry, 'getCurrentHub').mockReturnValue({ getClient: () => undefined } as never);
      const capture = jest.spyOn(Sentry, 'captureException');
      reportException(new Error('x'), { method: 'GET', path: '/a', statusCode: 500 });
      expect(capture).not.toHaveBeenCalled();
    });

    it('captures with route tags once Sentry is live', () => {
      jest.spyOn(Sentry, 'getCurrentHub').mockReturnValue({ getClient: () => ({}) } as never);
      const scope = { setTag: jest.fn(), setLevel: jest.fn() };
      jest.spyOn(Sentry, 'withScope').mockImplementation(((cb: (s: never) => void) => cb(scope as never)) as never);
      const capture = jest.spyOn(Sentry, 'captureException').mockReturnValue('id');

      const error = new Error('boom');
      reportException(error, { method: 'POST', path: '/api/v1/orders?x=1', statusCode: 500 });

      expect(scope.setTag).toHaveBeenCalledWith('http.method', 'POST');
      expect(scope.setTag).toHaveBeenCalledWith('http.path', '/api/v1/orders');
      expect(scope.setTag).toHaveBeenCalledWith('http.status_code', '500');
      expect(capture).toHaveBeenCalledWith(error);
    });
  });
});
