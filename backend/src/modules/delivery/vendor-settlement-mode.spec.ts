import {
  DEFAULT_VENDOR_WALLET_SETTLEMENT_FROM,
  effectiveVendorSettlementMode,
  isVendorSettlementMode,
} from './vendor-settlement-mode';

/**
 * E-tijorat qonuniga o'zgartishlar (10.09.2026, kuchga kirishi 2026-12-12),
 * 23-modda: kuryer naqd pulni faqat sotuvchiga oldindan ELEKTRON o'tkazgan
 * summasi doirasida ushlab qola oladi.
 */
describe('effectiveVendorSettlementMode', () => {
  const before = new Date('2026-12-11T18:59:59Z'); // 2026-12-11 23:59:59 Toshkent
  const atStart = new Date('2026-12-11T19:00:00Z'); // 2026-12-12 00:00 Toshkent

  it('standart sana — 2026-12-12 00:00 Toshkent vaqti', () => {
    expect(DEFAULT_VENDOR_WALLET_SETTLEMENT_FROM.toISOString()).toBe('2026-12-11T19:00:00.000Z');
  });

  it('sanagacha va rejim "cash" — naqd (bugungi xulq)', () => {
    expect(effectiveVendorSettlementMode('cash', DEFAULT_VENDOR_WALLET_SETTLEMENT_FROM, before)).toBe('cash');
  });

  it('sana kelganda — rejim "cash" bo‘lsa ham hamyon', () => {
    expect(effectiveVendorSettlementMode('cash', DEFAULT_VENDOR_WALLET_SETTLEMENT_FROM, atStart)).toBe('wallet');
  });

  it('admin "wallet" ni qo‘lda yoqsa — darhol hamyon', () => {
    expect(effectiveVendorSettlementMode('wallet', DEFAULT_VENDOR_WALLET_SETTLEMENT_FROM, before)).toBe('wallet');
    expect(effectiveVendorSettlementMode('wallet', null, before)).toBe('wallet');
  });

  it('sana null — faqat rejimga qaraladi', () => {
    expect(effectiveVendorSettlementMode('cash', null, atStart)).toBe('cash');
  });

  it('noma’lum rejim qiymati naqd deb o‘qiladi', () => {
    expect(effectiveVendorSettlementMode('bogus', null, before)).toBe('cash');
    expect(isVendorSettlementMode('wallet')).toBe(true);
    expect(isVendorSettlementMode('bogus')).toBe(false);
  });
});
