import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import {
  TIP_LEDGER_TAG,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { Trip } from '../../database/entities/trip.entity';
import { UserRole } from '../../database/entities/user.entity';
import { OrderReceiptDto } from './dto/order-receipt.dto';
import { OrdersQueryService } from './orders-query.service';

/**
 * Safar cheki.
 *
 * NEGA ALOHIDA SERVIS: `orders-query.service.ts` allaqachon 300+ qator va chek
 * o'z domeniga ega — u buyurtmani emas, TUGAGAN safarning moliyaviy hujjatini
 * yig'adi.
 *
 * ⚠️ Chekda komissiya va `driverEarning` ATAYLAB YO'Q. Chek — yo'lovchi
 * hujjati; platforma qancha ushlab qolgani unga tegishli emas va uni
 * ko'rsatish haydovchi bilan yo'lovchi o'rtasida keraksiz savol tug'diradi.
 */
@Injectable()
export class OrdersReceiptService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly queryService: OrdersQueryService,
  ) {}

  async getReceipt(
    orderId: string,
    user: { id: string; role: UserRole },
  ): Promise<OrderReceiptDto> {
    // Kirish huquqi GET /orders/:id bilan AYNAN bir xil — javob manzillar va
    // shaxsiy ma'lumot tashiydi. Tekshiruv qayta yozilmaydi, mavjudi
    // ishlatiladi, aks holda ikkita qoida vaqt o'tishi bilan ajralib ketadi.
    const order = await this.queryService.findByIdForUser(orderId, user);

    if (order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException('Chek faqat tugagan safar uchun mavjud');
    }

    // `promoCode` relation'i standart yuklamada yo'q — chekda promokod
    // MATNINI ko'rsatish uchun alohida o'qiymiz. Bitta buyurtma uchun
    // qo'shimcha JOIN arzon.
    const withPromo = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['promoCode'],
    });

    const trip = await this.tripRepository.findOne({ where: { orderId } });

    // To'lov holati. PENDING = hamyonda mablag' yetmagan yoki karta hali
    // provayder callback'i bilan yopilmagan (`orders-completion.service.ts`
    // dagi `chargeStatus` mantig'i).
    //
    // ⚠️ CHAQIM QATORI CHETLAB O'TILADI. Chaqim ham AYNI SHU buyurtmaga
    // yo'lovchi nomidan DEBIT yozadi (`orders-tips.service.ts`) va u yo'l
    // haqidan KEYIN yaratiladi. Shunchaki "eng oxirgi DEBIT" olinsa, chek
    // to'lov holatini chaqimdan o'qib qolardi: to'lanmagan yo'l haqi
    // COMPLETED chaqim bilan yopilib ko'rinib, chek qarzni YASHIRIB
    // qo'yardi — hujjat uchun eng yomon xato.
    //
    // Filtr SQL'da emas, JS tomonda: `external_id <> 'tip'` NULL qatorlarni
    // ham chiqarib tashlaydi (NULL bilan solishtirish NULL beradi), yo'l
    // haqi qatorida esa `external_id` aynan NULL.
    const debits = await this.transactionRepository.find({
      where: {
        orderId,
        userId: order.passengerId,
        type: TransactionType.DEBIT,
      },
      order: { createdAt: 'DESC' },
    });
    const charge =
      debits.find((row) => row.externalId !== TIP_LEDGER_TAG) ?? null;

    const total = order.finalPrice ?? 0;
    const discountAmount = order.discountAmount ?? 0;

    return {
      orderId: order.id,
      // Foydalanuvchi qo'llab-quvvatlashga aytadigan qisqa raqam. To'liq UUID
      // telefonda o'qib bo'lmaydi.
      orderNumber: order.id.split('-')[0].toUpperCase(),
      completedAt: order.completedAt,
      serviceType: order.serviceType,

      pickupAddress: order.pickupAddress,
      dropoffAddress: order.dropoffAddress,
      waypoints: order.waypoints ?? [],

      tariffId: order.tariffId,
      tariffName: order.tariff?.name ?? null,

      distanceKm: trip?.actualDistanceKm ?? null,
      durationMin: trip?.actualDurationMin ?? null,

      // Eski safarlarda `null` — tarkib o'sha paytda saqlanmagan. Chek ekrani
      // buni "tarkib mavjud emas" deb ko'rsatadi va soxta tarkib o'ylab
      // topmaydi: qaysi tarif bilan hisoblanganini endi bilib bo'lmaydi.
      fare: order.fareBreakdown,
      surgeMultiplier: order.surgeMultiplier ?? 1,

      grossPrice: total + discountAmount,
      discountAmount,
      promoCode: withPromo?.promoCode?.code ?? null,
      tipAmount: order.tipAmount ?? 0,
      total,

      paymentMethod: order.paymentMethod,
      paymentStatus: charge?.status ?? null,
      unpaidAmount:
        charge?.status === TransactionStatus.PENDING ? charge.amount : 0,

      driver: order.driver
        ? {
            name:
              [order.driver.firstName, order.driver.lastName]
                .filter(Boolean)
                .join(' ')
                .trim() || 'Haydovchi',
            carModel:
              (order.driver as unknown as Record<string, unknown>)
                .carModel as string | null,
            carNumber:
              (order.driver as unknown as Record<string, unknown>)
                .carNumber as string | null,
          }
        : null,
    };
  }
}
