import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ServiceType } from '../../../database/entities/order.entity';

export class ValidatePromoDto {
  @ApiProperty({ example: 'ANGREN10', description: 'Promo code to validate' })
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({ example: 15000, description: 'Order amount in UZS (legacy name of `amount`)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  orderAmount?: number;

  @ApiPropertyOptional({
    example: 45000,
    description: "So'm. Ovqat/market: aksiyadan keyingi tovar summasi (yetkazishsiz).",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;
}
