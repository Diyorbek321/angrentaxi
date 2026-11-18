import { describe, expect, it } from 'vitest';
import { acceptanceShare, documentUrl, olderVersionUsers, type LegalDocumentSummary } from './legal-documents';

const doc = (over: Partial<LegalDocumentSummary> = {}): LegalDocumentSummary => ({
  document: 'terms',
  version: '2026-11-03.1',
  summary: { uz: 'a', ru: 'b' },
  acceptedCurrent: 7,
  requiredUsers: 10,
  versions: [
    { version: '2026-11-03.1', users: 7, lastAcceptedAt: '2026-11-03T10:00:00.000Z' },
    { version: '2026-10-01.1', users: 2, lastAcceptedAt: '2026-10-01T10:00:00.000Z' },
  ],
  ...over,
});

describe('acceptanceShare', () => {
  it('foiz, butun songa yaxlitlangan', () => {
    expect(acceptanceShare(doc())).toBe(70);
  });

  it("talab qilinadigan foydalanuvchi yo'q — null (0/0 = 0% emas)", () => {
    expect(acceptanceShare(doc({ requiredUsers: 0, acceptedCurrent: 0 }))).toBeNull();
  });

  it("100% dan oshmaydi (bloklangan/rol o'zgargan foydalanuvchilar)", () => {
    expect(acceptanceShare(doc({ requiredUsers: 5, acceptedCurrent: 6 }))).toBe(100);
  });
});

describe('olderVersionUsers', () => {
  it('faqat eski versiyalar yig\'indisi', () => {
    expect(olderVersionUsers(doc())).toBe(2);
    expect(olderVersionUsers(doc({ versions: [] }))).toBe(0);
  });
});

describe('documentUrl', () => {
  it('ommaviy sahifa yo\'li (proksi orqali)', () => {
    expect(documentUrl('driver-terms', 'ru')).toBe('/api/proxy/legal/driver-terms?lang=ru');
  });
});
