import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import Redis from 'ioredis';
import { Driver } from '../../database/entities/driver.entity';
import { computeWalletBalance } from '../payments/wallet-balance.util';
import { UserRole, UserStatus } from '../../database/entities/user.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { PaymentMethod } from '../../database/entities/order.entity';
import { REDIS_CLIENT } from '../../config/redis.config';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { UsersService } from '../users/users.service';
import { RoadSpeedService } from './road-speed.service';
import { DriverVerificationService } from './driver-verification.service';
import {
  DEFAULT_DRIVER_SERVICE_TYPES,
  DriverCapabilityFilter,
  driverMatchesCapabilities,
} from './driver-capabilities';

export interface NearbyDriver {
  driverId: string;
  userId: string;
  distanceKm: number;
  lat: number;
  lng: number;
}

export interface OnlineDriverSummary {
  id: string;
  name: string;
  phone: string;
  carModel: string;
  carNumber: string;
  rating: number;
  status: 'online' | 'busy';
  currentOrderId: string | null;
  lastSeen: Date;
  location?: { lat: number; lng: number };
}

interface OnlineDriverRow {
  id: string;
  user_id: string;
  car_model: string | null;
  car_number: string | null;
  rating: string;
  updated_at: Date;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  current_order_id: string | null;
}

const DRIVERS_ONLINE_KEY = 'drivers:online';

/**
 * Haydovchining JONLI MAVJUDLIGI — `is_online` dan ALOHIDA tushuncha.
 *
 * ⚠️ NEGA ikkitasi kerak. Ilgari ular bitta narsa deb qaralardi: socket
 * uzilishi haydovchini darhol oflayn qilib, Redis geo-to'plamidan
 * chiqarardi. Lekin socket telefon ekrani o'chgani, ilova fonga tushgani,
 * WiFi'dan LTE'ga o'tgani yoki server qayta deploy bo'lgani uchun ham
 * uziladi — bularning HECH BIRI haydovchining ishlamoqchi emasligini
 * bildirmaydi. Qayta ulanish esa holatni tiklamasdi, joylashuv paketi ham
 * qutqara olmasdi (u `is_online` ga bog'liq edi), ya'ni haydovchi
 * tugmani QO'LDA o'chirib-yoqmaguncha matching uchun ko'rinmas bo'lib
 * qolardi — ilovasi esa "onlayn" deb ko'rsatib turardi.
 *
 * Endi:
 *   `is_online`  = haydovchining NIYATI. Uni faqat haydovchi (yoki manfiy
 *                  balans kabi qoida) o'zgartiradi.
 *   presence key = HOZIR yetib borish mumkinmi. O'zi eskiradi, shuning
 *                  uchun telefoni o'chgan haydovchi taklif olishdan
 *                  avtomatik to'xtaydi.
 *
 * Buyurtma faqat IKKALASI ham rost bo'lganda taklif qilinadi.
 */
const DRIVER_PRESENCE_PREFIX = 'driver:presence:';

/**
 * Mavjudlik kalitining umri.
 *
 * ⚠️ Yangilash manbai IKKITA va TTL ikkalasidan ham uzoq bo'lishi shart,
 * aks holda tirik haydovchi vaqti-vaqti bilan tushib qolardi:
 *   1. Har joylashuv paketi (`updateLocation`).
 *   2. Gateway'ning davriy yurak urishi — ulangan socketlar uchun.
 *
 * ⚠️ NEGA yolg'iz joylashuv paketi YETMAYDI: mobil tomon joylashuvni
 * masofa filtri (10 m) bilan oladi, ya'ni buyurtma kutib QIMIRLAMAY
 * turgan haydovchi umuman paket yubormaydi. Faqat paketga tayansak,
 * aynan bo'sh turgan — ya'ni buyurtmaga eng tayyor — haydovchi tushib
 * qolardi.
 */
const DRIVER_PRESENCE_TTL_SECONDS = 150;

// Chaqiruvchiga qaytariladigan eng ko'p nomzod soni.
const CANDIDATE_LIMIT = 10;
// Imkoniyat filtri yoqilganda Redis'dan olinadigan kengaytirilgan oyna —
// filtrdan keyin ham CANDIDATE_LIMIT ta nomzod qolishi uchun zaxira.
const WIDE_GEO_FETCH_LIMIT = 50;

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly usersService: UsersService,
    private readonly roadSpeedService: RoadSpeedService,
    // Davriy tekshiruv darvozabon sifatida: `setOnlineStatus` dan boshqa
    // joyda ishlatilmaydi. Bog'liqlik bir tomonlama — bu servis
    // `DriversService` ni olmaydi, shuning uchun `forwardRef` kerak emas.
    private readonly verificationService: DriverVerificationService,
  ) {}

  async createProfile(userId: string, dto: CreateDriverDto): Promise<Driver> {
    const existing = await this.driverRepository.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException('Driver profile already exists for this user');
    }

    // Staff/vendor accounts are single-purpose (see UsersService.createWithRole)
    // and can't also apply as a driver. Passengers (the common case) and
    // existing drivers (re-applying after a manual role fix) are allowed.
    const user = await this.usersService.findByIdOrThrow(userId);
    const blockedRoles = [UserRole.MANAGER, UserRole.ADMIN, UserRole.MARKET, UserRole.RESTAURANT];
    if (blockedRoles.includes(user.role)) {
      throw new BadRequestException('This account type cannot apply to become a driver');
    }

    const driver = await this.driverRepository.save({
      userId,
      carModel: dto.carModel ?? null,
      carNumber: dto.carNumber ?? null,
      licensePlate: dto.licensePlate ?? null,
      carYear: dto.carYear ?? null,
      vehicleType: dto.vehicleType ?? null,
      // Yangi profil DOIM `['taxi']` dan boshlanadi va ariza beruvchi buni
      // tanlay olmaydi (`CreateDriverDto` dagi izohga qarang): xizmat turini
      // yoqish tasdiqlangan material talab qiladi, material esa faqat mavjud
      // profilga yuklanadi. Keyingi o'zgarish `PATCH /drivers/me/services`
      // orqali, tekshiruv darvozasidan o'tib bo'ladi.
      serviceTypes: [...DEFAULT_DRIVER_SERVICE_TYPES],
      rating: 5.0,
      isOnline: false,
      currentLocation: null,
      // New drivers start on the lowest tariff tier (Start) until a manager
      // reviews the car and raises it — see setApprovedTariffTier.
      approvedTariffTier: 1,
    });

    // Self-service driver application: promote the account to the driver role
    // and put it in PENDING status until an admin/manager approves it.
    if (user.role !== UserRole.DRIVER) {
      await this.usersService.updateRole(userId, UserRole.DRIVER);
    }
    await this.usersService.updateStatus(userId, UserStatus.PENDING);

    return driver;
  }

  async findByUserId(userId: string): Promise<Driver | null> {
    return this.driverRepository.findOne({ where: { userId } });
  }

  async findByUserIdOrThrow(userId: string): Promise<Driver> {
    const driver = await this.findByUserId(userId);
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    return driver;
  }

  async findById(id: string): Promise<Driver | null> {
    const driver = await this.driverRepository.findOne({ where: { id }, relations: ['user'] });
    if (!driver) return null;
    const [enriched] = await this.attachDisplayFields([driver]);
    return enriched;
  }

  async findByIdOrThrow(id: string): Promise<Driver> {
    const driver = await this.findById(id);
    if (!driver) throw new NotFoundException(`Driver ${id} not found`);
    return driver;
  }

  // The `user` relation only carries phone/firstName/lastName — the web panels
  // expect those flattened onto the driver plus a completed-trip count, which
  // has no dedicated column, so we compute both here rather than in every caller.
  private async attachDisplayFields(drivers: Driver[]): Promise<Driver[]> {
    if (drivers.length === 0) return drivers;

    const userIds = drivers.map((d) => d.userId);
    const rows: Array<{ driver_id: string; cnt: string }> = await this.driverRepository.query(
      `SELECT driver_id, COUNT(*)::int as cnt FROM orders
       WHERE driver_id = ANY($1) AND status = 'completed'
       GROUP BY driver_id`,
      [userIds],
    );
    const tripCountByUserId = new Map(rows.map((r) => [r.driver_id, Number(r.cnt)]));

    const walletByUserId = await this.walletBalancesFor(userIds);

    for (const driver of drivers) {
      const flat = driver as unknown as Record<string, unknown>;
      if (driver.user) {
        flat.firstName = driver.user.firstName;
        flat.lastName = driver.user.lastName;
        flat.phone = driver.user.phone;
        flat.status = driver.user.status;
        flat.blockReason = driver.user.blockReason;
      }
      flat.totalTrips = tripCountByUserId.get(driver.userId) ?? 0;
      flat.walletBalance = walletByUserId.get(driver.userId) ?? 0;
    }

    return drivers;
  }

  /**
   * Bir nechta haydovchining daftar qoldig'i — BITTA guruhlangan so'rovda.
   *
   * ⚠️ NEGA `drivers.balance` ustuni yetmaydi. Ustun yechib olingan pulni
   * hisobga olmaydi (yechish faqat daftarni debetlaydi), ya'ni birinchi
   * yechishdan keyin u haqiqiy qoldiqdan ajralib ketadi. Admin panelida
   * o'sha ustunni ko'rsatish operator bilan haydovchiga IKKI XIL raqam
   * beradi — pul masalasida bu eng yomon holat.
   *
   * ⚠️ NEGA halqa ichida `computeWalletBalance` emas: 50 ta haydovchili
   * sahifa 50 ta alohida agregat so'rov bo'lardi. Formula
   * `wallet-balance.util.ts` dagi bilan AYNAN bir xil bo'lishi shart —
   * ikki joyda ikki xil hisob ikki xil javob beradi.
   */
  private async walletBalancesFor(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();

    const rows: Array<{ user_id: string; balance: string }> =
      await this.driverRepository.query(
        `SELECT user_id,
                COALESCE(SUM(CASE WHEN type = 'credit' AND status = 'completed'
                                  THEN amount ELSE 0 END), 0)
              - COALESCE(SUM(CASE WHEN type = 'debit' AND status = 'completed'
                                  THEN amount ELSE 0 END), 0) AS balance
           FROM transactions
          WHERE user_id = ANY($1)
          GROUP BY user_id`,
        [userIds],
      );

    return new Map(rows.map((r) => [r.user_id, parseFloat(r.balance)]));
  }

  async getProfile(userId: string): Promise<Driver> {
    return this.findByUserIdOrThrow(userId);
  }

  async updateProfile(userId: string, dto: UpdateDriverDto): Promise<Driver> {
    const driver = await this.findByUserIdOrThrow(userId);

    const updated = {
      ...driver,
      ...(dto.carModel !== undefined && { carModel: dto.carModel }),
      ...(dto.carNumber !== undefined && { carNumber: dto.carNumber }),
      ...(dto.licensePlate !== undefined && { licensePlate: dto.licensePlate }),
      ...(dto.carYear !== undefined && { carYear: dto.carYear }),
      ...(dto.vehicleType !== undefined && { vehicleType: dto.vehicleType }),
      // ⚠️ `serviceTypes` bu yerda O'ZGARMAYDI — u faqat
      // `DriverServicesService` orqali, tekshiruv darvozasidan o'tib
      // yangilanadi. Aks holda shu endpoint darvozaning yonidagi ochiq
      // eshik bo'lib qolardi.
    };

    return this.driverRepository.save(updated);
  }

  // Manager/admin action: sets the highest Tariff.tier this driver may be
  // matched against, after reviewing their car (year, photos, condition) —
  // there's no automatic year-based approval, matching Yandex Pro's
  // "check with your partner manager" model rather than a hard cutoff.
  async setApprovedTariffTier(driverId: string, tier: number): Promise<Driver> {
    const driver = await this.findById(driverId);
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    await this.driverRepository.update(driverId, { approvedTariffTier: tier });
    return { ...driver, approvedTariffTier: tier };
  }

  async updateLocation(userId: string, lat: number, lng: number): Promise<void> {
    const driver = await this.findByUserIdOrThrow(userId);

    // Update PostGIS geometry
    await this.driverRepository.query(
      `UPDATE drivers SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE user_id = $3`,
      [lng, lat, userId],
    );

    // Update Redis geo index if driver is online
    if (driver.isOnline) {
      await this.redis.geoadd(DRIVERS_ONLINE_KEY, lng, lat, driver.id);
      await this.markPresent(driver.id);
    }

    // Yo'l tezligi profili — ATAYLAB eng oxirida va ATAYLAB "yiqilsa ham
    // mayli" tarzda. Joylashuv yangilash dispetcherlik uchun kritik: haydovchi
    // xaritada qayerdaligi va unga buyurtma tushishi shunga bog'liq. Analitika
    // yozuvidagi xato (Redis uzildi, jadval hali migratsiya qilinmagan) uni
    // hech qachon buzmasligi kerak — shuning uchun xato log'ga yozilib,
    // metod baribir muvaffaqiyatli tugaydi.
    try {
      await this.roadSpeedService.recordPing(driver.id, lat, lng);
    } catch (err) {
      this.logger.warn(
        `Tezlik namunasini yozib bo'lmadi (driver ${driver.id}): ${(err as Error).message}`,
      );
    }
  }

  async setOnlineStatus(userId: string, isOnline: boolean): Promise<Driver> {
    const driver = await this.findByUserIdOrThrow(userId);

    if (isOnline && driver.user?.status === UserStatus.PENDING) {
      throw new BadRequestException(
        'Your account is awaiting admin approval before you can go online',
      );
    }

    // ⚠️ Qarz DAFTARDAN o'qiladi, `drivers.balance` ustunidan emas.
    //
    // Ikkalasi bir xil raqam emas edi: ustun yechib olingan pulni hisobga
    // olmasdi (yechish faqat daftarni debetlaydi), ya'ni ular birinchi
    // yechishdan keyin butunlay ajralib ketardi. Endi haydovchining pul
    // holati bo'yicha yagona haqiqat manbai — daftar.
    if (isOnline) {
      const walletBalance = await computeWalletBalance(
        this.transactionRepository,
        userId,
      );

      if (walletBalance < 0) {
        throw new BadRequestException(
          `Hisobingiz manfiy (${walletBalance.toLocaleString('uz-UZ')} so'm). ` +
            "Onlayn bo'lish uchun qarzni yoping.",
        );
      }
    }

    // Davriy tekshiruv. Faqat ONLAYN chiqishda tekshiriladi: oflayn
    // bo'lishga hech qachon to'sqinlik qilinmaydi, aks holda muddati o'tgan
    // haydovchi onlayn holatda qamalib qolardi.
    //
    // Bloklash faqat majburiy element muddati O'TGAN va ustiga `graceDays`
    // ham tugagan holatda ishlaydi. Qoida sozlanmagan bo'lsa hech kim
    // bloklanmaydi — `DriverVerificationService#getSummaryForDriver` dagi
    // HIMOYA (a) va (b) izohlariga qarang.
    if (isOnline) {
      await this.verificationService.assertCanGoOnline(driver);
    }

    await this.driverRepository.update(driver.id, { isOnline });

    if (!isOnline) {
      await this.redis.zrem(DRIVERS_ONLINE_KEY, driver.id);
      await this.clearPresence(driver.id);
      this.logger.log(`Driver ${driver.id} went offline, removed from Redis`);
    } else {
      // Add to Redis geo if we have a location
      const updatedDriver = await this.driverRepository.findOne({
        where: { id: driver.id },
      });

      if (updatedDriver?.currentLocation) {
        const result = await this.driverRepository.query(
          `SELECT ST_X(current_location::geometry) as lng, ST_Y(current_location::geometry) as lat FROM drivers WHERE id = $1`,
          [driver.id],
        );
        if (result.length > 0) {
          const { lng, lat } = result[0] as { lng: number; lat: number };
          await this.redis.geoadd(DRIVERS_ONLINE_KEY, lng, lat, driver.id);
          await this.markPresent(driver.id);
        }
      }
    }

    return { ...driver, isOnline };
  }

  /** Mavjudlik kalitini yozadi/uzaytiradi. */
  private async markPresent(driverId: string): Promise<void> {
    await this.redis.set(
      `${DRIVER_PRESENCE_PREFIX}${driverId}`,
      '1',
      'EX',
      DRIVER_PRESENCE_TTL_SECONDS,
    );
  }

  private async clearPresence(driverId: string): Promise<void> {
    await this.redis.del(`${DRIVER_PRESENCE_PREFIX}${driverId}`);
  }

  /**
   * Socket qayta ulanganda mavjudlikni tiklaydi.
   *
   * ⚠️ Bu metod `is_online` ni O'ZGARTIRMAYDI — u haydovchining niyati va
   * uni faqat haydovchining o'zi qo'yadi. Bu yerda faqat "yetib borish
   * mumkin" belgisi tiklanadi: uzilish paytida geo-to'plamdan tushib
   * qolgan haydovchi qayta ulangach yana nomzod bo'ladi.
   *
   * Oflayn haydovchi uchun ATAYLAB hech narsa qilinmaydi: qayta ulanish
   * "ishlamoqchiman" degani emas.
   */
  async restorePresence(userId: string): Promise<boolean> {
    const driver = await this.driverRepository.findOne({ where: { userId } });
    if (!driver || !driver.isOnline) return false;

    const result = await this.driverRepository.query(
      `SELECT ST_X(current_location::geometry) as lng, ST_Y(current_location::geometry) as lat
         FROM drivers WHERE id = $1 AND current_location IS NOT NULL`,
      [driver.id],
    );

    // Joylashuvi umuman yo'q haydovchini geo-to'plamga qo'ya olmaymiz —
    // birinchi paketigacha kutamiz. Mavjudlik belgisi baribir qo'yiladi,
    // aks holda paket kelgunicha u "o'lik" hisoblanardi.
    const rows = result as Array<{ lng: number; lat: number }>;
    if (rows.length > 0) {
      await this.redis.geoadd(DRIVERS_ONLINE_KEY, rows[0].lng, rows[0].lat, driver.id);
    }
    await this.markPresent(driver.id);
    return true;
  }

  /**
   * Ulangan socketlar uchun davriy yurak urishi (gateway chaqiradi).
   *
   * Qimirlamay turgan haydovchi joylashuv paketi yubormaydi, lekin uning
   * socketi ulangan — ya'ni u yetib borish mumkin. Shu yo'l bo'lmasa
   * bo'sh turgan haydovchi TTL tugashi bilan tushib qolardi.
   */
  async touchPresence(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;

    const drivers = await this.driverRepository.find({
      where: { userId: In(userIds), isOnline: true },
      select: ['id'],
    });

    await Promise.all(drivers.map((driver) => this.markPresent(driver.id)));
  }

  /**
   * Berilgan haydovchilardan HOZIR yetib borish mumkin bo'lganlari.
   *
   * Mavjudlik kaliti tugagan a'zo geo-to'plamdan ham chiqariladi: aks
   * holda telefoni o'chgan haydovchi to'plamda abadiy qolib, har qidiruvda
   * nomzod bo'lib chiqar va o'z navbatini 15 soniya taklif kutib
   * yeb qo'yardi.
   */
  private async filterPresent(driverIds: string[]): Promise<Set<string>> {
    if (driverIds.length === 0) return new Set();

    const flags = await this.redis.mget(
      ...driverIds.map((id) => `${DRIVER_PRESENCE_PREFIX}${id}`),
    );

    const present = new Set<string>();
    const stale: string[] = [];
    driverIds.forEach((id, index) => {
      if (flags[index] === null) stale.push(id);
      else present.add(id);
    });

    if (stale.length > 0) {
      await this.redis.zrem(DRIVERS_ONLINE_KEY, ...stale);
      this.logger.log(
        `Mavjudligi tugagan ${stale.length} ta haydovchi geo-to'plamdan tozalandi`,
      );
    }

    return present;
  }

  async getNearbyDrivers(
    lat: number,
    lng: number,
    radiusKm: number = 3,
    // Order's Tariff.tier, if the caller wants matching restricted to drivers
    // approved for at least that tier (e.g. a Biznes ride shouldn't offer a
    // Start-tier driver). Omitted entirely by callers that don't care
    // (existing manager/dispatch tooling), so this stays opt-in.
    minTariffTier?: number,
    // Buyurtmaning xizmat turi va (berilgan bo'lsa) talab qilinadigan
    // transport turi. Ixtiyoriy — imkoniyatga qaramaydigan chaqiruvchilar
    // (dispetcher paneli) uchun xulq o'zgarmaydi.
    capabilities?: DriverCapabilityFilter,
  ): Promise<NearbyDriver[]> {
    try {
      // Redis geo to'plami imkoniyat bo'yicha bo'lingan EMAS — u faqat
      // "onlayn haydovchilar" ni biladi. Shuning uchun imkoniyat filtri
      // bo'lganda kengroq oynadan olamiz: aks holda taksi haydovchilariga
      // to'la shaharda eng yaqin 10 ta nomzodning hammasi filtrdan tushib,
      // 500 m naridagi yagona furgon KO'RINMAY qolardi.
      //
      // Qaytariladigan nomzodlar soni baribir CANDIDATE_LIMIT bilan
      // cheklanadi, ya'ni chaqiruvchi (va uning ETA so'rovi) avvalgidek
      // ko'pi bilan 10 ta haydovchi bilan ishlaydi.
      const geoFetchLimit = capabilities ? WIDE_GEO_FETCH_LIMIT : CANDIDATE_LIMIT;

      const results = await this.redis.georadius(
        DRIVERS_ONLINE_KEY,
        lng,
        lat,
        radiusKm,
        'km',
        'WITHCOORD',
        'WITHDIST',
        'ASC',
        'COUNT',
        geoFetchLimit,
      );

      if (!results || results.length === 0) {
        return [];
      }

      const hits = results.map((result) => {
        const [driverId, distStr, coords] = result as [string, string, [string, string]];
        return {
          driverId,
          distanceKm: parseFloat(distStr),
          lng: parseFloat(coords[0]),
          lat: parseFloat(coords[1]),
        };
      });

      // One query for the whole candidate set. This used to call findById()
      // inside the loop — 10 round-trips (each with its own `user` join and
      // display-field enrichment) on the latency-critical dispatch path.
      //
      // Imkoniyat filtri ham SHU YERDA, bitta so'rov natijasi ustida
      // bajariladi: GEORADIUS faqat ID qaytaradi, ya'ni haydovchi turlarini
      // Redis bilmaydi. Har bir nomzod uchun alohida so'rov N+1 bo'lardi.
      const drivers = await this.driverRepository.find({
        where: { id: In(hits.map((h) => h.driverId)) },
        select: ['id', 'userId', 'approvedTariffTier', 'serviceTypes', 'vehicleType'],
      });
      const byId = new Map(drivers.map((d) => [d.id, d]));

      // ⚠️ Mavjudlik tekshiruvi — geo-to'plamdagi a'zolik o'zi YETARLI EMAS.
      // Unda haydovchi oxirgi marta qachon xabar berganini bildiradigan
      // hech narsa yo'q, ya'ni telefoni o'chgan haydovchi ham nomzod bo'lib
      // chiqaveradi.
      const present = await this.filterPresent(hits.map((h) => h.driverId));

      // Redis returned these already sorted by distance; preserve that order.
      return hits
        .flatMap((hit) => {
          const driver = byId.get(hit.driverId);
          if (!driver) return [];
          if (!present.has(hit.driverId)) return [];
          if (minTariffTier !== undefined && driver.approvedTariffTier < minTariffTier) {
            return [];
          }
          if (!driverMatchesCapabilities(driver, capabilities)) {
            return [];
          }
          return [
            {
              driverId: driver.id,
              userId: driver.userId,
              distanceKm: hit.distanceKm,
              lng: hit.lng,
              lat: hit.lat,
            },
          ];
        })
        .slice(0, CANDIDATE_LIMIT);
    } catch (err) {
      this.logger.error(`Redis georadius error: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * How many drivers are online within [radiusKm] of a point.
   *
   * Used as the supply side of the surge ratio. Deliberately counts every
   * online driver, not just idle ones: a driver finishing a trip two streets
   * away is real, imminent supply, and treating them as absent would surge a
   * zone that is about to be served.
   */
  async countOnlineDriversNear(
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<number> {
    try {
      const ids = await this.redis.georadius(
        DRIVERS_ONLINE_KEY,
        lng,
        lat,
        radiusKm,
        'km',
      );
      return ids?.length ?? 0;
    } catch (err) {
      this.logger.error(`Redis georadius (count) error: ${(err as Error).message}`);
      // Treated as "unknown", and the caller reads 0 supply as maximum surge —
      // so report a failure as no data rather than as an empty city.
      throw err;
    }
  }

  async updateRating(driverId: string, newRating: number): Promise<void> {
    await this.driverRepository.update(driverId, { rating: newRating });
  }

  async getOnlineDriversList(): Promise<OnlineDriverSummary[]> {
    const rows: OnlineDriverRow[] = await this.driverRepository.query(
      `SELECT d.id, d.user_id, d.car_model, d.car_number, d.rating, d.updated_at,
              u.first_name, u.last_name, u.phone,
              active_order.id as current_order_id
       FROM drivers d
       JOIN users u ON u.id = d.user_id
       LEFT JOIN LATERAL (
         SELECT id FROM orders
         WHERE driver_id = d.user_id
           AND status IN ('accepted', 'arrived', 'in_progress')
         ORDER BY created_at DESC
         LIMIT 1
       ) active_order ON true
       WHERE d.is_online = true
       ORDER BY d.updated_at DESC`,
    );

    if (rows.length === 0) {
      return [];
    }

    // ⚠️ `is_online` endi haydovchining NIYATI: socket uzilishi uni
    // o'chirmaydi (izohi `DRIVER_PRESENCE_PREFIX` da). Ya'ni bu ro'yxatni
    // faqat shu ustun bo'yicha qursak, dispetcher taxtasi telefonini
    // o'chirib qo'ygan haydovchini ham "onlayn" deb ko'rsatardi va
    // dispetcher unga buyurtma bermoqchi bo'lardi.
    //
    // Taxta HOZIR ish bera oladigan haydovchini ko'rsatishi kerak, ya'ni
    // matching ishlatadigan aynan shu filtr.
    const reachable = await this.filterPresent(rows.map((row) => row.id));
    const visibleRows = rows.filter((row) => reachable.has(row.id));

    if (visibleRows.length === 0) {
      return [];
    }

    const positions = await this.redis.geopos(
      DRIVERS_ONLINE_KEY,
      ...visibleRows.map((row) => row.id),
    );

    return visibleRows.map((row, index) => {
      const pos = positions[index];
      const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'Driver';

      return {
        id: row.id,
        name,
        phone: row.phone,
        carModel: row.car_model ?? '',
        carNumber: row.car_number ?? '',
        rating: parseFloat(row.rating),
        status: row.current_order_id ? 'busy' : 'online',
        currentOrderId: row.current_order_id,
        lastSeen: row.updated_at,
        location: pos ? { lat: parseFloat(pos[1]), lng: parseFloat(pos[0]) } : undefined,
      };
    });
  }

  // Pure balance mutation with no transaction record of its own — used by
  // OrdersService after it has already written the CREDIT/DEBIT pair for a
  // completed trip's payout + commission, so the ledger isn't double-counted.
  // If the delta pushes the driver negative while online, take them offline
  // immediately rather than leaving them online-but-blocked until their next
  // toggle.
  /**
   * Database half of a balance adjustment, runnable inside a caller's
   * transaction so a wallet movement commits or rolls back together with the
   * ledger rows that justify it (see OrdersCompletionService.completeTrip).
   *
   * The balance is incremented in SQL (`balance = balance + :delta`) rather
   * than read-modify-written in JS: two settlements landing on the same driver
   * concurrently would otherwise both read the old balance and the second
   * write would silently swallow the first.
   *
   * Deliberately does no Redis work — that side effect must not fire until the
   * surrounding transaction has actually committed. The caller applies it via
   * {@link takeOfflineInRedis} using the returned `wentOffline` flag.
   */
  async adjustBalanceWithin(
    manager: EntityManager,
    userId: string,
    delta: number,
  ): Promise<{ driverId: string; newBalance: number; wentOffline: boolean }> {
    const driver = await manager.findOne(Driver, { where: { userId } });

    if (!driver) {
      throw new NotFoundException(`Driver for user ${userId} not found`);
    }

    const [updated] = (await manager.query(
      `UPDATE drivers
          SET balance = balance + $1,
              is_online = CASE WHEN balance + $1 < 0 THEN false ELSE is_online END
        WHERE id = $2
    RETURNING balance, is_online`,
      [delta, driver.id],
    ));

    const newBalance = parseFloat(updated?.balance ?? '0');
    const wentOffline = driver.isOnline && updated?.is_online === false;

    return { driverId: driver.id, newBalance, wentOffline };
  }

  /**
   * Drops a driver from the online geo set. Split out of the balance update so
   * it can be deferred until after the caller's transaction commits.
   */
  async takeOfflineInRedis(driverId: string, reason: string): Promise<void> {
    await this.redis.zrem(DRIVERS_ONLINE_KEY, driverId);
    this.logger.log(`Driver ${driverId} taken offline: ${reason}`);
  }

  async adjustBalance(userId: string, delta: number): Promise<{ driver: Driver; wentOffline: boolean }> {
    const driver = await this.findByUserIdOrThrow(userId);
    const { newBalance, wentOffline } = await this.adjustBalanceWithin(
      this.driverRepository.manager,
      userId,
      delta,
    );

    if (wentOffline) {
      await this.takeOfflineInRedis(driver.id, `balance went negative (${newBalance})`);
    }

    return {
      driver: { ...driver, balance: newBalance, isOnline: wentOffline ? false : driver.isOnline },
      wentOffline,
    };
  }

  // Manual top-up/adjustment. `amount` may be negative for a correction. This
  // is also the endpoint a future Telegram top-up bot will call.
  async addFunds(driverId: string, amount: number, note?: string): Promise<Driver> {
    const driver = await this.findByIdOrThrow(driverId);

    await this.transactionRepository.save({
      userId: driver.userId,
      orderId: null,
      amount: Math.abs(amount),
      type: amount >= 0 ? TransactionType.CREDIT : TransactionType.DEBIT,
      paymentMethod: PaymentMethod.CASH,
      status: TransactionStatus.COMPLETED,
      externalId: note ?? null,
    });

    // Atomic increment rather than a read-modify-write of `driver.balance`.
    // Two concurrent top-ups (admin credit + Telegram bot, or a double-tap)
    // both read the same starting balance and the second write silently
    // discarded the first. Reuses the same SQL shape as adjustBalanceWithin.
    await this.adjustBalanceWithin(this.driverRepository.manager, driver.userId, amount);

    return this.findByIdOrThrow(driverId);
  }

  async setCommissionRate(driverId: string, commissionRate: number | null): Promise<Driver> {
    await this.findByIdOrThrow(driverId);
    await this.driverRepository.update(driverId, { commissionRate });
    return this.findByIdOrThrow(driverId);
  }

  async countAll(): Promise<number> {
    return this.driverRepository.count();
  }

  async countOnline(): Promise<number> {
    return this.driverRepository.count({ where: { isOnline: true } });
  }

  async countPending(): Promise<number> {
    return this.driverRepository
      .createQueryBuilder('d')
      .innerJoin('d.user', 'u')
      .where('u.status = :status', { status: UserStatus.PENDING })
      .getCount();
  }

  async findAll(
    page = 1,
    limit = 20,
    filters: { status?: string; isOnline?: boolean; search?: string } = {},
  ): Promise<{ drivers: Driver[]; total: number; page: number; limit: number }> {
    const qb = this.driverRepository
      .createQueryBuilder('d')
      .innerJoinAndSelect('d.user', 'u')
      .orderBy('d.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.isOnline !== undefined) {
      qb.andWhere('d.isOnline = :isOnline', { isOnline: filters.isOnline });
    }
    if (filters.status) {
      qb.andWhere('u.status = :status', { status: filters.status });
    }
    if (filters.search) {
      qb.andWhere(
        '(u.first_name ILIKE :search OR u.last_name ILIKE :search OR u.phone ILIKE :search OR d.car_number ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const [drivers, total] = await qb.getManyAndCount();
    return { drivers: await this.attachDisplayFields(drivers), total, page, limit };
  }
}
