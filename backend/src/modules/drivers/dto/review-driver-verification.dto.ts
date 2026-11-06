import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { formBoolean } from '../../../common/utils/form-boolean.util';

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
  @Transform(formBoolean)
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

  // Hujjatning O'ZIDA yozilgan amal qilish muddati (guvohnoma, sug'urta,
  // texnik ko'rik). Berilsa, talabning `cadenceDays` hisobi o'rniga shu
  // sana ishlatiladi: "har 365 kunda" emas, "guvohnoma 2027-03-14 da
  // tugaydi". Eslatma cron'i va onlayn darvozasi aynan shu sanaga qaraydi.
  @ApiProperty({
    description:
      'Hujjat amal qilish muddati (ISO sana). Faqat tasdiqlashda; berilsa cadenceDays o‘rniga ishlatiladi.',
    required: false,
    example: '2027-03-14',
  })
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
