import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';
import { ServiceType } from '../../../database/entities/order.entity';

export class CreatePromoCodeDto {
  @ApiProperty({ example: 'SUMMER20', description: 'Promo code (will be uppercased)' })
  @IsString()
  @Length(1, 50)
  code: string;

  @ApiProperty({
    example: 10,
    description: 'Discount percentage (e.g. 10 = 10%). Mutually exclusive with discountFixed.',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateIf((o: CreatePromoCodeDto) => o.discountFixed === undefined || o.discountFixed === null)
  discountPercent?: number;

  @ApiProperty({
    example: 5000,
    description: 'Fixed discount in UZS. Mutually exclusive with discountPercent.',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateIf(
    (o: CreatePromoCodeDto) => o.discountPercent === undefined || o.discountPercent === null,
  )
  discountFixed?: number;

  @ApiProperty({
    example: 100,
    description: 'Maximum number of total uses (null = unlimited)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiProperty({
    example: 5000,
    description: 'Minimum order amount in UZS required to use this promo code',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @ApiProperty({
    example: '2026-12-31T23:59:59Z',
    description: 'Expiry date/time (null = no expiry)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiProperty({
    enum: ServiceType,
    isArray: true,
    example: ['food', 'market'],
    description: "Qaysi xizmatlarda ishlaydi. Bo'sh yoki berilmasa — hammasida (null).",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsEnum(ServiceType, { each: true })
  serviceTypes?: ServiceType[] | null;
}
