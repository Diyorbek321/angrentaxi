import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DELIVERY_ETA_MINUTES_MAX,
  DELIVERY_ETA_MINUTES_MIN,
} from '../delivery-pricing';

export class UpdateGlobalSettingsDto {
  @ApiPropertyOptional({ example: 'Angren Taxi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  platformName?: string;

  @ApiPropertyOptional({ example: '+998 71 200 00 00' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  supportPhone?: string;

  @ApiPropertyOptional({ example: 'support@angrentaxi.uz' })
  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @ApiPropertyOptional({
    description:
      'When true, MaintenanceGuard rejects all non-admin traffic with 503',
  })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiPropertyOptional({
    description: "Flat delivery fee added to every food/market order, in so'm",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @ApiPropertyOptional({
    description: "Naqd ovqat/market buyurtmasi chegarasi, so'm (undan katta — faqat karta)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCashVendorOrder?: number;

  @ApiPropertyOptional({
    example: 100000,
    description: "Bepul yetkazish chegarasi, so'm (tovar summasi aksiyadan keyin, promokoddan oldin); 0 — o'chiq",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  freeDeliveryFrom?: number;

  @ApiPropertyOptional({ example: 30, description: 'Yetkazish vaqti, eng kami (daqiqa)' })
  @IsOptional()
  @IsInt()
  @Min(DELIVERY_ETA_MINUTES_MIN)
  @Max(DELIVERY_ETA_MINUTES_MAX)
  deliveryEtaMinMinutes?: number;

  @ApiPropertyOptional({ example: 50, description: "Yetkazish vaqti, eng ko'pi (daqiqa); eng kamidan kichik emas" })
  @IsOptional()
  @IsInt()
  @Min(DELIVERY_ETA_MINUTES_MIN)
  @Max(DELIVERY_ETA_MINUTES_MAX)
  deliveryEtaMaxMinutes?: number;
}
