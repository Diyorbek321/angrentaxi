import { ApiProperty } from '@nestjs/swagger';
import {
  PaymentMethod,
  ServiceType,
} from '../../../database/entities/order.entity';
import { TransactionStatus } from '../../../database/entities/transaction.entity';
import { FareBreakdown } from '../../tariffs/fare-breakdown';

/** Chekdagi haydovchi ma'lumoti — faqat identifikatsiya uchun. */
export class ReceiptDriverDto {
  @ApiProperty({ example: 'Alisher Karimov' })
  name: string;

  @ApiProperty({ example: 'Chevrolet Cobalt', nullable: true })
  carModel: string | null;

  @ApiProperty({ example: '01A123BC', nullable: true })
  carNumber: string | null;
}

/**
 * Tugagan safar cheki.
 *
 * ⚠️ Bu javob modeli (Swagger uchun), kirish DTO'si emas.
 * Komissiya va haydovchi daromadi ATAYLAB yo'q — chek yo'lovchi hujjati.
 */
export class OrderReceiptDto {
  @ApiProperty({ format: 'uuid' })
  orderId: string;

  @ApiProperty({
    example: 'A3F9C1D2',
    description:
      "Qo'llab-quvvatlashga aytish uchun qisqa raqam (UUID ning birinchi bo'lagi)",
  })
  orderNumber: string;

  @ApiProperty({ nullable: true, type: Date })
  completedAt: Date | null;

  @ApiProperty({ enum: ServiceType })
  serviceType: ServiceType;

  @ApiProperty({ nullable: true })
  pickupAddress: string | null;

  @ApiProperty({ nullable: true })
  dropoffAddress: string | null;

  @ApiProperty({ type: [Object], description: "Oraliq to'xtashlar" })
  waypoints: unknown[];

  @ApiProperty({ format: 'uuid' })
  tariffId: string;

  @ApiProperty({ example: 'Komfort', nullable: true })
  tariffName: string | null;

  @ApiProperty({ example: 7.4, nullable: true })
  distanceKm: number | null;

  @ApiProperty({ example: 18, nullable: true })
  durationMin: number | null;

  @ApiProperty({
    nullable: true,
    description:
      "Narx tarkibi, safar tugagan lahzada muzlatilgan. Eski safarlarda null.",
  })
  fare: FareBreakdown | null;

  @ApiProperty({ example: 1.4 })
  surgeMultiplier: number;

  @ApiProperty({
    example: 42000,
    description: 'Chegirmagacha bo\'lgan summa',
  })
  grossPrice: number;

  @ApiProperty({ example: 5000 })
  discountAmount: number;

  @ApiProperty({ example: 'YANGI25', nullable: true })
  promoCode: string | null;

  @ApiProperty({ example: 5000, description: 'Chaqim — komissiyasiz' })
  tipAmount: number;

  @ApiProperty({ example: 37000, description: "Yo'lovchi to'lagan yakuniy summa" })
  total: number;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @ApiProperty({ enum: TransactionStatus, nullable: true })
  paymentStatus: TransactionStatus | null;

  @ApiProperty({
    example: 0,
    description: "To'lanmagan qoldiq (hamyon yetmagan yoki karta hali yopilmagan)",
  })
  unpaidAmount: number;

  @ApiProperty({ type: ReceiptDriverDto, nullable: true })
  driver: ReceiptDriverDto | null;
}
