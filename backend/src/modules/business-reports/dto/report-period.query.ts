import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Toshkent sanalari, `to` kirmaydi. Ikkalasi bo'sh — kechagi kun. */
export class ReportPeriodQuery {
  @ApiPropertyOptional({ example: '2026-10-27' })
  @IsOptional()
  @Matches(ISO_DATE, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-28', description: 'Exclusive' })
  @IsOptional()
  @Matches(ISO_DATE, { message: 'to must be YYYY-MM-DD' })
  to?: string;
}
