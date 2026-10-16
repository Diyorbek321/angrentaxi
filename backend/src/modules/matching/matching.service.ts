import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { FindOperator, In, LessThan, Repository } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import Redis from 'ioredis';
import { Order, OrderStatus, ServiceType } from '../../database/entities/order.entity';
import { VehicleType } from '../../database/entities/tariff.entity';
import { DriversService, NearbyDriver } from '../drivers/drivers.service';
import { DriverCapabilityFilter } from '../drivers/driver-capabilities';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { TariffsService } from '../tariffs/tariffs.service';
import { OsrmService } from '../routing/osrm.service';
import { REDIS_CLIENT } from '../../config/redis.config';
import { DeliveryEventsService } from '../delivery/delivery-events.service';
import { VendorCashService, payVendorOf } from '../delivery/vendor-cash.service';
import { NO_DRIVERS_CANCEL_REASON } from './matching.constants';

interface DriverQueue {
  orderId: string;
  drivers: NearbyDriver[];
  currentIndex: number;
  passengerId: string;
  // Epoch ms. 0 while no driver has an active offer yet (e.g. immediately
  // after startSearch finds zero nearby drivers).
  offerExpiresAt: number;
  // Epoch ms — absolute deadline for the whole search, independent of how
  // many individual driver offers have been tried.
  noDriverDeadline: number;
  // User ids already offered this order (declined or timed out). A re-search
  // skips them so the same driver isn't re-offered a ride they just refused.
  exhaustedDriverIds: string[];
  // Pickup point and tariff tier, cached so a re-search doesn't have to
  // re-read the order row on every sweep tick.
  pickupLat: number;
  pickupLng: number;
  tariffTier: number;
  // Buyurtmaning vertikali va tarif talab qiladigan transport turi. Navbat
  // bilan birga saqlanadi, chunki qayta-qidiruv (researchDrivers) buyurtma
  // qatorini qaytadan o'qimaydi — filtr faqat startSearch'da qo'llanilsa,
  // birinchi partiya rad etganidan keyingi qidiruvda furgon buyurtmasi yana
  // sedanlarga tarqalib ketardi.
  serviceType: ServiceType;
  vehicleType: VehicleType | null;
  // Safar opsiyalari — xuddi shu sabab bilan navbatda saqlanadi: qayta
  // qidiruvda bola o'rindig'i so'ralgan safar o'rindiqsiz mashinaga ketmasin.
  tripOptions?: string[];
  // Naqd ovqat/market yetkazishida kuryer do'konga to'laydigan tovar summasi
  // (`details.payVendor`). Hamyon rejimida shu summadan kam hamyonli kuryerga
  // taklif bormaydi — qayta qidiruv ham shu qiymatni ishlatadi.
  payVendor?: number;
  // SEARCH_RADIUS_STEPS_KM dagi joriy qadam. Faqat oshadi: kichik radiusdagi
  // nomzodlar tugagandagina keyingisiga o'tiladi. Eski navbatlarda yo'q — 0.
  radiusStepIndex?: number;
}

/** Bitta haydovchiga taklif muddati. */
export const OFFER_TIMEOUT_MS = 15_000;
/**
 * Butun qidiruvning umumiy muddati (egasi qarori, 2026-10-16: 3 daqiqa).
 * Ilgari 60 s edi — Angren kabi siyrak shaharda yo'lovchi haydovchi
 * onlayn chiqishiga ulgurmasdan "topilmadi" olardi.
 */
export const SEARCH_DEADLINE_MS = 180_000;
/**
 * Qidiruv radiusi qadamlari (km). Avval eng yaqinlar; joriy radiusdagi
 * nomzodlar tugagach (hech kim yo'q / hammasi rad etgan / band) keyingi
 * qadamga o'tiladi. Vaqt bo'yicha emas, AYNAN tugash bo'yicha: 2 km ichida
 * haydovchi bo'lmasa, yo'lovchi 3 km dagi bo'sh haydovchini bekorga kutmasin.
 */
export const SEARCH_RADIUS_STEPS_KM = [2, 3, 5] as const;
/**
 * Taklif vaqti tugagach ham "qabul" shuncha soniya o'tadi: band belgisi
 * (`matching:offer:<driverId>`) taklif + shu muddat yashaydi va vaqt
 * tugaganda ATAYLAB o'chirilmaydi — 15-soniyada bosilgan "qabul"
 * tarmoq kechikishi tufayli rad etilmasin.
 */
export const OFFER_ACCEPT_GRACE_SECONDS = 5;
export { NO_DRIVERS_CANCEL_REASON };

const BATCH_SIZE = 3;
// Reaper: navbatsiz qolgan CREATED/SEARCHING buyurtma qidiruv muddati + shu
// zaxiradan keyin ham o'zgarmagan bo'lsa, "topilmadi" deb yopiladi.
const ORPHAN_REAP_MARGIN_MS = 60_000;
const ORPHAN_REAP_INTERVAL_MS = 30_000;
const ORPHAN_REAP_BATCH = 50;
// Buyurtma bo'yicha qulf: sweep tiklari, instanslar va socket/REST rad
// etishlari bitta navbatni bir vaqtda surib, ikki haydovchiga taklif
// yubormasin.
//
// TTL eng yomon sweep'dan uzun bo'lishi kerak: 3 radius o'tishi × OSRM
// (har biri ≤ 8 s timeout) + Postgres. 10 s sekin OSRM'da tugab, ikkinchi
// sweep parallel kirardi. Bo'shatish — faqat O'Z tokeni bo'lsa, ATOMIK.
const ORDER_LOCK_TTL_MS = 30_000;
const RELEASE_LOCK_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
const ORDER_LOCK_RETRY_MS = 50;
const ORDER_LOCK_MAX_WAIT_MS = 2_000;

// Queue state used to live only in a process-local Map, with setTimeout +
// SchedulerRegistry driving offer/no-driver timeouts. That meant a deploy,
// crash, or restart mid-search silently dropped every in-flight order
// search — no timer ever fired again, so an order could get stuck in
// SEARCHING forever with no driver ever offered it.
//
// Queue state now lives in Redis (survives restarts), and a periodic sweep
// (sweepExpiredOffers, every 2s) replaces the per-timer setTimeout calls —
// on restart, the next sweep tick picks up exactly where the previous
// process left off instead of losing the search entirely.
//
// Concurrency: every mutation of one order's queue (sweep tick, decline,
// cancel, start) runs under a per-order Redis lock (`matching:lock:<id>`,
// SET NX PX), and the sweep itself skips a tick while the previous one is
// still running — so overlapping ticks, a socket decline racing the sweep's
// timeout, or a second backend instance can't double-advance a queue and
// offer one order to two drivers.
@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);
  private static readonly ACTIVE_SET_KEY = 'matching:active-orders';
  // Comfortably longer than SEARCH_DEADLINE_MS so a queue record never
  // expires out from under a search that's still legitimately running; the
  // sweep (not Redis TTL) is what ends a search on time.
  private static readonly QUEUE_TTL_SECONDS = 300;
  // Re-entrancy guard: @Interval fires every 2 s regardless of whether the
  // previous tick (Redis + Postgres + OSRM per order) has finished.
  private sweepRunning = false;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly driversService: DriversService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly tariffsService: TariffsService,
    private readonly osrmService: OsrmService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    // Optional only so unit tests that build this service by hand keep
    // compiling; DeliveryEventsModule is global, so the app always has it.
    @Optional() private readonly deliveryEvents?: DeliveryEventsService,
    // Hamyon rejimi filtri (docs/LEGAL-COMPLIANCE.md §14). Global modul;
    // ixtiyoriy faqat qo'lda yig'iladigan spec'lar uchun.
    @Optional() private readonly vendorCash?: VendorCashService,
  ) {}

  /**
   * Hamyon rejimida naqd yetkazish: hamyonida tovar summasi bo'lmagan
   * kuryerlar chiqarib tashlanadi (ular baribir qabul qila olmasdi).
   * Filtr xato bersa — ro'yxat o'zgarmaydi: qabul qilishdagi tekshiruv
   * (`assertCanAccept`) baribir himoya qiladi, qidiruv esa to'xtamasligi kerak.
   */
  private async filterByWallet(payVendor: number, candidates: NearbyDriver[]): Promise<NearbyDriver[]> {
    if (!this.vendorCash || payVendor <= 0 || candidates.length === 0) return candidates;
    try {
      return await this.vendorCash.filterCouriersByWallet(payVendor, candidates);
    } catch (err) {
      this.logger.warn(`Wallet filter failed, offering unfiltered: ${(err as Error).message}`);
      return candidates;
    }
  }

  /**
   * Re-orders candidates by driving time to the pickup instead of straight-line
   * distance.
   *
   * Redis GEORADIUS ranks by air distance, which misreads exactly the cases
   * that annoy passengers most: a driver 400 m away across a river or on the
   * far side of a one-way street outranks one 900 m away with a clear run.
   *
   * Falls back to the incoming (distance-ordered) list whenever the router is
   * unavailable — dispatch must never block on routing.
   */
  private async rankByEta(
    candidates: NearbyDriver[],
    pickupLat: number,
    pickupLng: number,
  ): Promise<NearbyDriver[]> {
    if (candidates.length < 2) return candidates;

    const durations = await this.osrmService.durationsTo(
      candidates.map((d) => [d.lng, d.lat] as const),
      [pickupLng, pickupLat],
    );

    if (!durations) return candidates;

    // A driver OSRM can't route to (unmapped street) keeps their distance
    // ranking rather than being dropped — losing a real, available driver is
    // worse than ordering them imperfectly.
    const scored = candidates.map((driver, i) => ({
      driver,
      // Fallback score assumes a conservative 25 km/h city average.
      seconds: durations[i] ?? (driver.distanceKm / 25) * 3600,
    }));

    return scored
      .sort((a, b) => a.seconds - b.seconds)
      .map((entry) => entry.driver);
  }

  async startSearch(orderId: string): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (!order) {
      this.logger.error(`Order ${orderId} not found for matching`);
      return;
    }

    // Get pickup coordinates from PostGIS
    const locationResult = await this.orderRepository.query(
      `SELECT ST_X(pickup_location::geometry) as lng, ST_Y(pickup_location::geometry) as lat FROM orders WHERE id = $1`,
      [orderId],
    );

    if (!locationResult.length) {
      this.logger.error(`No location data for order ${orderId}`);
      return;
    }

    const { lat, lng } = locationResult[0] as { lat: number; lng: number };

    // Gate matching by the tariff's tier — e.g. a Biznes ride shouldn't be
    // offered to a driver only approved up to Start. Cargo tariffs/drivers
    // both default tier/approvedTariffTier to 1, so this is a no-op for them.
    //
    // ⚠️ Read BEFORE the status flip: if this throws the order stays CREATED
    // (and the reaper closes it), instead of SEARCHING with no queue.
    const tariff = await this.tariffsService.findById(order.tariffId);

    // Haydovchi imkoniyatlari bo'yicha filtr. Ilgari BUNDAY FILTR YO'Q EDI:
    // yuk buyurtmasi 3 km ichidagi har qanday onlayn haydovchiga — sedan
    // egasiga ham — tarqalar, ovqat/market yetkazishi esa hech kimga
    // yo'naltirilmagan holda shu ro'yxatga tushardi.
    //
    // Talab qilinadigan transport turi TARIFDAN olinadi (`Tariff.vehicleType`),
    // buyurtmaning erkin shakldagi `details` idan emas: narx aynan tarifdan
    // hisoblangan, ya'ni haydovchi ham shu tarif talabiga mos kelishi kerak.
    const capabilities: DriverCapabilityFilter = {
      // Eski buyurtmalarda ustun default'i 'taxi', lekin zaxira baribir
      // yozilgan: `undefined` filtrga tushsa, u "talab yo'q" deb o'qilardi.
      serviceType: order.serviceType ?? ServiceType.TAXI,
      vehicleType: tariff.vehicleType ?? null,
      tripOptions: order.options ?? [],
    };

    // ⚠️ SHARTLI: faqat CREATED dan. Yo'lovchi yaratgan zahoti bekor qilsa
    // (CREATED → CANCELLED), bu yozuv uni SEARCHING ga "tiriltirmaydi".
    const flipped = await this.orderRepository.update(
      { id: orderId, status: OrderStatus.CREATED },
      { status: OrderStatus.SEARCHING },
    );
    if (flipped?.affected === 0) {
      this.logger.warn(`Order ${orderId} is no longer CREATED — search not started`);
      return;
    }

    const queue: DriverQueue = {
      orderId,
      drivers: [],
      currentIndex: 0,
      passengerId: order.passengerId,
      offerExpiresAt: 0,
      noDriverDeadline: Date.now() + SEARCH_DEADLINE_MS,
      exhaustedDriverIds: [],
      pickupLat: lat,
      pickupLng: lng,
      tariffTier: tariff.tier,
      serviceType: capabilities.serviceType ?? ServiceType.TAXI,
      vehicleType: capabilities.vehicleType ?? null,
      tripOptions: [...(capabilities.tripOptions ?? [])],
      payVendor: payVendorOf(order),
      radiusStepIndex: 0,
    };

    // ⚠️ Navbat (deadline bilan) SEARCHING bilan DARHOL saqlanadi — bundan
    // keyin nima yiqilmasin (koordinata so'rovi, Redis, push), sweep bu
    // buyurtmaga egalik qiladi: qayta qidiradi yoki muddatida yopadi. Ilgari
    // navbat faqat birinchi taklif oxirida yozilardi va oradagi har qanday
    // xato buyurtmani SEARCHING da abadiy qoldirardi.
    await this.saveQueue(queue);

    this.realtimeGateway.emitToUser(order.passengerId, 'order:searching', {
      orderId,
      message: 'Searching for nearby drivers...',
    });

    try {
      // Birinchi qidiruv ham sweep bilan bir xil yo'ldan, bir xil qulf
      // ostida o'tadi: oradagi tik ikkinchi taklif yubora olmaydi.
      await this.withOrderLock(orderId, () => this.sweepOrder(orderId), ORDER_LOCK_MAX_WAIT_MS);
    } catch (err) {
      this.logger.error(
        `Initial offer failed for order ${orderId}; the sweep will retry: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Is [orderId] currently offered to [driverId]? True while the driver's
   * offer hold points at this order — i.e. during the 15 s offer and for
   * OFFER_ACCEPT_GRACE_SECONDS after it timed out. Used by acceptOrder so a
   * driver can't accept a ride the dispatcher never offered them.
   */
  async isOfferedTo(driverId: string, orderId: string): Promise<boolean> {
    return (await this.redis.get(this.driverHoldKey(driverId))) === orderId;
  }

  async driverAccepted(driverId: string, orderId: string): Promise<void> {
    // Vaqti tugagan haydovchi grace ichida qabul qilgan bo'lsa, navbat
    // allaqachon KEYINGI haydovchiga taklif yuborgan — uning ekranidan
    // taklif olib tashlanadi.
    await this.cancelSearch(orderId, 'Accepted by another driver', driverId);
    await this.releaseDriverHold(driverId, orderId);
    this.logger.log(`Driver ${driverId} accepted order ${orderId}`);
  }

  /**
   * Ends the search for an order that left SEARCHING by another path
   * (passenger/dispatcher cancel, manual assignment, accept): the driver
   * currently looking at the offer gets `order:cancelled` and their hold is
   * released, and the queue is deleted so the sweep stops touching it.
   * [exceptDriverId] is released silently (e.g. the driver who was just
   * assigned the order must not see it "cancelled").
   */
  async cancelSearch(orderId: string, reason?: string, exceptDriverId?: string): Promise<void> {
    const run = async () => {
      const queue = await this.getQueue(orderId);
      await this.withdrawOffer(queue, reason ?? null, exceptDriverId);
      await this.deleteQueue(orderId);
    };
    // Qulfni kutadi, lekin ololmasa ham baribir bajaradi: bekor qilish
    // hech qachon "qulf band" sababli yo'qolmasligi kerak.
    const ran = await this.withOrderLock(orderId, async () => {
      await run();
      return true;
    }, ORDER_LOCK_MAX_WAIT_MS);
    if (!ran) await run();
  }

  async driverDeclined(driverId: string, orderId: string): Promise<void> {
    const ran = await this.withOrderLock(
      orderId,
      async () => {
        await this.advanceQueue(driverId, orderId, true);
        return true;
      },
      ORDER_LOCK_MAX_WAIT_MS,
    );
    if (!ran) {
      // Qulf 2 s ichida bo'shamadi — taklif o'z vaqtida tugaydi va sweep
      // navbatni suradi; band belgisi baribir darhol olinadi.
      this.logger.warn(`Decline by ${driverId} for ${orderId} deferred to the sweep (lock busy)`);
      await this.releaseDriverHold(driverId, orderId);
    }
  }

  async offerTimeout(driverId: string, orderId: string): Promise<void> {
    this.logger.log(`Offer to driver ${driverId} for order ${orderId} timed out`);
    // Band belgisi ATAYLAB qoldiriladi (OFFER_ACCEPT_GRACE_SECONDS): u o'zi
    // tugaydi, shu orada kech kelgan "qabul" hali o'tadi.
    await this.advanceQueue(driverId, orderId, false);
  }

  /** Moves the queue past [driverId]'s offer. Caller holds the order lock. */
  private async advanceQueue(driverId: string, orderId: string, releaseHold: boolean): Promise<void> {
    const queue = await this.getQueue(orderId);
    if (!queue) return;

    const currentDriver = queue.drivers[queue.currentIndex];
    // Ignore a stale decline/timeout for a driver who isn't the current
    // offer — the socket-driven decline and the sweep's timeout can race
    // for the same driver; only the first should advance the queue.
    if (!currentDriver || currentDriver.userId !== driverId) return;

    this.logger.log(`Driver ${driverId} passed on order ${orderId}`);
    if (releaseHold) {
      await this.releaseDriverHold(driverId, orderId);
    }

    const advanced: DriverQueue = {
      ...queue,
      currentIndex: queue.currentIndex + 1,
      exhaustedDriverIds: queue.exhaustedDriverIds.includes(driverId)
        ? queue.exhaustedDriverIds
        : [...queue.exhaustedDriverIds, driverId],
    };

    if (advanced.currentIndex >= advanced.drivers.length) {
      // Everyone in this batch passed. Don't give up yet — persist the
      // exhausted list and let the sweep look for drivers who have since come
      // online (widening the radius), right up to the overall deadline.
      await this.saveQueue({ ...advanced, offerExpiresAt: 0 });
      return;
    }

    await this.offerToDriver(orderId, advanced.drivers[advanced.currentIndex], advanced);
  }

  /// Runs every 2s, checking Redis-persisted queues for expired per-driver
  /// offers or an expired overall search deadline. Replaces the old
  /// setTimeout/SchedulerRegistry timers — because the state it reads lives
  /// in Redis rather than process memory, a restart between sweep ticks
  /// loses nothing.
  @Interval(2000)
  async sweepExpiredOffers(): Promise<void> {
    if (this.sweepRunning) return;
    this.sweepRunning = true;
    try {
      const orderIds = await this.redis.smembers(MatchingService.ACTIVE_SET_KEY);

      for (const orderId of orderIds) {
        try {
          // wait = 0: boshqa jarayon shu buyurtma ustida ishlayapti — keyingi
          // tikda qaraladi.
          await this.withOrderLock(orderId, () => this.sweepOrder(orderId));
        } catch (err) {
          this.logger.error(
            `Sweep failed for order ${orderId}: ${(err as Error).message}`,
          );
        }
      }
    } finally {
      this.sweepRunning = false;
    }
  }

  /**
   * Reaper for searches the sweep can't see: an order still CREATED/SEARCHING
   * well past the search deadline with no `matching:queue:*` record (startSearch
   * failed before persisting, a Redis flush, a crash between writes). It gets
   * the same "no drivers" ending as a normal expired search — so it lands on
   * the dispatcher's exceptions list and the passenger is told.
   */
  @Interval(ORPHAN_REAP_INTERVAL_MS)
  async reapOrphanedSearches(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - SEARCH_DEADLINE_MS - ORPHAN_REAP_MARGIN_MS);
      const statuses = [OrderStatus.CREATED, OrderStatus.SEARCHING];
      const stale = await this.orderRepository.find({
        where: { status: In(statuses), updatedAt: LessThan(cutoff) },
        select: ['id', 'passengerId'],
        take: ORPHAN_REAP_BATCH,
      });

      for (const order of stale) {
        if (await this.redis.exists(this.queueKey(order.id))) continue;
        this.logger.warn(`Reaping orphaned search for order ${order.id} (no queue)`);
        await this.withOrderLock(order.id, () =>
          this.handleNoDriversFound(order.id, order.passengerId, null, In(statuses)),
        );
      }
    } catch (err) {
      this.logger.error(`Orphaned-search reaper failed: ${(err as Error).message}`);
    }
  }

  private async sweepOrder(orderId: string): Promise<void> {
    const queue = await this.getQueue(orderId);
    if (!queue) {
      // Stale membership (queue already deleted/expired) — clean it up.
      await this.redis.srem(MatchingService.ACTIVE_SET_KEY, orderId);
      return;
    }

    const now = Date.now();

    if (now >= queue.noDriverDeadline) {
      await this.handleNoDriversFound(orderId, queue.passengerId, queue);
      return;
    }

    const hasActiveOffer =
      queue.drivers.length > 0 && queue.currentIndex < queue.drivers.length;

    if (hasActiveOffer) {
      if (now >= queue.offerExpiresAt) {
        const currentDriver = queue.drivers[queue.currentIndex];
        await this.offerTimeout(currentDriver.userId, orderId);
      }
      return;
    }

    // No offer outstanding and the deadline hasn't passed: look again. This is
    // what makes "will retry" true — a driver who came online after the
    // initial search, or after everyone in the first batch declined, gets
    // offered the ride instead of the passenger waiting out the full window
    // for a cancellation.
    await this.researchDrivers(queue);
  }

  /**
   * Searches for drivers who haven't refused this order yet, starting at the
   * queue's current radius step and widening (2 → 3 → 5 km) only while a step
   * yields nobody. Offers the ride to the best of the first non-empty step.
   */
  private async researchDrivers(queue: DriverQueue): Promise<void> {
    const lastStep = SEARCH_RADIUS_STEPS_KM.length - 1;
    const startStep = Math.min(queue.radiusStepIndex ?? 0, lastStep);

    for (let step = startStep; step <= lastStep; step += 1) {
      const fresh = await this.findFreshCandidates(queue, SEARCH_RADIUS_STEPS_KM[step]);
      if (fresh.length === 0) continue;

      this.logger.log(
        `Found ${fresh.length} driver(s) within ${SEARCH_RADIUS_STEPS_KM[step]} km for order ${queue.orderId}`,
      );

      // Take the drivers who can actually reach the pickup soonest.
      const nextBatch = (
        await this.rankByEta(fresh, queue.pickupLat, queue.pickupLng)
      ).slice(0, BATCH_SIZE);

      await this.offerToDriver(queue.orderId, nextBatch[0], {
        ...queue,
        drivers: nextBatch,
        currentIndex: 0,
        radiusStepIndex: step,
      });
      return;
    }

    // Persist an empty/exhausted queue; the sweep re-searches every tick
    // (at the widest radius) until the deadline, so a driver who comes online
    // seconds later still gets the ride.
    if (startStep !== lastStep || queue.radiusStepIndex === undefined) {
      await this.saveQueue({ ...queue, radiusStepIndex: lastStep });
    }
  }

  /** Nearby drivers who are eligible, haven't refused, and aren't holding another order's offer. */
  private async findFreshCandidates(queue: DriverQueue, radiusKm: number): Promise<NearbyDriver[]> {
    const candidates = await this.driversService.getNearbyDrivers(
      queue.pickupLat,
      queue.pickupLng,
      radiusKm,
      queue.tariffTier,
      {
        // ⚠️ `?? TAXI` — deploy paytida Redis'da qolgan ESKI navbatlar uchun.
        // Ular bu maydonlarsiz yozilgan; `undefined` ni to'g'ridan-to'g'ri
        // uzatsak, o'sha buyurtmalar filtrga tushmay hammaga tarqalardi.
        serviceType: queue.serviceType ?? ServiceType.TAXI,
        vehicleType: queue.vehicleType ?? null,
        tripOptions: queue.tripOptions ?? [],
      },
    );

    const notRefused = candidates.filter(
      (driver) => !queue.exhaustedDriverIds.includes(driver.userId),
    );

    // Boshqa buyurtma taklifini ko'rib turgan haydovchi bu radiusda "bor"
    // hisoblanmaydi — aks holda u bo'shaguncha radius kengaymasdi. Ular
    // exhaustedDriverIds ga QO'SHILMAYDI: bo'shashi bilan keyingi qidiruvda
    // yana nomzod bo'ladi.
    const holds = await Promise.all(
      notRefused.map((driver) => this.redis.get(this.driverHoldKey(driver.userId))),
    );
    const free = notRefused.filter(
      (_driver, i) => holds[i] === null || holds[i] === queue.orderId,
    );

    return this.filterByWallet(queue.payVendor ?? 0, free);
  }

  private async offerToDriver(
    orderId: string,
    driver: NearbyDriver,
    queue: DriverQueue,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (!order) return;

    // Check order is still in SEARCHING state
    if (order.status !== OrderStatus.SEARCHING) {
      await this.deleteQueue(orderId);
      return;
    }

    // One live offer per driver. Without this two orders searching at once
    // could both pick the same driver: the app shows only the latest offer,
    // so the first order's passenger waited out a 15 s offer nobody could see.
    if (!(await this.holdDriverForOffer(driver.userId, orderId))) {
      await this.offerToNextFreeDriver(orderId, queue);
      return;
    }

    // ⚠️ Navbat (joriy indeks + muddat) socket/push'dan OLDIN saqlanadi.
    // Ilgari u push KUTILGANDAN keyin yozilardi: shu oraliqda kelgan rad
    // etish navbatda hali eski haydovchini ko'rib "eskirgan" deb tashlanardi
    // va yo'lovchi 15 soniyani bekorga kutardi. Bundan keyingi har qanday
    // xatoda ham taklif o'z vaqtida tugaydi va sweep navbatni suradi.
    const offered: DriverQueue = { ...queue, offerExpiresAt: Date.now() + OFFER_TIMEOUT_MS };
    await this.saveQueue(offered);

    const driverUser = await this.usersService.findById(driver.userId);

    if (!driverUser) {
      this.logger.warn(`Offered driver ${driver.userId} not found; offer will time out`);
      return;
    }

    // Pickup/dropoff are opaque PostGIS geometry columns on the entity — the
    // mobile client's shared Order model expects plain {address, lat, lng},
    // same shape OrdersService.attachDisplayFields attaches on REST responses.
    const coordsResult = await this.orderRepository.query(
      `SELECT ST_Y(pickup_location::geometry) as pickup_lat,
              ST_X(pickup_location::geometry) as pickup_lng,
              ST_Y(dropoff_location::geometry) as dropoff_lat,
              ST_X(dropoff_location::geometry) as dropoff_lng
       FROM orders WHERE id = $1`,
      [orderId],
    );
    const coords = (coordsResult as Array<{
      pickup_lat: string;
      pickup_lng: string;
      dropoff_lat: string;
      dropoff_lng: string;
    }>)[0];

    // Emit to driver via WebSocket, shaped to match the mobile Order model
    // (Order.fromJson) directly rather than a bespoke offer-only shape.
    this.realtimeGateway.emitToUser(driver.userId, 'new_order_offer', {
      id: order.id,
      passengerId: order.passengerId,
      pickup: {
        address: order.pickupAddress,
        lat: parseFloat(coords.pickup_lat),
        lng: parseFloat(coords.pickup_lng),
      },
      dropoff: {
        address: order.dropoffAddress,
        lat: parseFloat(coords.dropoff_lat),
        lng: parseFloat(coords.dropoff_lng),
      },
      status: order.status,
      estimatedPrice: order.estimatedPrice,
      // Taksometr: manzil yo'q (`dropoff` = olish nuqtasi), narx — "kamida".
      // Busiz ilova "A → A" va eng kam narxni yakuniy summa deb ko'rsatardi.
      isMetered: order.isMetered,
      isFixedPrice: order.isFixedPrice,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      // ⚠️ `distanceKm` — haydovchidan OLISH NUQTASIGACHA (eski nom).
      distanceKm: driver.distanceKm,
      // Safarning o'zi: buyurtmada qotirilgan baholash. Haydovchi taklifni
      // narxga qarab emas, "qancha yuraman" ga qarab ham tortadi.
      // Taksometrda baholash yo'q — `null`.
      tripDistanceKm: order.fareBreakdown?.distanceKm ?? null,
      tripDurationMin: order.fareBreakdown?.durationMin ?? null,
      timeoutSeconds: OFFER_TIMEOUT_MS / 1000,
      // ⚠️ XIZMAT TURI TAKLIF PAKETIDA BO'LISHI SHART.
      //
      // Ilova taklif kartochkasini AYNAN shu maydondan quradi
      // (`DriverServiceWording.of(order.serviceType)`), va maydon kelmasa
      // u ataylab `taxi` ga qaytadi. Ya'ni maydonsiz paket xato bermaydi —
      // JIMGINA yolg'on ko'rsatadi: haydovchi ovqat yetkazish taklifida
      // «Taksi» yorlig'ini, «Olish joyi» va «Yo'lovchigacha» matnlarini
      // ko'rardi, holbuki olish nuqtasi restoran. U qabul qilgandan
      // KEYINGINA, REST javobi kelganda matnlar to'g'rilanardi — ya'ni
      // haydovchi qarorni noto'g'ri ma'lumot asosida qabul qilardi.
      //
      // Zaxira `TAXI`: ustun qo'shilishidan oldingi buyurtmalarda qiymat
      // bo'sh bo'lishi mumkin, ular esa aynan taksi buyurtmalari.
      serviceType: order.serviceType ?? ServiceType.TAXI,
      // Food/market: vendor, item count and the cash to collect at the door
      // (see deliveryRideDetails). The courier decides whether to take the
      // offer on these — a 150 000 so'm cash handover is not a taxi ride.
      details: order.details ?? null,
      // Haydovchi taklifda "bola o'rindig'i kerak" ni ko'rishi shart.
      options: order.options ?? [],
    });

    // Push KUTILMAYDI: sekin/osilgan FCM taklif oqimini (va shu paytdagi
    // rad etishni) to'xtatib turmasligi kerak.
    this.notificationsService.notifyNewOrderOffer(driverUser, order).catch((err: unknown) => {
      this.logger.warn(
        `Offer push to driver ${driver.userId} failed: ${(err as Error).message}`,
      );
    });

    this.logger.log(
      `Order offer sent to driver ${driver.userId} (${driver.distanceKm.toFixed(2)}km away)`,
    );
  }

  /**
   * Ends a search with "no drivers". The cancel is CONDITIONAL (only from
   * [expectedStatus], SEARCHING by default): a driver who accepted in the
   * last moment must keep the ride — this used to overwrite an accept.
   */
  private async handleNoDriversFound(
    orderId: string,
    passengerId: string,
    queue: DriverQueue | null,
    expectedStatus: OrderStatus | FindOperator<OrderStatus> = OrderStatus.SEARCHING,
  ): Promise<void> {
    const result = await this.orderRepository.update(
      { id: orderId, status: expectedStatus },
      { status: OrderStatus.CANCELLED, cancelReason: NO_DRIVERS_CANCEL_REASON },
    );

    if (result?.affected === 0) {
      // Already accepted / cancelled elsewhere — nothing to announce.
      await this.deleteQueue(orderId);
      return;
    }

    // The driver still looking at the offer must not be left with a dead one.
    await this.withdrawOffer(queue, NO_DRIVERS_CANCEL_REASON);
    await this.deleteQueue(orderId);

    // Notify passenger
    this.realtimeGateway.emitToUser(passengerId, 'no_drivers_found', {
      orderId,
      message: 'No drivers available in your area. Please try again later.',
    });

    this.logger.log(`Order ${orderId} cancelled — no drivers found`);

    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) return;

    // Socket faqat ilova ochiq bo'lsa yetadi; 3 daqiqa kutib ilovani fonga
    // tushirgan yo'lovchi natijani push orqali bilishi kerak.
    await this.pushNoDriversToPassenger(passengerId, order);

    // Food/market: tell the vendor nobody took the delivery so they can
    // re-dispatch, instead of the order sitting at "ready" forever.
    await this.deliveryEvents?.publish(order, 'cancelled');
  }

  private async pushNoDriversToPassenger(passengerId: string, order: Order): Promise<void> {
    try {
      const passenger = await this.usersService.findById(passengerId);
      if (passenger) {
        await this.notificationsService.notifyOrderCancelled(passenger, order, NO_DRIVERS_CANCEL_REASON);
      }
    } catch (err) {
      this.logger.warn(`No-drivers push for order ${order.id} failed: ${(err as Error).message}`);
    }
  }

  /**
   * Takes the current offer off the offered driver's screen (`order:cancelled`,
   * the event the driver app already handles) and frees their hold. Only when
   * the hold still points at this order — a driver whose hold has moved on
   * may already be on another order, and the app's handler would mark THAT
   * one cancelled.
   */
  private async withdrawOffer(
    queue: DriverQueue | null,
    reason: string | null,
    exceptDriverId?: string,
  ): Promise<void> {
    const current = queue?.drivers[queue.currentIndex];
    if (!queue || !current) return;
    if (!(await this.releaseDriverHold(current.userId, queue.orderId))) return;
    if (current.userId === exceptDriverId) return;

    this.realtimeGateway.emitToUser(current.userId, 'order:cancelled', {
      orderId: queue.orderId,
      reason,
    });
  }

  /**
   * Skips past drivers who are holding another order's offer. They are NOT
   * added to exhaustedDriverIds — they never saw this order — so once their
   * hold clears the sweep's re-search offers them this ride.
   */
  private async offerToNextFreeDriver(orderId: string, queue: DriverQueue): Promise<void> {
    const nextIndex = queue.currentIndex + 1;
    if (nextIndex < queue.drivers.length) {
      await this.offerToDriver(orderId, queue.drivers[nextIndex], { ...queue, currentIndex: nextIndex });
      return;
    }
    // Nobody in this batch is free: no outstanding offer, so the next sweep
    // tick re-searches (until the overall deadline).
    await this.saveQueue({ ...queue, currentIndex: queue.drivers.length, offerExpiresAt: 0 });
  }

  private driverHoldKey(driverUserId: string): string {
    return `matching:offer:${driverUserId}`;
  }

  /** Atomically reserves the driver for this order's offer; true if this order holds them. */
  private async holdDriverForOffer(driverUserId: string, orderId: string): Promise<boolean> {
    const key = this.driverHoldKey(driverUserId);
    // A little longer than the offer itself, so the hold never lapses while
    // the offer is still on the driver's screen. A crash leaves it to expire.
    // The extra seconds are also the late-accept grace (see isOfferedTo).
    const ttlSeconds = Math.ceil(OFFER_TIMEOUT_MS / 1000) + OFFER_ACCEPT_GRACE_SECONDS;
    if (await this.redis.set(key, orderId, 'EX', ttlSeconds, 'NX')) return true;
    // Re-offering the same order (e.g. after a restart) keeps its own hold.
    return (await this.redis.get(key)) === orderId;
  }

  /** Frees the driver — but only from THIS order's hold, never another's. */
  private async releaseDriverHold(driverUserId: string, orderId: string): Promise<boolean> {
    const key = this.driverHoldKey(driverUserId);
    if ((await this.redis.get(key)) !== orderId) return false;
    await this.redis.del(key);
    return true;
  }

  /**
   * Runs [fn] holding the per-order lock. Returns undefined (without running
   * [fn]) if the lock is still taken after [maxWaitMs]. Attempt-counted, not
   * clock-based, so a frozen clock can't spin it forever.
   */
  private async withOrderLock<T>(
    orderId: string,
    fn: () => Promise<T>,
    maxWaitMs = 0,
  ): Promise<T | undefined> {
    const key = `matching:lock:${orderId}`;
    const token = randomUUID();
    const attempts = 1 + Math.floor(maxWaitMs / ORDER_LOCK_RETRY_MS);

    let acquired = false;
    for (let i = 0; i < attempts && !acquired; i += 1) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, ORDER_LOCK_RETRY_MS));
      acquired = Boolean(await this.redis.set(key, token, 'PX', ORDER_LOCK_TTL_MS, 'NX'));
    }
    if (!acquired) return undefined;

    try {
      return await fn();
    } finally {
      // GET+DEL emas: oradagi lahzada TTL tugasa, boshqa egasining qulfi
      // o'chib ketardi.
      await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
    }
  }

  private queueKey(orderId: string): string {
    return `matching:queue:${orderId}`;
  }

  private async saveQueue(queue: DriverQueue): Promise<void> {
    await this.redis.set(
      this.queueKey(queue.orderId),
      JSON.stringify(queue),
      'EX',
      MatchingService.QUEUE_TTL_SECONDS,
    );
    await this.redis.sadd(MatchingService.ACTIVE_SET_KEY, queue.orderId);
  }

  private async getQueue(orderId: string): Promise<DriverQueue | null> {
    const raw = await this.redis.get(this.queueKey(orderId));
    return raw ? (JSON.parse(raw) as DriverQueue) : null;
  }

  private async deleteQueue(orderId: string): Promise<void> {
    await this.redis.del(this.queueKey(orderId));
    await this.redis.srem(MatchingService.ACTIVE_SET_KEY, orderId);
  }
}
