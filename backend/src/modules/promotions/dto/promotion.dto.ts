import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PromotionDiscountType, PromotionScope } from '../../../database/entities/promotion.entity';

/** Sotuvchi aksiyasi (docs/specs/food-market-ux-v5.md §4). */
export class CreatePromotionDto {
  @ApiProperty({ maxLength: 60, example: 'Kechki chegirma' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title: string;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string | null;

  @ApiProperty({ enum: PromotionDiscountType })
  @IsEnum(PromotionDiscountType)
  discountType: PromotionDiscountType;

  @ApiProperty({ example: 15, description: "percent: 1–90; fixed: so'm, > 0 va taom narxidan kichik" })
  @IsNumber()
  @Min(0)
  discountValue: number;

  @ApiPropertyOptional({ enum: PromotionScope, default: PromotionScope.ALL })
  @IsOptional()
  @IsEnum(PromotionScope)
  scope?: PromotionScope;

  @ApiPropertyOptional({ type: [String], description: 'scope=category' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'scope=items (taom/mahsulot id)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  itemIds?: string[];

  @ApiPropertyOptional({ nullable: true, description: "So'm; ASL tovar summasi shunga yetsa qo'llanadi" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number | null;

  @ApiPropertyOptional({ description: 'ISO; berilmasa — hozir' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ nullable: true, description: 'ISO; null — muddatsiz' })
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePromotionDto extends PartialType(CreatePromotionDto) {}

export class ActivePromotionsQueryDto {
  @ApiPropertyOptional({ enum: ['food', 'market'] })
  @IsOptional()
  @IsEnum(['food', 'market'])
  serviceType?: 'food' | 'market';
}
