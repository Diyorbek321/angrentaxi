import { describe, expect, it } from 'vitest';
import { licenceRegionState, regionName, regionOptions, UZ_REGIONS } from './uz-regions';

describe('uz-regions', () => {
  it('14 hudud, kodlar takrorlanmaydi', () => {
    expect(new Set(UZ_REGIONS.map((r) => r.code)).size).toBe(14);
  });

  it('kod → nom; kod emas → null', () => {
    expect(regionName('UZ-TO')).toBe('Toshkent viloyati');
    expect(regionName('Toshkent viloyati')).toBeNull();
  });

  it('variantlar alifbo tartibida, hammasi bor', () => {
    const labels = regionOptions().map((o) => o.label);
    expect(labels).toHaveLength(14);
    expect([...labels].sort((a, b) => a.localeCompare(b))).toEqual(labels);
  });

  it("holat: bo'sh, eski matn, kod", () => {
    expect(licenceRegionState(null)).toEqual({ kind: 'missing' });
    expect(licenceRegionState('  ')).toEqual({ kind: 'missing' });
    expect(licenceRegionState('Angren')).toEqual({ kind: 'legacy', text: 'Angren' });
    expect(licenceRegionState('UZ-TK')).toEqual({ kind: 'ok', code: 'UZ-TK', name: 'Toshkent shahri' });
  });
});
