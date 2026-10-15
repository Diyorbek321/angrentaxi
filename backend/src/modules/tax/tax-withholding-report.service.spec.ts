import { BadRequestException } from '@nestjs/common';
import { TaxWithholdingReportService } from './tax-withholding-report.service';

describe('TaxWithholdingReportService', () => {
  const rawRow = {
    user_id: 'u1',
    first_name: 'Ali',
    last_name: 'Valiyev',
    phone: '+998901112233',
    pinfl: '12345678901234',
    tin: null,
    tax_status: 'self_employed',
    gross_income: '150000.00',
    withheld_amount: '1200.00',
    pending_withheld_amount: '300.00',
    order_count: '4',
  };

  function build(rows: unknown[] = [rawRow]) {
    const query = jest.fn().mockResolvedValue(rows);
    return { service: new TaxWithholdingReportService({ query } as never), query };
  }

  it('oy bo‘yicha har bir haydovchi/kuryer qatori va jami', async () => {
    const { service, query } = build([rawRow, { ...rawRow, user_id: 'u2', first_name: null, last_name: null, gross_income: '50000', withheld_amount: '500', pending_withheld_amount: '0', order_count: '1' }]);

    const report = await service.getMonthlyReport('2026-10');

    expect(query).toHaveBeenCalledWith(expect.stringContaining("'tax_withholding'"), [
      new Date('2026-09-30T19:00:00.000Z'),
      new Date('2026-10-31T19:00:00.000Z'),
    ]);
    expect(report.month).toBe('2026-10');
    expect(report.rows[0]).toEqual({
      userId: 'u1',
      name: 'Ali Valiyev',
      phone: '+998901112233',
      pinfl: '12345678901234',
      tin: null,
      taxStatus: 'self_employed',
      grossIncome: 150000,
      withheldAmount: 1200,
      pendingWithheldAmount: 300,
      orderCount: 4,
    });
    expect(report.rows[1].name).toBeNull();
    expect(report.totals).toEqual({
      grossIncome: 200000,
      withheldAmount: 1700,
      pendingWithheldAmount: 300,
      orderCount: 5,
    });
  });

  it("noto'g'ri oy — 400", async () => {
    await expect(build().service.getMonthlyReport('2026/10')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('CSV eksport — sarlavha + qatorlar', async () => {
    const csv = await build().service.getMonthlyReportCsv('2026-10');
    const lines = csv.split('\n');
    expect(lines[0]).toContain('pinfl');
    // `pending_withheld_amount` — JSON'dagi `pendingWithheldAmount` bilan bir xil (oxirgi ustun, mos).
    expect(lines[0].endsWith(',order_count,pending_withheld_amount')).toBe(true);
    expect(lines[1]).toBe('u1,Ali Valiyev,+998901112233,12345678901234,,self_employed,150000,1200,4,300');
  });
});
