import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { formBoolean } from '../../../common/utils/form-boolean.util';
import { VehicleType } from '../../../database/entities/tariff.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * The full new vehicle, not a patch: a reviewer approves "this car", and a
 * partial request ("just the plate") would leave them guessing whether the
 * model shown next to it is old or new.
 */
export class RequestVehicleChangeDto {
  @ApiProperty({ example: 'Chevrolet Cobalt' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  carModel: string;

  @ApiProperty({ example: '01 A 123 BC', description: 'Davlat raqami' })
  @Transform(trim)
  @IsString()
  @MinLength(4)
  @MaxLength(20)
  carNumber: string;

  @ApiPropertyOptional({ example: '01A123BC' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  licensePlate?: string;

  @ApiPropertyOptional({ example: 2021 })
  @IsOptional()
  @IsInt()
  @Min(1990)
  @Max(new Date().getFullYear() + 1)
  carYear?: number;

  @ApiPropertyOptional({ enum: VehicleType, description: "Bo'sh = yengil avtomobil" })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;
}

export class ReviewVehicleChangeDto {
  @ApiProperty({ example: true })
  @Transform(formBoolean)
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({ description: 'Rad etishda majburiy', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
