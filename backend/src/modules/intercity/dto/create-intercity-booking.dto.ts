import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IntercityBookingKind, PaymentMethod } from '../../../database/entities/order.entity';

export class IntercityBookingPlaceDto {
  @ApiProperty({ example: 40.0956 })
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 70.9432 })
  @IsLongitude()
  lng: number;

  @ApiProperty({ example: 'Angren, Navoiy ko‘chasi 12' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address: string;
}

export class CreateIntercityBookingDto {
  @ApiProperty({ enum: IntercityBookingKind, example: IntercityBookingKind.SEAT })
  @IsEnum(IntercityBookingKind)
  kind: IntercityBookingKind;

  /**
   * Faqat `seat` uchun; berilmasa 1. Yuqori chegara sozlamadan
   * (`intercity_max_seats_per_booking`) — shuning uchun bu yerda emas,
   * `intercity-booking-policy.ts` da tekshiriladi.
   */
  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  seats?: number;

  @ApiProperty({ type: IntercityBookingPlaceDto, description: 'Boshlanish shahri ichida' })
  @ValidateNested()
  @Type(() => IntercityBookingPlaceDto)
  pickup: IntercityBookingPlaceDto;

  @ApiProperty({ type: IntercityBookingPlaceDto, description: 'Manzil nuqtasi hududida (masalan Rohat krugi)' })
  @ValidateNested()
  @Type(() => IntercityBookingPlaceDto)
  dropoff: IntercityBookingPlaceDto;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
