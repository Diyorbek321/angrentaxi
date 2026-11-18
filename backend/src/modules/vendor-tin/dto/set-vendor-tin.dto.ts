import { ApiProperty } from '@nestjs/swagger';
import { Matches, ValidateIf } from 'class-validator';

/** `PATCH /food/admin/restaurants/:id/tin`, `PATCH /market/admin/stores/:id/tin`. */
export class SetVendorTinDto {
  @ApiProperty({
    example: '123456789',
    nullable: true,
    description: "STIR (INN), 9 raqam — fiskal chekdagi komitent. `null` — tozalash",
  })
  // `null` — ataylab tozalash; maydon yo'q (undefined) — xato.
  @ValidateIf((dto: SetVendorTinDto) => dto.tin !== null)
  @Matches(/^\d{9}$/, { message: "STIR 9 ta raqamdan iborat bo'lishi kerak" })
  tin: string | null;
}
