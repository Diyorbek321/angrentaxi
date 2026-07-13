import { resolveCorsOrigin } from './cors-origin.util';

describe('resolveCorsOrigin', () => {
  it('denies all cross-origin requests when unset in production', () => {
    expect(resolveCorsOrigin('production', undefined)).toBe(false);
  });

  it('denies all cross-origin requests when set to an empty string in production', () => {
    expect(resolveCorsOrigin('production', '')).toBe(false);
  });

  it('returns a permissive localhost default when unset in development', () => {
    const result = resolveCorsOrigin('development', undefined);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(expect.arrayContaining(['http://localhost:3000']));
  });

  it('returns a permissive localhost default when NODE_ENV is unset', () => {
    const result = resolveCorsOrigin(undefined, undefined);

    expect(Array.isArray(result)).toBe(true);
    expect((result as string[]).length).toBeGreaterThan(0);
  });

  it('parses a comma-separated CORS_ORIGIN into an array of allowed origins', () => {
    const result = resolveCorsOrigin(
      'production',
      'https://app.angrentaxi.uz,https://admin.angrentaxi.uz',
    );

    expect(result).toEqual(['https://app.angrentaxi.uz', 'https://admin.angrentaxi.uz']);
  });

  it('trims whitespace around each origin in the comma-separated list', () => {
    const result = resolveCorsOrigin(
      'development',
      ' https://app.angrentaxi.uz , https://admin.angrentaxi.uz ',
    );

    expect(result).toEqual(['https://app.angrentaxi.uz', 'https://admin.angrentaxi.uz']);
  });

  it('respects an explicit CORS_ORIGIN even in development', () => {
    const result = resolveCorsOrigin('development', 'https://staging.angrentaxi.uz');

    expect(result).toEqual(['https://staging.angrentaxi.uz']);
  });
});
