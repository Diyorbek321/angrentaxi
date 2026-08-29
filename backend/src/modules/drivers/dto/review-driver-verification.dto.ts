import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Kontrakt: `{ "approved": true }` yoki
 * `{ "approved": false, "rejectionReason": "..." }`.
 */
export class ReviewDriverVerificationDto {
  @ApiProperty({
    description: 'Tasdiqlash (true) yoki rad etish (false)',
    example: true,
  })
  // Menejer paneli forma orqali `"true"`/`"false"` satr yuborishi mumkin —
  // `@IsBoolean()` uni rad etardi va rad etish tugmasi jimgina ishlamasdi.
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  approved: boolean;

  // Rad etishda MAJBURIY, lekin buni `DriverVerificationService.review()`
  // tekshiradi: class-validator'da "boshqa maydon qiymatiga bog'liq
  // majburiylik" ni toza ifodalash yo'li yo'q (mavjud
  // `ReviewDriverDocumentDto` bilan bir xil mulohaza).
  @ApiProperty({
    description: 'Rad etish sababi. `approved: false` bo\'lganda majburiy.',
    required: false,
    maxLength: 500,
    example: 'Rasm xira, davlat raqami o‘qilmayapti',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
