import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class TaxReportQueryDto {
  @ApiProperty({ example: '2026-10', description: 'Hisobot oyi, YYYY-MM (Toshkent vaqti)' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month YYYY-MM formatida bo‘lishi kerak' })
  month: string;
}
