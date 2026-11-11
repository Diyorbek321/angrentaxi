import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { VehicleType } from '../../../database/entities/tariff.entity';

export class CreateDriverDto {
  @ApiPropertyOptional({ example: 'Toyota Camry', description: 'Car model' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  carModel?: string;

  @ApiPropertyOptional({ example: '01 A 123 BC', description: 'Car number (license plate)' })
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

  // ⚠️ `serviceTypes` ATAYLAB YO'Q — yangi profil doim `['taxi']` dan
  // boshlanadi. Sabab tovuq-tuxum muammosi: xizmat turini yoqish tasdiqlangan
  // material talab qiladi, material esa faqat MAVJUD profilga yuklanadi.
  // Ro'yxatdan o'tishda tanlashga ruxsat berilsa, yo talab tekshirilmay
  // qolardi (darvoza teshigi), yo ariza umuman qabul qilinmasdi.
  // Haydovchi hujjatlarini yuklab, keyin `PATCH /drivers/me/services` qiladi.
}
