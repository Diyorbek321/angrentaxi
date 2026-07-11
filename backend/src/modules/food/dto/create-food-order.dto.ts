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
import { FoodPaymentMethod } from '../../../database/entities/food-order.entity';

export class FoodOrderItemInputDto {
  @ApiProperty()
  @IsUUID()
  dishId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  qty: number;
}

export class CreateFoodOrderDto {
  @ApiProperty()
  @IsUUID()
  restaurantId: string;

  @ApiProperty({ type: [FoodOrderItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FoodOrderItemInputDto)
  items: FoodOrderItemInputDto[];

  @ApiProperty({ example: "Toshkent, Chilonzor 12-kv, 3-uy" })
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

  @ApiPropertyOptional({ enum: FoodPaymentMethod })
  @IsOptional()
  @IsEnum(FoodPaymentMethod)
  paymentMethod?: FoodPaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
