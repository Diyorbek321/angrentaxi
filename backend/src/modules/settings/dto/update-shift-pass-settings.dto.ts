import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ServiceType } from '../../../database/entities/order.entity';

export class UpdateShiftPassSettingsDto {
  @ApiPropertyOptional({ description: 'Smena sotuvini yoqish/o‘chirish' })
  @IsOptional()
  @IsBoolean()
  shiftPassEnabled?: boolean;

  @ApiPropertyOptional({ example: 25000, description: "Smena narxi, so'm" })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1000)
  @Max(10_000_000)
  shiftPassPrice?: number;

  @ApiPropertyOptional({ example: 24, description: 'Smena davomiyligi, soat' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  shiftPassDurationHours?: number;

  @ApiPropertyOptional({ enum: ServiceType, isArray: true, example: ['taxi'] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ServiceType, { each: true })
  shiftPassServiceTypes?: ServiceType[];
}
