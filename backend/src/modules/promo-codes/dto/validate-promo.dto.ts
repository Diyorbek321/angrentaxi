import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

export class ValidatePromoDto {
  @ApiProperty({ example: 'ANGREN10', description: 'Promo code to validate' })
  @IsString()
  code: string;

  @ApiProperty({ example: 15000, description: 'Order amount in UZS to validate against' })
  @IsNumber()
  @Min(0)
  orderAmount: number;
}
