import { LegalLang, LegalPage } from '../account-deletion/legal-pages.content';
import { driverTermsPage } from './legal-driver-terms.content';
import { legalPolicy } from './legal-policy';
import { TermsContext } from './legal-terms-context';
import { termsPage } from './legal-terms.content';
import { vendorTermsPage } from './legal-vendor-terms.content';
import { LEGAL_VERSIONS } from './legal-versions';

const ctx = (commissionRate = 12): TermsContext => ({
  operator: 'Angren Taxi MChJ',
  supportPhone: '+998 90 000 00 00',
  updated: '2026-11-03',
  privacyUrl: 'https://x/api/v1/legal/privacy',
  deletionUrl: 'https://x/api/v1/legal/account-deletion',
  termsUrl: 'https://x/api/v1/legal/terms',
  driverTermsUrl: 'https://x/api/v1/legal/driver-terms',
  vendorTermsUrl: 'https://x/api/v1/legal/vendor-terms',
  policy: legalPolicy({ commissionRate }),
});

const text = (p: LegalPage): string =>
  [p.title, p.intro, p.draft ?? '', ...p.sections.flatMap((s) => [s.h, ...(s.p ?? []), ...(s.li ?? [])])].join('\n');

const pages: Array<[string, (l: LegalLang, c: TermsContext) => LegalPage, string]> = [
  ['terms', termsPage, LEGAL_VERSIONS.terms.version],
  ['driver-terms', driverTermsPage, LEGAL_VERSIONS['driver-terms'].version],
  ['vendor-terms', vendorTermsPage, LEGAL_VERSIONS['vendor-terms'].version],
];

describe.each(pages)('%s sahifasi', (_name, page, version) => {
  it("ikki tilda ham QORALAMA deb belgilangan va versiyani ko'rsatadi", () => {
    expect(page('uz', ctx()).draft).toMatch(/QORALAMA/);
    expect(page('ru', ctx()).draft).toMatch(/ЧЕРНОВИК/);
    expect(text(page('uz', ctx()))).toContain(version);
    expect(text(page('ru', ctx()))).toContain(version);
  });

  it("uz va ru bo'limlar soni bir xil (tarjima tushib qolmagan)", () => {
    expect(page('ru', ctx()).sections.length).toBe(page('uz', ctx()).sections.length);
  });

  it("maxfiylik siyosatiga havola va operator nomi bor", () => {
    for (const lang of ['uz', 'ru'] as const) {
      const t = text(page(lang, ctx()));
      expect(t).toContain('https://x/api/v1/legal/privacy');
      expect(t).toContain('Angren Taxi MChJ');
    }
  });
});

describe('raqamlar sozlamadan / siyosatdan', () => {
  it("yo'lovchi ofertasi: jarimalar, posilka chegarasi, qaytarish haqi", () => {
    const t = text(termsPage('uz', ctx()));
    expect(t).toContain('3 000');
    expect(t).toContain('5 000');
    expect(t).toContain('1 000 000');
    expect(t).toContain('50%');
    expect(t).toContain('7 kun');
  });

  it('haydovchi ofertasi: jonli komissiya stavkasi va jarima zinapoyasi', () => {
    const uz = text(driverTermsPage('uz', ctx(12)));
    expect(uz).toContain('12%');
    expect(uz).toContain('90 kun');
    expect(uz).toContain('4.3');
    const ru = text(driverTermsPage('ru', ctx(12)));
    expect(ru).toContain('12%');
  });

  it("sotuvchi shartlari: kartali buyurtma to'lov muddati", () => {
    expect(text(vendorTermsPage('uz', ctx()))).toContain('15 daqiqa');
    expect(text(vendorTermsPage('ru', ctx()))).toContain('15 мин');
  });
});
