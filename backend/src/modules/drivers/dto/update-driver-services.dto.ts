import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum } from 'class-validator';
import { ServiceType } from '../../../database/entities/order.entity';

export class UpdateDriverServicesDto {
  @ApiProperty({
    enum: ServiceType,
    isArray: true,
    example: ['taxi', 'food'],
    description:
      "Haydovchi qabul qiladigan xizmat turlarining TO'LIQ ro'yxati (qo'shish emas, almashtirish).",
  })
  @IsArray()
  // Bo'sh ro'yxat servis darajasida ham rad etiladi; bu yerdagi tekshiruv
  // shunchaki xatoni HTTP chegarasida, o'zbekcha matn bilan qaytaradi.
  @ArrayNotEmpty({
    message: "Kamida bitta xizmat turi tanlanishi shart — aks holda sizga hech qanday buyurtma kelmaydi.",
  })
  @IsEnum(ServiceType, { each: true, message: "Noma'lum xizmat turi yuborildi" })
  serviceTypes: ServiceType[];
}
