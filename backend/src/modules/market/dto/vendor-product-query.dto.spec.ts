import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { VendorProductQueryDto } from './vendor-product-query.dto';

const errors = (query: Record<string, string>) =>
  validateSync(plainToInstance(VendorProductQueryDto, query)).map((e) => e.property);

describe('VendorProductQueryDto', () => {
  it("to'g'ri so'rov o'tadi", () => {
    expect(
      errors({ page: '2', limit: '50', search: 'sut', status: 'out', categoryId: '0b6f3a52-6f2c-4e0e-9d1a-2f1c4b7a9e10' }),
    ).toEqual([]);
  });

  it("kasr yoki juda katta sahifa 400 beradi (OFFSET 500 bilan yiqilmasin)", () => {
    expect(errors({ page: '1.5' })).toContain('page');
    expect(errors({ page: '99999999999' })).toContain('page');
  });

  it("noma'lum holat, UUID bo'lmagan kategoriya, 100 dan katta limit rad etiladi", () => {
    expect(errors({ status: 'deleted', categoryId: 'x', limit: '500' }).sort()).toEqual(['categoryId', 'limit', 'status']);
  });
});
