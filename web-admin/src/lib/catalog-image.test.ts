import { describe, expect, it } from 'vitest';
import { catalogImageSrc } from './catalog-image';

describe('catalogImageSrc', () => {
  it('kalitni proksi orqali media yo‘liga aylantiradi', () => {
    expect(catalogImageSrc('catalog/abc.jpg')).toBe('/api/proxy/media/catalog/abc.jpg');
  });

  it('kalit yo‘q — null', () => {
    expect(catalogImageSrc(null)).toBeNull();
    expect(catalogImageSrc(undefined)).toBeNull();
    expect(catalogImageSrc('')).toBeNull();
  });
});
