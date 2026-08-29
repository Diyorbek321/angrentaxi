// Order intake: fare quoting, passenger-initiated order creation (raw PostGIS
// INSERT plus promo validation and the "order created" fan-out), and the
// manager/admin manual-entry variant that resolves a passenger by phone first.
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from '../../database/entities/order.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { TariffsService } from '../tariffs/tariffs.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService } from '../users/users.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateDispatchOrderDto } from './dto/create-dispatch-order.dto';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { SurgeService } from '../surge/surge.service';
import { CitiesService } from '../cities/cities.service';
import { haversineDistance, haversineRouteDistance } from './orders.distance.util';
import { OrdersQueryService } from './orders-query.service';
import { OsrmService } from '../routing/osrm.service';
import {
  MS_PER_MINUTE,
  SCHEDULED_MAX_AHEAD_DAYS,
  SCHEDULED_MIN_LEAD_MINUTES,
} from './scheduled-orders.constants';

@Injectable()
export class OrdersCreationService {
  private readonly logger = new Logger(OrdersCreationService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly tariffsService: TariffsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly usersService: UsersService,
    private readonly promoCodesService: PromoCodesService,
    private readonly queryService: OrdersQueryService,
    private readonly surgeService: SurgeService,
    private readonly osrmService: OsrmService,
    private readonly citiesService: CitiesService,
  ) {}

  /**
   * Buyurtma qaysi shaharda yaratilayotganini OLISH NUQTASIDAN aniqlaydi.
   *
   * ⚠️ HIMOYA (a) — BIRINCHI QATOR: jadvalda birorta FAOL shahar bo'lmasa,
   * tekshiruv UMUMAN qo'llanmaydi va `null` qaytadi. Ya'ni ko'p shaharlilik
   * deploy qilingan lahzada hech narsa to'xtamaydi: buyurtma avvalgidek
   * yaratiladi, `city_id` esa bo'sh qoladi. Qamrov faqat kimdir birinchi
   * shaharni qo'shgan kundan boshlab kuchga kiradi.
   *
   * ⚠️ FOYDALANUVCHI SHAHARNI TANLAMAYDI. Bu ataylab: qo'lda tanlash yana
   * bir xato manbai bo'lardi (Angrenni tanlab Toshkentdan buyurtma berish),
   * koordinata esa yolg'on gapira olmaydi.
   */
  private async resolveCityIdForPickup(
    lat: number,
    lng: number,
  ): Promise<string | null> {
    if (!(await this.citiesService.isCoverageEnforced())) {
      return null;
    }

    const city = await this.citiesService.resolveForPoint(lat, lng);
    if (!city) {
      throw new BadRequestException(
        "Bu hududda hozircha xizmat ko'rsatilmaymiz",
      );
    }

    return city.id;
  }


  /**
   * Ikki nuqta (va oraliq to'xtashlar) orasidagi YO'L masofasi.
   *
   * ⚠️ NEGA HAVERSINE YETMAYDI: to'g'ri chiziq masofasi haqiqiy yo'ldan
   * doimo KICHIK bo'ladi (Angrenda odatda 20-40%). Ilgari buyurtma aynan
   * haversine bo'yicha narxlanardi, yo'lovchiga esa mobil ilova OSRM'dan
   * olgan yo'l masofasi ko'rsatilardi — ya'ni ko'rsatilgan narx bilan
   * yozilgan narx boshqa-boshqa sonlar edi.
   *
   * OSRM javob bermasa haversine'ga qaytamiz, lekin `routed: false` bilan:
   * chaqiruvchi bunda narxni QAT'IY qilib belgilamaydi, chunki asos
   * ishonchsiz.
   */
  private async resolveRouteDistanceKm(points: {
    lat: number;
    lng: number;
  }[]): Promise<{ distanceKm: number; routed: boolean }> {
    const straightLine =
      points.length > 2
        ? haversineRouteDistance(points)
        : haversineDistance(
            points[0].lat,
            points[0].lng,
            points[1].lat,
            points[1].lng,
          );

    // Yo'lovchi spinnerga qarab turibdi — 2.5 soniyadan ko'p kutmaymiz.
    //
    // ⚠️ OSRM `Coordinate` — bu `[lng, lat]`, `[lat, lng]` EMAS. Teskari
    // berilsa masofa mutlaqo boshqa chiqadi va xato jimgina o'tib ketadi.
    const metres = await this.osrmService.routeDistanceMeters(
      points.map((p) => [p.lng, p.lat] as const),
      2500,
    );

    if (metres == null) {
      this.logger.warn(
        'OSRM javob bermadi — baholash to\'g\'ri chiziq bo\'yicha, narx qat\'iy emas',
      );
      return { distanceKm: straightLine, routed: false };
    }

    return { distanceKm: metres / 1000, routed: true };
  }

  async calculatePrice(
    dto: CalculatePriceDto,
  ): Promise<{
    price: number;
    tariffId: string;
    distanceKm: number;
    durationMin: number;
    surgeMultiplier: number;
  }> {
    // Surge belongs to the pickup area, so it can only be applied when the
    // client sends where the ride starts. Older clients omit it and get the
    // tariff's own multiplier, as before.
    const surge =
      dto.pickupLat !== undefined && dto.pickupLng !== undefined
        ? (await this.surgeService.snapshotFor(dto.pickupLat, dto.pickupLng))
            .multiplier
        : 1.0;

    // Manzil berilgan bo'lsa masofani SERVER hisoblaydi. Mijozning raqami
    // e'tiborga olinmaydi — narx mijozga ishonib qo'yiladigan narsa emas,
    // va buyurtma yaratilganda baribir server hisobi ishlatiladi.
    let distanceKm = dto.distanceKm;
    let durationMin = dto.durationMin;

    if (
      dto.pickupLat !== undefined &&
      dto.pickupLng !== undefined &&
      dto.dropoffLat !== undefined &&
      dto.dropoffLng !== undefined
    ) {
      const resolved = await this.resolveRouteDistanceKm([
        { lat: dto.pickupLat, lng: dto.pickupLng },
        { lat: dto.dropoffLat, lng: dto.dropoffLng },
      ]);
      if (resolved.routed) {
        distanceKm = resolved.distanceKm;
        durationMin = Math.ceil(resolved.distanceKm * 2.5);
      }
    }

    const price = await this.tariffsService.calculatePriceByTariffId(
      dto.tariffId,
      distanceKm,
      durationMin,
      surge,
    );

    return {
      price,
      tariffId: dto.tariffId,
      distanceKm,
      durationMin,
      // Returned so the app can tell the passenger *why* the price is higher
      // than usual. A surge the rider can't see reads as arbitrary pricing.
      surgeMultiplier: surge,
    };
  }

  /**
   * Total of the passenger's unpaid ride charges.
   *
   * A wallet trip whose balance fell short at completion is recorded as a
   * PENDING debit (see OrdersCompletionService). Without this gate the
   * passenger could keep ordering indefinitely on an empty wallet, and every
   * one of those rides would be work the platform can never collect for.
   * Card charges are excluded: those settle through the provider callback and
   * a passenger should not be locked out while one is briefly in flight.
   *
   * ⚠️ ATAYLAB `public`: `ScheduledOrdersService` qarzni dispatch paytida
   * QAYTA tekshiradi. Yo'lovchi kecha rejalashtirganda qarzsiz edi, bugun
   * safar bajariladigan paytda qarzdor bo'lishi mumkin — bu tekshiruv faqat
   * yaratishda qolsa, rejalashtirilgan safar qarz darvozasini butunlay
   * chetlab o'tadigan yo'lga aylanardi.
   */
  async getOutstandingWalletDebt(passengerId: string): Promise<number> {
    const result = await this.transactionRepository
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'debt')
      .where('t.userId = :passengerId', { passengerId })
      .andWhere('t.type = :type', { type: TransactionType.DEBIT })
      .andWhere('t.status = :status', { status: TransactionStatus.PENDING })
      .andWhere('t.paymentMethod = :method', { method: PaymentMethod.WALLET })
      .andWhere('t.orderId IS NOT NULL')
      .getRawOne<{ debt: string }>();

    return parseFloat(result?.debt ?? '0');
  }

  /**
   * `dto.scheduledAt` ni tekshirib `Date` ga o'giradi. `undefined` bo'lsa —
   * odatdagi "hozir" buyurtmasi.
   *
   * ⚠️ Validatsiya CONTROLLER'da emas, shu yerda: `createForDispatch` ham
   * aynan shu metodga delegate qiladi, ya'ni call-centre orqali kelgan
   * buyurtma ham xuddi shu chegaralardan o'tishi kerak.
   */
  private resolveScheduledAt(raw: string | undefined, now: Date): Date | null {
    if (raw === undefined) return null;

    const when = new Date(raw);
    if (Number.isNaN(when.getTime())) {
      throw new BadRequestException("Rejalashtirilgan vaqt formati noto'g'ri");
    }

    const earliest = new Date(now.getTime() + SCHEDULED_MIN_LEAD_MINUTES * MS_PER_MINUTE);
    if (when.getTime() < earliest.getTime()) {
      throw new BadRequestException(
        `Rejalashtirilgan safar hozirdan kamida ${SCHEDULED_MIN_LEAD_MINUTES} daqiqa keyin bo'lishi kerak`,
      );
    }

    const latest = new Date(
      now.getTime() + SCHEDULED_MAX_AHEAD_DAYS * 24 * 60 * MS_PER_MINUTE,
    );
    if (when.getTime() > latest.getTime()) {
      throw new BadRequestException(
        `Safarni ko'pi bilan ${SCHEDULED_MAX_AHEAD_DAYS} kun oldin rejalashtirish mumkin`,
      );
    }

    return when;
  }

  async create(passengerId: string, dto: CreateOrderDto): Promise<Order> {
    const scheduledAt = this.resolveScheduledAt(dto.scheduledAt, new Date());

    // ⚠️ QAMROV TEKSHIRUVI ENG BOSHIDA — OSRM chaqiruvi, narx hisobi va
    // promokod tekshiruvidan OLDIN. Xizmat ko'rsatilmaydigan hududdagi
    // buyurtma baribir rad etiladi, ya'ni undan oldin bajarilgan har qanday
    // ish (ayniqsa 2.5 soniyagacha kutiladigan OSRM so'rovi) sof isrof
    // bo'lardi, va yo'lovchi xatoni shuncha kech ko'rardi.
    const cityId = await this.resolveCityIdForPickup(
      dto.pickupLat,
      dto.pickupLng,
    );

    const tariff = await this.tariffsService.findById(dto.tariffId);

    if (!tariff.isActive) {
      throw new BadRequestException('Selected tariff is not available');
    }

    const outstandingDebt = await this.getOutstandingWalletDebt(passengerId);

    if (outstandingDebt > 0) {
      throw new BadRequestException(
        `You have an unpaid balance of ${outstandingDebt} so'm from a previous trip. ` +
          'Please top up your wallet before ordering again.',
      );
    }

    // Estimate distance using Haversine formula (frontend should provide actual distance).
    // For multi-stop rides, sum the Haversine legs across the full path:
    // pickup -> waypoint[0] -> ... -> waypoint[n-1] -> dropoff.
    // Manzil oldindan ma'lum, shuning uchun marshrutni HOZIR hisoblaymiz va
    // narxni QAT'IY qilib qotiramiz — yo'lovchi ko'rgan raqam undiriladi.
    const { distanceKm: estimatedDistanceKm, routed } =
      await this.resolveRouteDistanceKm([
        { lat: dto.pickupLat, lng: dto.pickupLng },
        ...(dto.waypoints ?? []).map((w) => ({ lat: w.lat, lng: w.lng })),
        { lat: dto.dropoffLat, lng: dto.dropoffLng },
      ]);

    const estimatedDurationMin = Math.ceil(estimatedDistanceKm * 2.5); // rough estimate

    // ⚠️ REJALASHTIRILGAN SAFARDA HAM SURGE AYNAN SHU YERDA, BUYURTMA
    // BERILGAN LAHZADA olinadi va boshqa qayta hisoblanmaydi.
    //
    // Bu ataylab qilingan tanlov, va uning ma'lum bir tavakkali bor:
    // ertalab tinch paytda buyurtma berilgan safar kechqurun tirbandlikda
    // bajarilsa, o'sha paytdagi hudud koeffitsienti ancha yuqori bo'lishi
    // mumkin — lekin yo'lovchidan ko'rsatilgan summa undiriladi va farqni
    // PLATFORMA KO'TARADI. Teskarisi ham to'g'ri: band paytda rejalashtirgan
    // yo'lovchi tinch paytda bajariladigan safar uchun ham o'sha yuqori
    // narxni to'laydi.
    //
    // Nega shunday: yo'lovchiga ko'rsatilgan raqam bilan undiriladigan raqam
    // HAR DOIM bir xil bo'lishi kerak. "Safardan 10 daqiqa oldin narx
    // qayta hisoblanadi" varianti texnik jihatdan halolroq, lekin
    // foydalanuvchi uchun bu — kutilmagan paytda o'zgaradigan narx, ya'ni
    // aynan rejalashtirish yechadigan noaniqlikni qaytarib keltiradi.
    const { multiplier: zoneSurge } = await this.surgeService.snapshotFor(
      dto.pickupLat,
      dto.pickupLng,
    );

    // Tarkib QUOTE sifatida saqlanadi. Safar yakunlanganda qat'iy narxli
    // buyurtmalarda aynan shu ishlatiladi — chek ham, undirilgan YO'L HAQI
    // ham yo'lovchiga ko'rsatilgan hisob-kitobdan chiqadi.
    //
    // ⚠️ KUTISH HAQI BU QUOTE'DA YO'Q va bo'lishi ham mumkin emas: u
    // haydovchi kelgan lahzadan safar boshlanishigacha o'lchanadi, ya'ni
    // buyurtma berilayotgan paytda hali mavjud emas. U safar yakunida
    // `withWaitingFare` bilan USTIGA qo'shiladi
    // (`orders-completion.service.ts`), va qat'iy narx kafolati unga
    // TA'SIR QILMAYDI — kafolat marshrutga tegishli, kutish esa yo'lovchi
    // boshqaradigan xarajat. Ya'ni undiriladigan summa `quote.total` dan
    // katta bo'lishi mumkin.
    const quote = this.tariffsService.calculatePriceBreakdown(
      tariff,
      estimatedDistanceKm,
      estimatedDurationMin,
      zoneSurge,
    );
    const estimatedPrice = quote.total;

    // OSRM javob bermagan bo'lsa asos to'g'ri chiziq — bunday raqamni
    // majburiy qilib qo'yish haydovchini zarar ko'rsatadi, shuning uchun
    // bunda hisoblagich rejimida qolamiz.
    const isFixedPrice = routed;

    // Validate (but don't yet consume) a promo code — usedCount/usage row are
    // only recorded on actual trip completion (see completeTrip), so an
    // abandoned/cancelled order never burns the passenger's one-time use.
    let discountAmount = 0;
    let promoCodeId: string | null = null;
    if (dto.promoCode) {
      const promoResult = await this.promoCodesService.validate(
        dto.promoCode,
        passengerId,
        estimatedPrice,
      );
      discountAmount = promoResult.discountAmount;
      promoCodeId = promoResult.promoCodeId;
    }
    const finalEstimatedPrice = Math.max(0, estimatedPrice - discountAmount);

    // Create order with PostGIS geometry
    const savedOrder = await this.orderRepository.query(
      `INSERT INTO orders (passenger_id, tariff_id, pickup_location, dropoff_location,
        pickup_address, dropoff_address, estimated_price, status, payment_method, note,
        service_type, details, promo_code_id, discount_amount, waypoints,
        surge_multiplier, fare_breakdown, is_fixed_price, scheduled_at, city_id)
       VALUES ($1, $2,
         ST_SetSRID(ST_MakePoint($3, $4), 4326),
         ST_SetSRID(ST_MakePoint($5, $6), 4326),
         $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17::jsonb, $18,
         $19::jsonb, $20, $21, $22)
       RETURNING id`,
      [
        passengerId,
        dto.tariffId,
        dto.pickupLng,
        dto.pickupLat,
        dto.dropoffLng,
        dto.dropoffLat,
        dto.pickupAddress ?? null,
        dto.dropoffAddress ?? null,
        finalEstimatedPrice,
        // Rejalashtirilgan buyurtma SCHEDULED da tug'iladi — u dispetcher
        // taxtasiga chiqmaydi va haydovchiga taklif qilinmaydi, chunki
        // hozircha bajariladigan hech narsa yo'q.
        scheduledAt ? OrderStatus.SCHEDULED : OrderStatus.CREATED,
        dto.paymentMethod ?? PaymentMethod.CASH,
        dto.note ?? null,
        dto.serviceType ?? 'taxi',
        dto.details ? JSON.stringify(dto.details) : null,
        promoCodeId,
        promoCodeId ? discountAmount : null,
        dto.waypoints?.length ? JSON.stringify(dto.waypoints) : null,
        // Hudud koeffitsienti SAQLANADI. Ilgari u shu yerda hisoblanib,
        // `estimatedPrice` ga qo'shilib, tashlab yuborilardi — natijada
        // chekda "nega qimmat?" savoliga javob beradigan hech narsa
        // qolmasdi, va safar yakunlanganda yakuniy narx boshqa
        // koeffitsientda qayta hisoblanardi.
        zoneSurge,
        JSON.stringify(quote),
        isFixedPrice,
        scheduledAt,
        // `null` — qamrov sozlanmagan yoki shahar aniqlanmagan holat
        // (ikkinchisi bu yerga yetib kelmaydi: yuqorida 400 bilan
        // to'xtatilgan). Hisobot va filtr uchun saqlanadi.
        cityId,
      ],
    );

    const orderId = (savedOrder as Array<{ id: string }>)[0].id;
    const order = await this.queryService.findByIdOrThrow(orderId);

    if (scheduledAt) {
      // ⚠️ ALOHIDA EVENT, `order:created` EMAS. Mobil ilova `order:created`
      // dan keyin safarni kuzatish rejimiga o'tadi — rejalashtirilgan
      // buyurtmada esa kuzatiladigan hech narsa yo'q va bosh ekran
      // "haydovchi izlanmoqda" holatiga qulflanib qolardi.
      //
      // Dispetcher taxtasiga ham chiqarilmaydi: taxta faqat JONLI
      // safarlar uchun va 200 qator bilan cheklangan. Rejalar uchun
      // alohida `GET /orders/scheduled` bor.
      this.realtimeGateway.emitToUser(passengerId, 'order:scheduled', {
        orderId,
        status: OrderStatus.SCHEDULED,
        scheduledAt: scheduledAt.toISOString(),
      });

      this.logger.log(
        `Order ${orderId} scheduled for ${scheduledAt.toISOString()} — ` +
          'qidiruv ScheduledOrdersService cron\'i tomonidan boshlanadi',
      );

      return order;
    }

    // Notify passenger order was created
    this.realtimeGateway.emitToUser(passengerId, 'order:created', {
      orderId,
      status: OrderStatus.CREATED,
    });

    // Let dispatchers see the new order on the live board immediately
    this.realtimeGateway.emitToManagers('order:created', order);

    // Start driver matching asynchronously
    // Note: matching module will be injected via forward reference to avoid circular deps
    this.logger.log(`Order ${orderId} created, starting driver search...`);

    return order;
  }

  // Manager/admin manual order entry — resolves (or creates) the passenger by
  // phone, then reuses the normal create() flow so matching kicks off the same way.
  async createForDispatch(dto: CreateDispatchOrderDto): Promise<Order> {
    const passenger = await this.usersService.findOrCreateByPhone(
      dto.passengerPhone,
      dto.passengerName,
    );

    return this.create(passenger.id, {
      tariffId: dto.tariffId,
      pickupLat: dto.pickupLat,
      pickupLng: dto.pickupLng,
      dropoffLat: dto.dropoffLat,
      dropoffLng: dto.dropoffLng,
      pickupAddress: dto.pickupAddress,
      dropoffAddress: dto.dropoffAddress,
      paymentMethod: dto.paymentMethod,
      note: dto.note,
      waypoints: dto.waypoints,
      serviceType: dto.serviceType,
      details: dto.details,
      promoCode: dto.promoCode,
      scheduledAt: dto.scheduledAt,
    });
  }
}
