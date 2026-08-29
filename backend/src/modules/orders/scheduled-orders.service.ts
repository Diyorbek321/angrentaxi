// Rejalashtirilgan safarlarni o'z vaqtida hayotga qaytaruvchi servis.
//
// Buyurtma `SCHEDULED` holatida yaratiladi va HECH KIM uni ko'rmaydi:
// haydovchiga taklif qilinmaydi, dispetcher taxtasida turmaydi. Bu yerdagi
// cron har daqiqada "kimning vaqti keldi" deb so'raydi va yetganini
// `CREATED` ga o'tkazib `MatchingService.startSearch` ni chaqiradi.
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThan, Repository } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { MatchingService } from '../matching/matching.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TariffsService } from '../tariffs/tariffs.service';
import { UsersService } from '../users/users.service';
import { OrdersCreationService } from './orders-creation.service';
import { OrdersQueryService } from './orders-query.service';
import { OrderStatusTransitionService } from './order-status-transition.service';
import {
  MS_PER_MINUTE,
  SCHEDULED_DISPATCH_BATCH,
  SCHEDULED_DISPATCH_LEAD_MINUTES,
  SCHEDULED_STALE_AFTER_MINUTES,
} from './scheduled-orders.constants';

/**
 * NEGA CRON, NAVBAT (BullMQ/Kafka) EMAS.
 *
 * 1. Holat xotirada emas, Postgres'da. Rejalashtirilgan safar haqidagi
 *    yagona haqiqat manbai — `orders.status = 'scheduled'` + `scheduled_at`
 *    qatori. Deploy, crash, restart — hech narsa yo'qolmaydi, keyingi tick
 *    to'xtagan joydan davom etadi. Bu aynan navbat beradigan durability.
 *    (`matching.service.ts` dagi izoh `setTimeout` ni nega olib tashlaganini
 *    tasvirlaydi — biz o'sha xatoni takrorlamaymiz.)
 *
 * 2. Exactly-once allaqachon bor: `updateOrderStatusAtomic` shartli UPDATE
 *    qiladi, ya'ni ikki instans bir buyurtmani bir vaqtda ko'rsa ham faqat
 *    bittasi `startSearch` ga yetadi. Navbatning "visibility timeout"
 *    mexanizmi bitta SQL bilan almashtiriladi.
 *
 * 3. Hajm arzimas: Angren uchun bir daqiqada 0-3 ta reja. Solishtirish
 *    uchun `MatchingService` HAR 2 SONIYADA Redis'dan butun aktiv to'plamni
 *    o'qiydi.
 *
 * ⚠️ NARX QAYTA HISOBLANMAYDI. `releaseDueOrder` marshrutni ham, tarifni
 * ham qayta narxlamaydi — quote buyurtma berilganda `fare_breakdown` ga
 * yozilgan va `is_fixed_price` bilan qotirilgan. Yo'lovchiga ko'rsatilgan
 * summa — undiriladigan summa. Batafsil: `order.entity.ts#scheduledAt`.
 */
@Injectable()
export class ScheduledOrdersService {
  private readonly logger = new Logger(ScheduledOrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly queryService: OrdersQueryService,
    private readonly creationService: OrdersCreationService,
    private readonly statusTransition: OrderStatusTransitionService,
    private readonly tariffsService: TariffsService,
    private readonly matchingService: MatchingService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  // Har daqiqada. Aniqlik uchun yetarli: qidiruv baribir olib ketishdan
  // SCHEDULED_DISPATCH_LEAD_MINUTES oldin boshlanadi, ya'ni bir daqiqalik
  // donadorlik o'sha zaxira ichida yo'qoladi.
  @Cron(CronExpression.EVERY_MINUTE, { name: 'scheduled-orders-dispatch' })
  async handleDispatchTick(): Promise<void> {
    try {
      await this.dispatchDueOrders();
    } catch (err) {
      // Cron'dagi ushlanmagan xato Nest scheduler'ini jim qoldirishi mumkin —
      // ya'ni bitta buzuq tick BARCHA kelgusi rejalarni o'ldirardi.
      // (`refresh-token-cleanup.service.ts` dagi bilan bir xil himoya.)
      this.logger.error(`Rejalashtirilgan buyurtmalar dispatch'i yiqildi: ${err}`);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'scheduled-orders-stale' })
  async handleStaleTick(): Promise<void> {
    try {
      await this.cancelStaleScheduled();
    } catch (err) {
      this.logger.error(`Eskirgan rejalarni tozalash yiqildi: ${err}`);
    }
  }

  /**
   * Vaqti kelgan rejalarni topib bittalab ishga tushiradi.
   *
   * `now` ATAYLAB parametr: cron'ni soatga bog'lamasdan testdan o'tkazish
   * uchun (`refresh-token-cleanup.service.ts#pruneExpiredTokens` namunasi).
   *
   * Qaytaradi: haqiqatda dispatch qilingan buyurtmalar soni.
   */
  async dispatchDueOrders(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() + SCHEDULED_DISPATCH_LEAD_MINUTES * MS_PER_MINUTE);

    // ⚠️ PASTKI CHEGARA MAJBURIY. Faqat `LessThanOrEqual(cutoff)` bo'lganda bu
    // so'rov `cancelStaleScheduled` qidiradigan qatorlarni HAM qamrab olardi:
    // ikkala oyna ustma-ust tushib, eskirgan reja ikkalasiga ham tegishli
    // bo'lardi. Dispatch har daqiqada, stale esa har 10 daqiqada ishlagani
    // uchun — va bu yerda saralash `scheduledAt ASC`, ya'ni ENG ESKISI
    // BIRINCHI — poygada doim dispatch yutardi. Natijada backend bir necha
    // soat o'chib tursa, yoqilgan lahzada kechagi rejalar bekor qilinish
    // o'rniga birdaniga haydovchi qidira boshlardi: aynan
    // `cancelStaleScheduled` to'sishi kerak bo'lgan hol.
    const staleCutoff = new Date(now.getTime() - SCHEDULED_STALE_AFTER_MINUTES * MS_PER_MINUTE);

    const due = await this.orderRepository.find({
      where: {
        status: OrderStatus.SCHEDULED,
        scheduledAt: Between(staleCutoff, cutoff),
      },
      order: { scheduledAt: 'ASC' },
      take: SCHEDULED_DISPATCH_BATCH,
      // Faqat ID kerak — to'liq qatorni (PostGIS geometriyasi va uchta
      // bog'lanish bilan) o'qish har daqiqada bekorga bo'lardi.
      // `scheduledAt` ham tanlanadi, chunki u ORDER BY da ishlatiladi.
      select: ['id', 'scheduledAt'],
    });

    let released = 0;
    for (const { id } of due) {
      // Har bir buyurtma ALOHIDA try/catch: bitta buzuq buyurtma (o'chirilgan
      // tarif, yo'q yo'lovchi) butun paketni to'xtatib qo'ymasligi kerak.
      try {
        if (await this.releaseDueOrder(id, now)) released += 1;
      } catch (err) {
        this.logger.error(`Rejalashtirilgan buyurtma ${id} ishga tushmadi: ${err}`);
      }
    }

    if (released > 0) {
      this.logger.log(`${released} ta rejalashtirilgan safar qidiruvga chiqarildi`);
    }

    return released;
  }

  /**
   * Bitta rejani jonli buyurtmaga aylantiradi.
   *
   * `true` — qidiruv boshlandi; `false` — buyurtma o'tkazib yuborildi
   * (allaqachon ishlangan, bekor qilingan yoki darvozalardan o'tmadi).
   *
   * ⚠️ IDEMPOTENTLIK IKKI QATLAMDA:
   *   1. `status !== SCHEDULED` → darhol chiqish (arzon, keng tarqalgan hol);
   *   2. `updateOrderStatusAtomic(..., [SCHEDULED], ...)` → shartli UPDATE.
   *      Ikki instans bir vaqtda bir buyurtmani ko'rsa, `WHERE status IN
   *      ('scheduled')` faqat BITTASIDA 1 qatorga tegadi; yutqazgani
   *      `ConflictException` oladi va `startSearch` gacha YETMAYDI.
   *      Birinchi qatlam yolg'iz yetarli EMAS — u TOCTOU oynasi.
   */
  async releaseDueOrder(orderId: string, now: Date = new Date()): Promise<boolean> {
    const order = await this.queryService.findByIdOrThrow(orderId);

    if (order.status !== OrderStatus.SCHEDULED) {
      this.logger.debug(
        `Buyurtma ${orderId} allaqachon ${order.status} holatida — o'tkazib yuborildi`,
      );
      return false;
    }

    // Ikkinchi qatlam: `dispatchDueOrders` so'rovi eskirganlarni allaqachon
    // chetlab o'tadi, lekin bu metod tashqaridan (qo'lda qayta ishga tushirish,
    // test, kelgusi chaqiruvchi) ham chaqiriladi. Vaqti o'tib ketgan rejani
    // JIM o'tkazib yuborish uni `scheduled` holatida abadiy qoldirardi —
    // shuning uchun bu yerda ham stale cron bilan BIR XIL qaror qabul
    // qilinadi: bekor qilish va yo'lovchiga sabab aytish.
    const staleCutoff = new Date(now.getTime() - SCHEDULED_STALE_AFTER_MINUTES * MS_PER_MINUTE);
    if (order.scheduledAt && order.scheduledAt.getTime() < staleCutoff.getTime()) {
      await this.cancelScheduled(order, "Rejalashtirilgan vaqt o'tib ketdi");
      return false;
    }

    // Tarif reja tuzilgandan keyin o'chirilgan bo'lishi mumkin. Bunda
    // haydovchi qidirishning ma'nosi yo'q — narx tarkibi o'sha tarifga
    // bog'langan.
    const tariff = await this.tariffsService.findById(order.tariffId);
    if (!tariff.isActive) {
      await this.cancelScheduled(order, "Tanlangan tarif endi mavjud emas");
      return false;
    }

    // Qarz darvozasi QAYTA tekshiriladi: yo'lovchi rejalashtirgan paytda
    // qarzsiz edi, safar bajariladigan paytda qarzdor bo'lishi mumkin.
    // Usiz rejalashtirilgan safar qarz tekshiruvini butunlay chetlab
    // o'tadigan yo'lga aylanardi.
    const debt = await this.creationService.getOutstandingWalletDebt(order.passengerId);
    if (debt > 0) {
      await this.cancelScheduled(
        order,
        `Oldingi safardan ${debt} so'm to'lanmagan qarz bor`,
      );
      return false;
    }

    // Narx SHU YERDA QAYTA HISOBLANMAYDI — quote allaqachon saqlangan.
    // Marshrutni OSRM bilan qayta so'rash ham kerak emas: u ham o'sha
    // qotirilgan hisob-kitobning bir qismi.
    try {
      await this.statusTransition.updateOrderStatusAtomic(
        orderId,
        [OrderStatus.SCHEDULED],
        { status: OrderStatus.CREATED },
      );
    } catch (err) {
      if (err instanceof ConflictException) {
        // Poygada yutqazdik — boshqa instans (yoki oldingi tick) allaqachon
        // shu buyurtmani chiqargan. `startSearch` IKKINCHI MARTA
        // chaqirilmaydi: aks holda bitta safar uchun ikkita haydovchi
        // navbati ochilardi.
        this.logger.warn(
          `Buyurtma ${orderId} boshqa jarayon tomonidan allaqachon chiqarilgan`,
        );
        return false;
      }
      throw err;
    }

    const released = await this.queryService.findByIdOrThrow(orderId);

    this.realtimeGateway.emitToUser(order.passengerId, 'order:scheduled_released', {
      orderId,
      status: OrderStatus.CREATED,
      // Narx o'zgarmagani ochiq aytiladi — ilova buni foydalanuvchiga
      // ko'rsatib, "narx oshib ketdimi?" savolini oldindan yopadi.
      estimatedPrice: order.estimatedPrice,
    });

    // Endi bu jonli buyurtma — dispetcher taxtasiga ham chiqadi.
    this.realtimeGateway.emitToManagers('order:created', released);

    await this.matchingService.startSearch(orderId);

    return true;
  }

  /**
   * `scheduled_at` dan SCHEDULED_STALE_AFTER_MINUTES o'tib ketgan rejalarni
   * bekor qiladi.
   *
   * Bu backend uzoq o'chib turgan holat uchun himoya: usiz kechagi reja
   * bugun to'satdan haydovchi qidira boshlardi va yo'lovchi kutmagan
   * safar buyurtma qilingan bo'lardi.
   */
  async cancelStaleScheduled(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - SCHEDULED_STALE_AFTER_MINUTES * MS_PER_MINUTE);

    const stale = await this.orderRepository.find({
      where: {
        status: OrderStatus.SCHEDULED,
        scheduledAt: LessThan(cutoff),
      },
      take: SCHEDULED_DISPATCH_BATCH,
      select: ['id'],
    });

    let cancelled = 0;
    for (const { id } of stale) {
      try {
        const order = await this.queryService.findByIdOrThrow(id);
        if (order.status !== OrderStatus.SCHEDULED) continue;
        await this.cancelScheduled(order, "Rejalashtirilgan vaqt o'tib ketdi");
        cancelled += 1;
      } catch (err) {
        this.logger.error(`Eskirgan reja ${id} bekor qilinmadi: ${err}`);
      }
    }

    return cancelled;
  }

  /**
   * Rejani bekor qiladi va yo'lovchiga sababini aytadi.
   *
   * Push MAJBURIY, soket emas: rejalashtirilgan safar bekor bo'lganda
   * yo'lovchi ilovaga qaramayotgan bo'ladi — soket eventi unga yetib
   * bormaydi va u faqat haydovchi kelmaganda bilib qolardi.
   */
  private async cancelScheduled(order: Order, reason: string): Promise<void> {
    try {
      await this.statusTransition.updateOrderStatusAtomic(
        order.id,
        [OrderStatus.SCHEDULED],
        { status: OrderStatus.CANCELLED, cancelReason: reason },
      );
    } catch (err) {
      if (err instanceof ConflictException) return;
      throw err;
    }

    this.realtimeGateway.emitToUser(order.passengerId, 'order:cancelled', {
      orderId: order.id,
      reason,
    });

    const passenger = await this.usersService.findById(order.passengerId);
    if (passenger) {
      await this.notificationsService.notifyOrderCancelled(passenger, order, reason);
    }

    this.logger.warn(`Rejalashtirilgan buyurtma ${order.id} bekor qilindi: ${reason}`);
  }
}
