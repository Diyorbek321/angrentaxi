import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ProductStatus, ProductUnit } from '../../../database/entities/product.entity';

export class CreateProductDto {
  @ApiProperty({ example: 'Guruch Lazer 1kg' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'GRC-1001' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sku?: string;

  @ApiProperty({ example: 22000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 48 })
  @IsInt()
  @Min(0)
  stock: number;

  @ApiProperty({ enum: ProductUnit, example: ProductUnit.KG })
  @IsEnum(ProductUnit)
  unit: ProductUnit;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: '🌾' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(360)
  hue?: number;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ enum: ProductUnit })
  @IsOptional()
  @IsEnum(ProductUnit)
  unit?: ProductUnit;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string;
}
