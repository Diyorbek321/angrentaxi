import { UserRole } from '../../database/entities/user.entity';
import { LEGAL_DOCUMENTS, LEGAL_VERSIONS, legalDocumentStatus, requiredLegalDocuments } from './legal-versions';

describe('LEGAL_VERSIONS', () => {
  it("har bir hujjatning versiyasi YYYY-MM-DD.N ko'rinishida va o'zgarish xulosasi bor", () => {
    for (const doc of LEGAL_DOCUMENTS) {
      expect(LEGAL_VERSIONS[doc].version).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
      expect(LEGAL_VERSIONS[doc].summary.uz.length).toBeGreaterThan(0);
      expect(LEGAL_VERSIONS[doc].summary.ru.length).toBeGreaterThan(0);
    }
  });
});

describe('requiredLegalDocuments', () => {
  it("yo'lovchi: oferta + maxfiylik", () => {
    expect(requiredLegalDocuments(UserRole.PASSENGER)).toEqual(['terms', 'privacy']);
  });

  it('haydovchi: haydovchi ofertasi + maxfiylik (yo\'lovchi ofertasi emas)', () => {
    expect(requiredLegalDocuments(UserRole.DRIVER)).toEqual(['driver-terms', 'privacy']);
  });

  it("sotuvchi: sotuvchi shartlari + yo'lovchi ofertasi (taksi ham chaqiradi) + maxfiylik", () => {
    expect(requiredLegalDocuments(UserRole.RESTAURANT)).toEqual(['vendor-terms', 'terms', 'privacy']);
    expect(requiredLegalDocuments(UserRole.MARKET)).toEqual(['vendor-terms', 'terms', 'privacy']);
  });

  it("xodimlar (admin/menejer) — ilova ofertasi talab qilinmaydi", () => {
    expect(requiredLegalDocuments(UserRole.ADMIN)).toEqual([]);
    expect(requiredLegalDocuments(UserRole.MANAGER)).toEqual([]);
  });
});

describe('legalDocumentStatus', () => {
  it("hech narsa qabul qilinmagan — hammasi talab qilinadi", () => {
    const s = legalDocumentStatus(UserRole.PASSENGER, new Map());
    expect(s.mustAccept).toBe(true);
    expect(s.documents.map((d) => [d.document, d.mustAccept, d.acceptedVersion])).toEqual([
      ['terms', true, null],
      ['privacy', true, null],
    ]);
  });

  it("joriy versiya qabul qilingan — talab yo'q", () => {
    const accepted = new Map([
      ['terms', LEGAL_VERSIONS.terms.version],
      ['privacy', LEGAL_VERSIONS.privacy.version],
    ]);
    const s = legalDocumentStatus(UserRole.PASSENGER, accepted);
    expect(s.mustAccept).toBe(false);
    expect(s.documents.every((d) => !d.mustAccept)).toBe(true);
  });

  it('eski versiya qabul qilingan — qayta qabul qilish kerak', () => {
    const accepted = new Map([
      ['terms', '2000-01-01.1'],
      ['privacy', LEGAL_VERSIONS.privacy.version],
    ]);
    const s = legalDocumentStatus(UserRole.PASSENGER, accepted);
    expect(s.mustAccept).toBe(true);
    const terms = s.documents.find((d) => d.document === 'terms');
    expect(terms).toMatchObject({ mustAccept: true, acceptedVersion: '2000-01-01.1', version: LEGAL_VERSIONS.terms.version });
  });
});
