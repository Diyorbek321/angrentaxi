import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MarketOrderDeliveryMode } from '../../../database/entities/market-order.entity';

export class MarketOrderItemInputDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  qty: number;
}

export class CreateMarketOrderDto {
  @ApiProperty()
  @IsUUID()
  storeId: string;

  @ApiProperty({ type: [MarketOrderItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarketOrderItemInputDto)
  items: MarketOrderItemInputDto[];

  @ApiProperty({ example: "Angren sh., Mustaqillik ko'chasi 5" })
  @IsString()
  @MaxLength(300)
  deliveryAddress: string;

  @ApiProperty({ example: 40.105, description: 'Delivery latitude, used to dispatch a courier' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  deliveryLat: number;

  @ApiProperty({ example: 70.95, description: 'Delivery longitude, used to dispatch a courier' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  deliveryLng: number;

  @ApiPropertyOptional({ enum: MarketOrderDeliveryMode })
  @IsOptional()
  @IsEnum(MarketOrderDeliveryMode)
  deliveryMode?: MarketOrderDeliveryMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
