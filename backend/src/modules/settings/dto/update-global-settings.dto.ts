import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

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
}
