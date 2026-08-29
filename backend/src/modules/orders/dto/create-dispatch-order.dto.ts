import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod, ServiceType } from '../../../database/entities/order.entity';
import { WaypointDto } from './create-order.dto';

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

  // The four fields below were missing, so a call-centre operator could not
  // take a multi-stop ride, a cargo job, or apply a promo code — the dispatch
  // form silently produced a plain point-to-point taxi order instead.

  @ApiPropertyOptional({
    type: [WaypointDto],
    description: 'Intermediate stops between pickup and dropoff, in visit order (max 5)',
    example: [{ address: 'Angren bozori', lat: 40.098, lng: 70.944 }],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => WaypointDto)
  waypoints?: WaypointDto[];

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

  // Call-centre operatori ham rejalashtirilgan safarni qabul qila olishi
  // kerak. `createForDispatch` baribir `create()` ga delegate qiladi, ya'ni
  // validatsiya va narx qotirish bir xil yo'ldan o'tadi.
  //
  // ⚠️ `forbidNonWhitelisted: true` sababli bu maydonni DTO ga qo'shmasdan
  // yuborish `400 property scheduledAt should not exist` beradi — shuning
  // uchun IKKALA DTO ham yangilanishi shart.
  @ApiPropertyOptional({
    example: '2026-08-20T03:00:00.000Z',
    description: "Rejalashtirilgan olib ketish vaqti (ISO-8601, UTC)",
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  scheduledAt?: string;
}
