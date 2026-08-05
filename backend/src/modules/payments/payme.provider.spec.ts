import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PaymeProvider } from './payme.provider';

/**
 * Callback authentication for Payme. The critical property under test is
 * fail-closed behaviour: with no merchant key configured the provider must
 * reject every callback rather than compare the caller's password against
 * an empty string (which any caller can trivially supply).
 */
describe('PaymeProvider - verifyCallbackSignature()', () => {
  const MERCHANT_ID = 'merchant-123';
  const SECRET_KEY = 'super-secret-payme-key';

  function makeProvider(config: Record<string, string>): PaymeProvider {
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) =>
        key in config ? config[key] : (defaultValue ?? ''),
      ),
    } as unknown as ConfigService;

    return new PaymeProvider(configService);
  }

  function basicAuth(password: string, login = 'Paycom'): string {
    return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
  }

  const configured = { PAYME_MERCHANT_ID: MERCHANT_ID, PAYME_SECRET_KEY: SECRET_KEY };

  it('fails closed when no keys are configured, even with an empty password', () => {
    const provider = makeProvider({});

    // The pre-fix exploit: `Basic base64("x:")` decoded to an empty password
    // which compared equal to the empty default secret key.
    expect(provider.verifyCallbackSignature({}, basicAuth('', 'x'))).toBe(false);
    expect(provider.verifyCallbackSignature({}, basicAuth('anything'))).toBe(false);
  });

  it('fails closed when only the merchant id is configured', () => {
    const provider = makeProvider({ PAYME_MERCHANT_ID: MERCHANT_ID });

    expect(provider.verifyCallbackSignature({}, basicAuth(''))).toBe(false);
  });

  it('fails closed when only the secret key is configured', () => {
    const provider = makeProvider({ PAYME_SECRET_KEY: SECRET_KEY });

    expect(provider.verifyCallbackSignature({}, basicAuth(SECRET_KEY))).toBe(false);
  });

  it('accepts the raw secret key when configured', () => {
    const provider = makeProvider(configured);

    expect(provider.verifyCallbackSignature({}, basicAuth(SECRET_KEY))).toBe(true);
  });

  it('accepts the sha1(merchantId + secretKey) digest when configured', () => {
    const provider = makeProvider(configured);
    const digest = createHash('sha1')
      .update(`${MERCHANT_ID}${SECRET_KEY}`)
      .digest('hex');

    expect(provider.verifyCallbackSignature({}, basicAuth(digest))).toBe(true);
  });

  it('rejects a wrong password when configured', () => {
    const provider = makeProvider(configured);

    expect(provider.verifyCallbackSignature({}, basicAuth('wrong-key'))).toBe(false);
  });

  it('rejects an empty, missing or malformed Authorization header', () => {
    const provider = makeProvider(configured);

    expect(provider.verifyCallbackSignature({}, '')).toBe(false);
    expect(provider.verifyCallbackSignature({}, undefined as unknown as string)).toBe(false);
    expect(provider.verifyCallbackSignature({}, basicAuth(''))).toBe(false);
    expect(provider.verifyCallbackSignature({}, 'Basic not-base64-at-all')).toBe(false);
  });

  it('handles a secret key containing colons (splits on the first colon only)', () => {
    const keyWithColon = 'part-one:part-two';
    const provider = makeProvider({
      PAYME_MERCHANT_ID: MERCHANT_ID,
      PAYME_SECRET_KEY: keyWithColon,
    });

    expect(provider.verifyCallbackSignature({}, basicAuth(keyWithColon))).toBe(true);
  });
});
