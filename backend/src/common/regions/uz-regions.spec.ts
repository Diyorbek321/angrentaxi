import {
  isPickupAllowedForLicence,
  normalizeRegion,
  UZ_REGION_CODES,
  UZ_REGION_NEIGHBOURS,
} from './uz-regions';

describe('uz-regions', () => {
  it('14 hudud: 12 viloyat + Qoraqalpog\'iston + Toshkent shahri', () => {
    expect(UZ_REGION_CODES).toHaveLength(14);
  });

  it("qo'shnichilik simmetrik va o'ziga qo'shni emas", () => {
    for (const code of UZ_REGION_CODES) {
      for (const n of UZ_REGION_NEIGHBOURS[code]) {
        expect(n).not.toBe(code);
        expect(UZ_REGION_NEIGHBOURS[n]).toContain(code);
      }
    }
  });

  it('Toshkent viloyati — Toshkent shahri, Sirdaryo, Namangan bilan chegaradosh', () => {
    expect([...UZ_REGION_NEIGHBOURS['UZ-TO']].sort()).toEqual(['UZ-NG', 'UZ-SI', 'UZ-TK']);
    expect(UZ_REGION_NEIGHBOURS['UZ-TK']).toEqual(['UZ-TO']);
  });

  describe('normalizeRegion', () => {
    it.each([
      ['UZ-TO', 'UZ-TO'],
      ['uz-to', 'UZ-TO'],
      ['Toshkent viloyati', 'UZ-TO'],
      ["Toshkent vil.", 'UZ-TO'],
      ['Ташкентская область', 'UZ-TO'],
      ['Angren', 'UZ-TO'],
      ['Toshkent shahri', 'UZ-TK'],
      ['Toshkent sh.', 'UZ-TK'],
      ['г. Ташкент', 'UZ-TK'],
      ['Toshkent', 'UZ-TK'],
      ["Farg'ona viloyati", 'UZ-FA'],
      ['Фергана', 'UZ-FA'],
      ["Qoraqalpog'iston Respublikasi", 'UZ-QR'],
      ['Samarkand', 'UZ-SA'],
    ])('%s → %s', (input, code) => {
      expect(normalizeRegion(input)).toBe(code);
    });

    it("tanilmagan, bo'sh yoki null — null", () => {
      expect(normalizeRegion('Bishkek')).toBeNull();
      expect(normalizeRegion('  ')).toBeNull();
      expect(normalizeRegion(null)).toBeNull();
    });
  });

  describe('isPickupAllowedForLicence', () => {
    it("o'z hududi va qo'shni hudud — ruxsat", () => {
      expect(isPickupAllowedForLicence('UZ-TO', 'UZ-TO')).toBe(true);
      expect(isPickupAllowedForLicence('UZ-TO', 'UZ-TK')).toBe(true);
    });

    it("chegaradosh bo'lmagan hudud — rad", () => {
      expect(isPickupAllowedForLicence('UZ-TO', 'UZ-SA')).toBe(false);
      expect(isPickupAllowedForLicence('UZ-TK', 'UZ-SI')).toBe(false);
    });

    it("eski erkin matnli litsenziya ham tushuniladi", () => {
      expect(isPickupAllowedForLicence('Toshkent viloyati', 'UZ-TK')).toBe(true);
      expect(isPickupAllowedForLicence('Samarqand viloyati', 'UZ-TO')).toBe(false);
    });

    it("hudud noma'lum (kiritilmagan, tanilmagan yoki zakaz shahri hududsiz) — cheklanmaydi", () => {
      expect(isPickupAllowedForLicence(null, 'UZ-TO')).toBe(true);
      expect(isPickupAllowedForLicence('Bishkek', 'UZ-TO')).toBe(true);
      expect(isPickupAllowedForLicence('UZ-SA', null)).toBe(true);
    });
  });
});
