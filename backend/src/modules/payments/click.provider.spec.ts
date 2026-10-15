import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ClickProvider } from './click.provider';

/**
 * Callback signature verification for Click. Every field of the signed
 * string except the secret key comes from the request body, so an
 * unconfigured (empty) key lets any caller forge a valid signature — the
 * provider must therefore fail closed.
 */
describe('ClickProvider - verifyCallbackSignature()', () => {
  const MERCHANT_ID = 'merchant-1';
  const SERVICE_ID = 'service-1';
  const SECRET_KEY = 'super-secret-click-key';

  function makeProvider(config: Record<string, string>): ClickProvider {
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) =>
        key in config ? config[key] : (defaultValue ?? ''),
      ),
    } as unknown as ConfigService;

    return new ClickProvider(configService);
  }

  const configured = {
    CLICK_MERCHANT_ID: MERCHANT_ID,
    CLICK_SERVICE_ID: SERVICE_ID,
    CLICK_SECRET_KEY: SECRET_KEY,
  };

  const baseBody = {
    click_trans_id: '111',
    service_id: SERVICE_ID,
    merchant_trans_id: 'order-1',
    amount: 5000,
    action: 2,
    sign_time: '2026-08-05 10:00:00',
  };

  function signedBody(
    secretKey: string,
    overrides: Record<string, string | number> = {},
  ): Record<string, unknown> {
    const body = { ...baseBody, ...overrides };
    const signatureString = `${body.click_trans_id}${body.service_id}${secretKey}${body.merchant_trans_id}${body.amount}${body.action}${body.sign_time}`;

    return {
      ...body,
      sign_string: createHash('md5').update(signatureString).digest('hex'),
    };
  }

  it('fails closed when no secret key is configured, even for a self-computed signature', () => {
    const provider = makeProvider({ CLICK_SERVICE_ID: SERVICE_ID });

    // The pre-fix exploit: with an empty key the attacker knows every part
    // of the signed string and can produce a signature that matches.
    const forged = signedBody('');

    expect(provider.verifyCallbackSignature(forged)).toBe(false);
  });

  it('fails closed when the service id is not configured', () => {
    const provider = makeProvider({ CLICK_SECRET_KEY: SECRET_KEY });

    expect(provider.verifyCallbackSignature(signedBody(SECRET_KEY))).toBe(false);
  });

  it('accepts a correctly signed callback when configured', () => {
    const provider = makeProvider(configured);

    expect(provider.verifyCallbackSignature(signedBody(SECRET_KEY))).toBe(true);
  });

  it('rejects a callback signed with the wrong key', () => {
    const provider = makeProvider(configured);

    expect(provider.verifyCallbackSignature(signedBody('not-the-key'))).toBe(false);
  });

  it('rejects a callback whose fields were tampered with after signing', () => {
    const provider = makeProvider(configured);
    const tampered = { ...signedBody(SECRET_KEY), amount: 1 };

    expect(provider.verifyCallbackSignature(tampered)).toBe(false);
  });

  it('rejects a callback for a different service id even if correctly signed', () => {
    const provider = makeProvider(configured);
    const otherService = signedBody(SECRET_KEY, { service_id: 'service-999' });

    expect(provider.verifyCallbackSignature(otherService)).toBe(false);
  });

  it('rejects a callback with a missing or non-string signature', () => {
    const provider = makeProvider(configured);

    expect(provider.verifyCallbackSignature({ ...baseBody })).toBe(false);
    expect(
      provider.verifyCallbackSignature({ ...baseBody, sign_string: 12345 }),
    ).toBe(false);
    expect(
      provider.verifyCallbackSignature({ ...baseBody, sign_string: '' }),
    ).toBe(false);
  });

  describe('Click SHOP API: prepare (0) / complete (1)', () => {
    const sign = (parts: string) => createHash('md5').update(parts).digest('hex');

    it("complete imzosiga merchant_prepare_id kiradi", () => {
      const provider = makeProvider(configured);
      const body = {
        ...baseBody,
        merchant_trans_id: 'topup_x',
        action: 1,
        merchant_prepare_id: 42,
      };
      const good = sign(`111${SERVICE_ID}${SECRET_KEY}topup_x42${body.amount}1${body.sign_time}`);
      expect(provider.verifyCallbackSignature({ ...body, sign_string: good })).toBe(true);
      // prepare_id'siz hisoblangan imzo complete uchun yaroqsiz.
      const withoutPrepare = sign(`111${SERVICE_ID}${SECRET_KEY}topup_x${body.amount}1${body.sign_time}`);
      expect(provider.verifyCallbackSignature({ ...body, sign_string: withoutPrepare })).toBe(false);
    });

    it("prepare imzosiga merchant_prepare_id kirmaydi", () => {
      const provider = makeProvider(configured);
      const body = { ...baseBody, merchant_trans_id: 'topup_x', action: 0 };
      const good = sign(`111${SERVICE_ID}${SECRET_KEY}topup_x${body.amount}0${body.sign_time}`);
      expect(provider.verifyCallbackSignature({ ...body, sign_string: good })).toBe(true);
    });

    it('isConfigured — uchala kalit kerak', () => {
      expect(makeProvider(configured).isConfigured()).toBe(true);
      expect(makeProvider({ CLICK_SERVICE_ID: SERVICE_ID }).isConfigured()).toBe(false);
    });
  });
});
