import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../../../database/entities/order.entity';

export class CreateDispatchOrderDto {
  @ApiProperty({ example: '+998901234569', description: 'Passenger phone number' })
  @IsString()
  @Matches(/^\+?\d{9,15}$/, { message: 'Invalid phone number' })
  passengerPhone: string;

  @ApiPropertyOptional({ example: 'Alisher Karimov', description: 'Used only if the passenger does not exist yet' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  passengerName?: string;

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

  @ApiPropertyOptional({ example: 'Angren city center' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pickupAddress?: string;

  @ApiPropertyOptional({ example: 'Angren market' })
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
}
