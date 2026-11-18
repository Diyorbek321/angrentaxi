import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { OptionalPaginationDto } from '../../../common/dto/optional-pagination.dto';

/** `GET /market/products/search` — barcha do'konlar bo'yicha mahsulot qidiruvi. */
export class SearchProductsDto extends OptionalPaginationDto {
  @ApiPropertyOptional({ example: 'sut', description: "Mahsulot nomidan bo'lak (kamida 2 belgi)" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
