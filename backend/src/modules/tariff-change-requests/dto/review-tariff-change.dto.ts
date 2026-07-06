import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewTariffChangeDto {
  @ApiPropertyOptional({ example: 'Looks good', description: 'Optional reviewer note' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
