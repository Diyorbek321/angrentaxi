import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** `POST /food/orders/:id/cancel`, `POST /market/orders/:id/cancel` (docs/specs/food-market-ux-v5.md §1). */
export class CancelVendorOrderDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
