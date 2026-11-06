import { describe, expect, it } from 'vitest';
import { catalogImageSrc, fitWithin, validateCatalogImage } from './catalog-image';

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

describe('validateCatalogImage', () => {
  it('JPEG/PNG/WEBP qabul qilinadi', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validateCatalogImage({ type, size: 1000 })).toBeNull();
    }
  });

  it('boshqa tur rad etiladi', () => {
    expect(validateCatalogImage({ type: 'image/gif', size: 1000 })).toMatch(/JPEG/);
    expect(validateCatalogImage({ type: 'application/pdf', size: 1000 })).toMatch(/JPEG/);
  });

  it('15 MB dan katta rad etiladi', () => {
    expect(validateCatalogImage({ type: 'image/jpeg', size: 16 * 1024 * 1024 })).toMatch(/katta/);
  });
});

describe('fitWithin', () => {
  it('uzun tomonni 1200 ga tushiradi, nisbat saqlanadi', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 900, height: 1200 });
  });

  it('kichik rasmni kattalashtirmaydi', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
