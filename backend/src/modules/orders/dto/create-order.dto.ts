import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PaymentMethod,
  ServiceType,
} from '../../../database/entities/order.entity';

export class CreateOrderDto {
  @ApiProperty({ example: 'uuid', description: 'Tariff ID' })
  @IsUUID()
  tariffId: string;

  @ApiProperty({ example: 40.0956, description: 'Pickup latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat: number;

  @ApiProperty({ example: 70.9432, description: 'Pickup longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng: number;

  @ApiProperty({ example: 40.1050, description: 'Dropoff latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  dropoffLat: number;

  @ApiProperty({ example: 70.9500, description: 'Dropoff longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  dropoffLng: number;

  @ApiPropertyOptional({ example: 'Angren city center', description: 'Pickup address text' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pickupAddress?: string;

  @ApiPropertyOptional({ example: 'Angren market', description: 'Dropoff address text' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  dropoffAddress?: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: 'Please call on arrival' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @ApiPropertyOptional({ enum: ServiceType, default: ServiceType.TAXI })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional({
    description: 'Vertical-specific payload, e.g. cargo: { weightKg, loaders, cargoNote }',
    example: { weightKg: 300, loaders: 2, cargoNote: 'Mebel' },
  })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'ANGREN10', description: 'Promo code to apply, if any' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  promoCode?: string;
}
