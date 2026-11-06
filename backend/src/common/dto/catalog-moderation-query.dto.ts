import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../modules/orders/dto/pagination.dto';

/** Admin moderatsiyasi: taom/mahsulot ro'yxati sahifalab, nom yoki sotuvchi bo'yicha qidiruv. */
export class CatalogModerationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Nomi yoki sotuvchi nomi bo\'yicha qidiruv' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

/** ILIKE uchun: foydalanuvchi kiritgan `%` va `_` maxsus belgi bo'lib qolmasin. */
export function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
