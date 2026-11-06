import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { DeliveryFailureReason } from '../../../database/entities/order.entity';

/** Kuryer: "Yetkazib bo'lmadi" (docs/INCIDENT-POLICY.md §2). */
export class DeliveryFailedDto {
  @ApiProperty({ enum: DeliveryFailureReason, example: DeliveryFailureReason.CUSTOMER_ABSENT })
  @IsEnum(DeliveryFailureReason, { message: "Sababni tanlang: mijoz yo'q, rad etdi yoki bog'lanib bo'lmadi" })
  reason: DeliveryFailureReason;
}

/** Dispetcher: "yetkazib bo'lmadi" — izoh majburiy (audit). */
export class ManagerDeliveryFailedDto extends DeliveryFailedDto {
  @ApiProperty({ example: "Mijoz telefonni ko'tarmadi, 3 marta qo'ng'iroq qilindi" })
  @IsString()
  @IsNotEmpty({ message: 'Izoh majburiy — nima bo‘lganini yozing' })
  @MaxLength(500)
  note: string;
}

/** Dispetcher: qaytarishni tasdiqlash — izoh majburiy (audit). */
export class ManagerConfirmReturnedDto {
  @ApiProperty({ example: "Sotuvchi tovarni qabul qilganini telefonda tasdiqladi" })
  @IsString()
  @IsNotEmpty({ message: 'Izoh majburiy — nima bo‘lganini yozing' })
  @MaxLength(500)
  note: string;
}

/** Menejer: kartali qaytarish summasi qo'lda qaytarildi. */
export class RefundDoneDto {
  @ApiPropertyOptional({ example: 'Payme kabinetidan qaytarildi, #12345' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
