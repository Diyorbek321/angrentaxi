import {
  decryptCardToken,
  encryptCardToken,
  fingerprintCardToken,
  isValidCardTokenKey,
} from './card-token-crypto';

const KEY = 'a'.repeat(64);
const OTHER_KEY = 'b'.repeat(64);

describe('card-token-crypto', () => {
  it('round-trips a token', () => {
    const stored = encryptCardToken('payme-token-123', KEY);
    expect(decryptCardToken(stored, KEY)).toBe('payme-token-123');
  });

  it('never stores the token in clear text and uses a fresh IV every time', () => {
    const a = encryptCardToken('payme-token-123', KEY);
    const b = encryptCardToken('payme-token-123', KEY);
    expect(a).not.toContain('payme-token-123');
    expect(a).not.toBe(b);
  });

  it('fails closed without a valid key', () => {
    expect(() => encryptCardToken('t', '')).toThrow();
    expect(() => encryptCardToken('t', undefined)).toThrow();
    expect(() => encryptCardToken('t', 'short')).toThrow();
    expect(() => encryptCardToken('t', 'z'.repeat(64))).toThrow();
  });

  it('rejects decryption with the wrong key (auth tag)', () => {
    const stored = encryptCardToken('payme-token-123', KEY);
    expect(() => decryptCardToken(stored, OTHER_KEY)).toThrow();
  });

  it('rejects tampered or malformed ciphertext', () => {
    const [iv, tag, data] = encryptCardToken('payme-token-123', KEY).split(':');
    const flipped = (data[0] === '0' ? '1' : '0') + data.slice(1);
    expect(() => decryptCardToken(`${iv}:${tag}:${flipped}`, KEY)).toThrow();
    expect(() => decryptCardToken('garbage', KEY)).toThrow();
    expect(() => decryptCardToken(`${iv}::${data}`, KEY)).toThrow();
  });

  it('rejects an empty token', () => {
    expect(() => encryptCardToken('', KEY)).toThrow();
  });

  it('fingerprints deterministically', () => {
    expect(fingerprintCardToken('x')).toBe(fingerprintCardToken('x'));
    expect(fingerprintCardToken('x')).not.toBe(fingerprintCardToken('y'));
    expect(fingerprintCardToken('x')).toHaveLength(64);
  });

  it('validates key format', () => {
    expect(isValidCardTokenKey(KEY)).toBe(true);
    expect(isValidCardTokenKey('')).toBe(false);
    expect(isValidCardTokenKey(undefined)).toBe(false);
  });
});
