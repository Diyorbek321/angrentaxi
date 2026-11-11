import {
  TAX_WITHHOLDING_LEDGER_TAG,
  computeTaxWithholding,
  parseReportMonth,
  toTaxReportCsv,
} from './tax-withholding';

describe('computeTaxWithholding', () => {
  it("o'chiq — 0", () => {
    expect(computeTaxWithholding(50000, { enabled: false, ratePercent: 1 })).toBe(0);
  });

  it('1% — butun so‘mga yaxlitlanadi', () => {
    expect(computeTaxWithholding(50000, { enabled: true, ratePercent: 1 })).toBe(500);
    expect(computeTaxWithholding(12350, { enabled: true, ratePercent: 1 })).toBe(124);
    expect(computeTaxWithholding(12340, { enabled: true, ratePercent: 1 })).toBe(123);
  });

  it('stavka sozlamadan olinadi', () => {
    expect(computeTaxWithholding(100000, { enabled: true, ratePercent: 4 })).toBe(4000);
  });

  it('0 yoki manfiy daromad / stavka — 0', () => {
    expect(computeTaxWithholding(0, { enabled: true, ratePercent: 1 })).toBe(0);
    expect(computeTaxWithholding(-100, { enabled: true, ratePercent: 1 })).toBe(0);
    expect(computeTaxWithholding(50000, { enabled: true, ratePercent: 0 })).toBe(0);
  });

  it('daftar belgisi barqaror', () => {
    expect(TAX_WITHHOLDING_LEDGER_TAG).toBe('tax_withholding');
  });
});

describe('parseReportMonth', () => {
  it('YYYY-MM → Toshkent vaqti bo‘yicha oy chegaralari (UTC+5)', () => {
    expect(parseReportMonth('2026-10')).toEqual({
      from: new Date('2026-09-30T19:00:00.000Z'),
      to: new Date('2026-10-31T19:00:00.000Z'),
    });
  });

  it('dekabr → keyingi yil yanvari', () => {
    expect(parseReportMonth('2026-12')?.to).toEqual(new Date('2026-12-31T19:00:00.000Z'));
  });

  it('noto‘g‘ri format — null', () => {
    expect(parseReportMonth('2026-13')).toBeNull();
    expect(parseReportMonth('2026-1')).toBeNull();
    expect(parseReportMonth('abc')).toBeNull();
  });
});

describe('toTaxReportCsv', () => {
  it('sarlavha + qatorlar, vergul va qo‘shtirnoq qochiriladi', () => {
    const csv = toTaxReportCsv([
      {
        userId: 'u1',
        name: 'Ali, "Vali"',
        phone: '+998901112233',
        pinfl: '12345678901234',
        tin: null,
        taxStatus: 'self_employed',
        grossIncome: 150000,
        withheldAmount: 1500,
        orderCount: 3,
      },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'user_id,name,phone,pinfl,tin,tax_status,gross_income,withheld_amount,order_count,pending_withheld_amount',
    );
    // `pendingWithheldAmount` berilmagan qator — 0.
    expect(lines[1]).toBe('u1,"Ali, ""Vali""",+998901112233,12345678901234,,self_employed,150000,1500,3,0');
  });

  it('formula in\'yeksiyasi neytrallanadi', () => {
    const csv = toTaxReportCsv([
      {
        userId: 'u1',
        name: '=HYPERLINK("x")',
        phone: null,
        pinfl: null,
        tin: null,
        taxStatus: null,
        grossIncome: 0,
        withheldAmount: 0,
        orderCount: 0,
      },
    ]);
    expect(csv.split('\n')[1].startsWith('u1,"\'=HYPERLINK')).toBe(true);
  });
});
