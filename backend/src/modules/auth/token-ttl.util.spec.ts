import {
  DEFAULT_ACCESS_TTL,
  DEFAULT_REFRESH_TTL,
  parseTtlToMs,
} from './token-ttl.util';

describe('parseTtlToMs', () => {
  it.each([
    ['30', 30 * 1000],
    ['45s', 45 * 1000],
    ['15m', 15 * 60 * 1000],
    ['12h', 12 * 60 * 60 * 1000],
    ['7d', 7 * 24 * 60 * 60 * 1000],
    ['7D', 7 * 24 * 60 * 60 * 1000],
    [' 30d ', 30 * 24 * 60 * 60 * 1000],
  ])('parses %s', (input, expected) => {
    expect(parseTtlToMs(input)).toBe(expected);
  });

  it.each(['', 'soon', '7 weeks', '-1d', '1.5d'])('rejects %p', (input) => {
    expect(() => parseTtlToMs(input)).toThrow(/Invalid token TTL/);
  });

  it('keeps the long defaults until the mobile and web clients ship a refresh flow', () => {
    expect(DEFAULT_ACCESS_TTL).toBe('7d');
    expect(DEFAULT_REFRESH_TTL).toBe('30d');
  });
});
