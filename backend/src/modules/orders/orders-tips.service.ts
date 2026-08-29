import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Order,
  OrderStatus,
  PaymentMethod,
} from '../../database/entities/order.entity';
import {
  TIP_LEDGER_TAG,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { Trip } from '../../database/entities/trip.entity';
import { DriversService } from '../drivers/drivers.service';
import {
  computeSpendableBalance,
  lockWalletForUpdate,
} from '../payments/wallet-balance.util';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AddTipDto } from './dto/add-tip.dto';
import { OrdersQueryService } from './orders-query.service';

/**
 * Chaqim (tips) — safar tugagandan keyin yo'lovchi haydovchiga qo'shimcha
 * beradigan summa.
 *
 * ⚠️ CHAQIM KOMISSIYASIZ. Butun talabning mohiyati shu, va uni kodda
 * tasdiqlaydigan yagona joy — quyida komissiya DEBIT qatori YOZILMAGANI.
 *
 * NEGA ALOHIDA SERVIS: `orders-completion.service.ts` allaqachon 490+ qator
 * va u safarni yakunlash oqimini tasvirlaydi. Chaqim esa safar tugagandan
 * KEYINGI mustaqil pul hodisasi — uni `completeTrip` ichiga tiqish ikkala
 * oqimni ham o'qishga qiyinlashtirardi.
 *
 * NEGA FAQAT HAMYON: karta orqali chaqim hozirgi to'lov qatlamini buzadi.
 * `PaymentsService.findPaymentTransaction(orderId)` shu buyurtmadagi ENG
 * OXIRGI DEBIT qatorini oladi — chaqim DEBIT'i yo'l DEBIT'ini to'sib qo'yadi
 * va provayder callback'i noto'g'ri summani solishtirib, to'lovni rad etadi.
 * Karta chaqimi `payments.service.ts` refaktoringidan keyin qo'shiladi.
 */
@Injectable()
export class OrdersTipsService {
  private readonly logger = new Logger(OrdersTipsService.name);

  /** Safar tugagandan keyin chaqim berish mumkin bo'lgan oyna. */
  private static readonly TIP_WINDOW_MS = 24 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    private readonly dataSource: DataSource,
    private readonly driversService: DriversService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly queryService: OrdersQueryService,
  ) {}

  async addTip(
    passengerId: string,
    orderId: string,
    dto: AddTipDto,
  ): Promise<{ tipAmount: number; walletBalance: number }> {
    const order = await this.queryService.findByIdOrThrow(orderId);

    if (order.passengerId !== passengerId) {
      throw new ForbiddenException('Bu safar sizga tegishli emas');
    }

    if (order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException('Chaqim faqat tugagan safar uchun beriladi');
    }

    if (!order.driverId) {
      throw new BadRequestException('Bu buyurtmaga haydovchi biriktirilmagan');
    }

    await this.assertWithinTipWindow(order);

    const driverId = order.driverId;

    const walletBalance = await this.dataSource.transaction(async (manager) => {
      // Bir vaqtda ikki marta yuborilgan so'rov ikkita chaqim yozib
      // qo'ymasligi uchun buyurtma qatori qulflanadi.
      await manager.query('SELECT id FROM orders WHERE id = $1 FOR UPDATE', [
        orderId,
      ]);

      const fresh = await manager.findOne(Order, { where: { id: orderId } });
      if (fresh?.tipAmount != null) {
        throw new ConflictException(
          'Bu safar uchun chaqim allaqachon berilgan',
        );
      }

      await lockWalletForUpdate(manager, passengerId);

      const transactionRepo = manager.getRepository(Transaction);
      const balance = await computeSpendableBalance(transactionRepo, passengerId);

      // ⚠️ MABLAG' YETMASA — QARZ YARATILMAYDI, so'rov rad etiladi.
      //
      // `orders-creation.service.ts` dagi `getOutstandingWalletDebt` PENDING
      // holatdagi hamyon DEBIT'ini qarz deb hisoblaydi va yo'lovchini
      // KEYINGI BUYURTMADAN BLOKLAYDI. Ya'ni PENDING chaqim qarzi
      // ixtiyoriy xayrixohlikni majburiy to'lovga aylantirib qo'yardi.
      if (balance < dto.amount) {
        throw new BadRequestException(
          "Hamyonda mablag' yetarli emas. Avval hamyonni to'ldiring.",
        );
      }

      await transactionRepo.save({
        userId: passengerId,
        orderId,
        amount: dto.amount,
        type: TransactionType.DEBIT,
        paymentMethod: PaymentMethod.WALLET,
        status: TransactionStatus.COMPLETED,
        externalId: TIP_LEDGER_TAG,
      });

      await transactionRepo.save({
        userId: driverId,
        orderId,
        amount: dto.amount,
        type: TransactionType.CREDIT,
        paymentMethod: PaymentMethod.WALLET,
        status: TransactionStatus.COMPLETED,
        externalId: TIP_LEDGER_TAG,
      });

      // ⚠️ BU YERDA KOMISSIYA DEBIT QATORI YO'Q — ataylab.
      // Haydovchi to'liq summani oladi.
      await this.driversService.adjustBalanceWithin(
        manager,
        driverId,
        dto.amount,
      );

      // `driverEarning` ga QO'SHILMAYDI: u komissiya ayirilgan sof yo'l haqi,
      // chaqim esa undan tashqarida. Aralashtirilsa daromad hisoboti buziladi.
      await manager.update(Order, orderId, {
        tipAmount: dto.amount,
        tipPaymentMethod: PaymentMethod.WALLET,
        tipPaidAt: new Date(),
      });

      return balance - dto.amount;
    });

    // Tranzaksiyadan TASHQARIDA: xabar yuborish muvaffaqiyatsiz bo'lsa,
    // pul harakati bekor qilinmasligi kerak.
    try {
      this.realtimeGateway.emitToUser(driverId, 'order:tip', {
        orderId,
        amount: dto.amount,
      });
    } catch (err) {
      this.logger.warn(
        `Chaqim bildirishnomasi yuborilmadi (${orderId}): ${(err as Error).message}`,
      );
    }

    return { tipAmount: dto.amount, walletBalance };
  }

  /**
   * Chaqim oynasi safar TUGAGAN vaqtdan boshlanadi.
   *
   * ⚠️ `order.updatedAt` bu yerda ishlatib BO'LMAYDI — undan keyingi har
   * qanday yozuv (masalan `PaymentsService.settleOrderPayout`) uni surib
   * yuboradi va oyna cheksiz uzayadi. `order.completedAt` yangi ustun, eski
   * safarlarda u `trips.end_time` dan tiklangan; ikkalasi ham bo'lmasa
   * chaqim rad etiladi.
   */
  private async assertWithinTipWindow(order: Order): Promise<void> {
    let completedAt = order.completedAt;

    if (!completedAt) {
      const trip = await this.tripRepository.findOne({
        where: { orderId: order.id },
      });
      completedAt = trip?.endTime ?? null;
    }

    if (!completedAt) {
      throw new BadRequestException(
        'Safar tugagan vaqt aniqlanmadi — chaqim berib bo\'lmaydi',
      );
    }

    const elapsed = Date.now() - new Date(completedAt).getTime();
    if (elapsed > OrdersTipsService.TIP_WINDOW_MS) {
      throw new BadRequestException(
        'Chaqim safar tugaganidan keyin 24 soat ichida beriladi',
      );
    }
  }
}
