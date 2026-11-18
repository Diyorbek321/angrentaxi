import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { VehicleType } from '../../../database/entities/tariff.entity';

export class UpdateDriverDto {
  @ApiPropertyOptional({ example: 'Toyota Camry', description: 'Car model' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  carModel?: string;

  @ApiPropertyOptional({ example: '01 A 123 BC', description: 'Car number' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  carNumber?: string;

  @ApiPropertyOptional({ example: '01A123BC', description: 'License plate' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  licensePlate?: string;

  @ApiPropertyOptional({
    example: 2019,
    description: "Car manufacture year — informs the manager's tariff-tier review",
  })
  @IsOptional()
  @IsInt()
  @Min(1990)
  @Max(new Date().getFullYear() + 1)
  carYear?: number;

  @ApiPropertyOptional({
    enum: VehicleType,
    description:
      "Yuk transporti turi. Bo'sh = yengil avtomobil (taksi). O'zi e'lon " +
      'qiladi, xuddi carYear kabi — hujjat tekshiruvi driver_documents orqali.',
  })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  // ⚠️ `serviceTypes` ATAYLAB YO'Q. U faqat `PATCH /drivers/me/services`
  // orqali o'zgaradi, chunki xizmat turini yoqish TEKSHIRUVGA bog'liq
  // (`DriverServicesService`). Shu maydon bu yerda ham qolganida haydovchi
  // termo-sumka fotosisiz ham «ovqat yetkazish» ni yoqib olardi — ya'ni
  // darvozaning yonida ochiq eshik turgan bo'lardi.
}
