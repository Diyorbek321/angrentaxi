import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { IntercityTripClass } from '../../../database/entities/intercity-trip.entity';
import { IntercityRequestStatus } from '../../../database/entities/intercity-request.entity';
import { IntercityBookingKind, PaymentMethod } from '../../../database/entities/order.entity';
import { OptionalPaginationDto } from '../../../common/dto/optional-pagination.dto';
import { IntercityBookingPlaceDto } from './create-intercity-booking.dto';

/** `POST /intercity/requests` (va `/quote`) — yo'lovchi so'rov qoldiradi. */
export class CreateIntercityRequestDto {
  @ApiProperty({ description: "Yo'nalish UUID" })
  @IsUUID()
  routeId: string;

  @ApiPropertyOptional({ enum: IntercityTripClass, default: IntercityTripClass.START })
  @IsOptional()
  @IsEnum(IntercityTripClass)
  tripClass?: IntercityTripClass;

  @ApiProperty({ enum: IntercityBookingKind, example: IntercityBookingKind.SEAT })
  @IsEnum(IntercityBookingKind)
  kind: IntercityBookingKind;

  /** Faqat `seat` uchun; berilmasa 1. Yuqori chegara servisda (sozlama). */
  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  seats?: number;

  @ApiProperty({ type: IntercityBookingPlaceDto })
  @ValidateNested()
  @Type(() => IntercityBookingPlaceDto)
  pickup: IntercityBookingPlaceDto;

  @ApiProperty({ type: IntercityBookingPlaceDto })
  @ValidateNested()
  @Type(() => IntercityBookingPlaceDto)
  dropoff: IntercityBookingPlaceDto;

  @ApiProperty({ example: '2026-10-18T09:00:00.000Z', description: "Jo'nash oralig'i boshi (ISO)" })
  @IsDateString()
  windowStart: string;

  @ApiProperty({ example: '2026-10-18T11:00:00.000Z', description: "Jo'nash oralig'i oxiri (ISO)" })
  @IsDateString()
  windowEnd: string;

  /** Darhol qo'shiladigan summa (ixtiyoriy) — keyin `/bonus` bilan oshiriladi. */
  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  bonus?: number;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

/** `POST /intercity/requests/:id/bonus` — yangi (kattaroq) qo'shimcha summa. */
export class RaiseIntercityRequestBonusDto {
  @ApiProperty({ example: 5000, description: "Yangi qo'shimcha summa (jami, avvalgisidan katta)" })
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  bonus: number;
}

/**
 * `POST /intercity/requests/:id/accept` — haydovchi qabul qiladi.
 * `tripId` berilsa band o'sha qatnovga tushadi; berilmasa oraliqdagi mos
 * qatnovi qidiriladi, topilmasa `departureAt` bilan yangisi yaratiladi.
 */
export class AcceptIntercityRequestDto {
  @ApiPropertyOptional({ description: "Haydovchining mavjud qatnovi" })
  @IsOptional()
  @IsUUID()
  tripId?: string;

  @ApiPropertyOptional({ example: '2026-10-18T10:00:00.000Z', description: "Yangi qatnov jo'nash vaqti (oraliq ichida)" })
  @IsOptional()
  @IsDateString()
  departureAt?: string;
}

/** `GET /intercity/requests/board` — haydovchi doskasi. */
export class IntercityRequestBoardQueryDto {
  @ApiPropertyOptional({ description: "Faqat shu yo'nalish" })
  @IsOptional()
  @IsUUID()
  routeId?: string;
}

/** `GET /intercity/requests/manage` — dispetcher ro'yxati. */
export class ManageIntercityRequestsQueryDto extends OptionalPaginationDto {
  @ApiPropertyOptional({ enum: IntercityRequestStatus })
  @IsOptional()
  @IsEnum(IntercityRequestStatus)
  status?: IntercityRequestStatus;
}
