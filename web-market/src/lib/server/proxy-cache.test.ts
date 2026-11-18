import { describe, expect, it } from 'vitest';
import { cacheControlFor } from './proxy-cache';

describe('cacheControlFor', () => {
  it('katalog rasmi brauzerda uzoq keshlanadi', () => {
    expect(cacheControlFor('GET', ['media', 'catalog', 'abc.jpg'], 200)).toBe(
      'private, max-age=31536000, immutable'
    );
  });

  it('xato javob keshlanmaydi', () => {
    expect(cacheControlFor('GET', ['media', 'catalog', 'abc.jpg'], 404)).toBe('no-store');
  });

  it('API javoblari keshlanmaydi', () => {
    expect(cacheControlFor('GET', ['food', 'vendor', 'dishes'], 200)).toBe('no-store');
    expect(cacheControlFor('GET', ['market', 'vendor', 'products'], 200)).toBe('no-store');
  });

  it('faqat GET keshlanadi', () => {
    expect(cacheControlFor('PUT', ['media', 'catalog', 'abc.jpg'], 200)).toBe('no-store');
  });
});
