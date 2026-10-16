import { DRIVER_GROSS_FARE_SQL } from './orders-earnings.service';
import { TAX_REPORT_GROSS_SQL } from '../tax/tax-withholding-report.service';

/**
 * Taksi promo kodini platforma to'laydi (LEGAL-COMPLIANCE §26a): haydovchi
 * daromadi va 1% soliq bazasi — CHEGIRMAGACHA bo'lgan yo'l haqi
 * (`final_price + discount_amount`), yo'lovchi to'lagan summa emas.
 */
describe('promo safar — haydovchi yalpi daromadi', () => {
  it('daromad hisoboti chegirmani qaytarib qo\'shadi', () => {
    expect(DRIVER_GROSS_FARE_SQL).toContain('discount_amount');
    expect(DRIVER_GROSS_FARE_SQL).toContain('final_price');
  });

  it('soliq hisoboti ham xuddi shu bazani ishlatadi', () => {
    expect(TAX_REPORT_GROSS_SQL).toContain('discount_amount');
    expect(TAX_REPORT_GROSS_SQL).toContain('final_price');
  });
});
