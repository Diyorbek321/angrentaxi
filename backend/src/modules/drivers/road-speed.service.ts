import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { latLngToCell } from 'h3-js';
import { RoadSpeedSample } from '../../database/entities/road-speed-sample.entity';
import { REDIS_CLIENT } from '../../config/redis.config';

/** Bitta zona + vaqt oynasi uchun yig'ilgan tezlik profili. */
export interface ZoneSpeedProfile {
  zone: string;
  dayOfWeek: number;
  hourOfDay: number;
  sampleCount: number;
  /** `null` — bu zona/vaqt uchun hali bironta ham namuna yo'q. */
  averageSpeedKmh: number | null;
}

/** Redis'da saqlanadigan oldingi ping. `t` — millisekundlarda vaqt belgisi. */
export interface DriverPing {
  lat: number;
  lng: number;
  t: number;
}

/** Hafta kuni + soat juftligi, mahalliy vaqtga keltirilgan. */
export interface TimeSlot {
  dayOfWeek: number;
  hourOfDay: number;
}

/**
 * GPS ping'laridan yo'l tezligi profilini yig'adi.
 *
 * NEGA bu kerak: hozir OSRM marshrutning davomiyligini o'zining umumiy
 * profilidan taxmin qiladi — Angrenning tor ko'chalari, bozor atrofidagi
 * tirbandligi va soat 18 dagi holati u yerda yo'q. Haydovchilar esa har kuni
 * shu ma'lumotni o'z mashinalari bilan generatsiya qilishadi va u darhol
 * o'chib ketardi. Bu servis o'sha oqimni ushlab, faqat AGREGAT holda saqlaydi.
 *
 * Maxfiylik: xom ping hech qachon jadvalga tushmaydi. Oldingi ping Redis'da
 * qisqa TTL bilan turadi va faqat "ikki nuqta orasidagi tezlik" ni hisoblash
 * uchun ishlatiladi; hisoblangandan keyin natija zona/kun/soat kesimidagi
 * yig'indiga qo'shiladi, ya'ni bitta haydovchining yo'li tiklanmaydi.
 */
@Injectable()
export class RoadSpeedService {
  /**
   * SurgeService bilan AYNI rezolyutsiya (8 ≈ 0.74 km²). Ikkalasi bir xil
   * hujayralarda ishlashi shart: aks holda "talab yuqori zona" va "sekin zona"
   * bir-biriga ustma-ust tushmaydi va ikkalasini birga tahlil qilib bo'lmaydi.
   */
  static readonly ZONE_RESOLUTION = 8;

  /**
   * Ikki ping orasidagi eng qisqa qabul qilinadigan oraliq (soniya).
   *
   * Undan qisqasida GPS xatoligi (shahar ichida ±10 m odatiy) masofani ham,
   * tezlikni ham butunlay buzadi: 2 soniyada 15 m "sakragan" turgan mashina
   * 27 km/soat bo'lib ko'rinadi.
   */
  static readonly MIN_INTERVAL_SECONDS = 5;

  /**
   * Eng uzun qabul qilinadigan oraliq (soniya).
   *
   * Undan uzoq tanaffus — bu ilova fon rejimiga o'tgani, tunnel yoki tarmoq
   * uzilishi. Bunday oraliqda mashina qayerdan yurgani noma'lum, to'g'ri
   * chiziqli masofa esa haqiqiy yo'ldan ancha qisqa — natija yolg'on past
   * tezlik bo'lib chiqadi.
   */
  static readonly MAX_INTERVAL_SECONDS = 120;

  /**
   * Aql bovar qilmaydigan tezlik chegarasi (km/soat).
   *
   * Angren ko'chalarida 150 km/soat jismonan bo'lmaydi; bu qiymat deyarli
   * doim GPS sakrashi (ko'p qavatli bino orasida joylashuv "otilib" ketishi)
   * yoki soat noto'g'riligi.
   */
  static readonly MAX_SPEED_KMH = 150;

  /**
   * Undan sekin harakat "turgan mashina" deb qaraladi va YOZILMAYDI.
   *
   * Svetoforda yoki mijozni kutib turgan haydovchi soatiga nol km bosadi.
   * Uni yozish zonani doimiy tirband ko'rsatib yuboradi — holbuki ko'cha bo'sh.
   */
  static readonly MIN_SPEED_KMH = 1;

  /**
   * Oldingi ping Redis'da shuncha soniya turadi.
   *
   * MAX_INTERVAL_SECONDS dan biroz uzunroq: eskirgan ping'ni tashlab yuborish
   * qarori kodda, aniq shartda qabul qilinsin (va test qilinsin), Redis'ning
   * o'chirish vaqtiga bog'lanib qolmasin.
   */
  static readonly LAST_PING_TTL_SECONDS = 180;

  /**
   * O'zbekiston UTC+5 da va yozgi vaqtga o'tmaydi.
   *
   * Server (Railway) UTC da ishlaydi, trafik esa mahalliy soatga bog'liq:
   * server vaqtini o'girmasdan yozsak, Angrendagi soat 18 dagi tirbandlik
   * jadvalda soat 13 ga tushib qoladi va profil butunlay yaroqsiz bo'ladi.
   */
  private static readonly UZ_UTC_OFFSET_HOURS = 5;

  /** Redis kaliti — har haydovchining faqat OXIRGI ping'i, tarix emas. */
  private static readonly LAST_PING_KEY_PREFIX = 'driver:lastping:';

  constructor(
    @InjectRepository(RoadSpeedSample)
    private readonly sampleRepository: Repository<RoadSpeedSample>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  /**
   * Yangi ping'ni qayd etadi va oldingisi bilan solishtirib bitta tezlik
   * namunasini agregatga qo'shadi.
   *
   * Filtrdan o'tmagan (yoki oldingi ping'i yo'q) holatda jimgina qaytadi —
   * bu xato emas, oddiy holat.
   */
  async recordPing(
    driverId: string,
    lat: number,
    lng: number,
    at: Date = new Date(),
  ): Promise<void> {
    const current: DriverPing = { lat, lng, t: at.getTime() };
    const key = RoadSpeedService.LAST_PING_KEY_PREFIX + driverId;

    const previousRaw = await this.redis.get(key);

    // Yangi ping oldingisining o'rniga yoziladi — tarix to'planmaydi.
    await this.redis.set(
      key,
      JSON.stringify(current),
      'EX',
      RoadSpeedService.LAST_PING_TTL_SECONDS,
    );

    const previous = RoadSpeedService.parsePing(previousRaw);
    if (!previous) return;

    const speedKmh = RoadSpeedService.speedKmhBetween(previous, current);
    if (speedKmh === null) return;

    await this.addSample(RoadSpeedService.zoneFor(lat, lng), at, speedKmh);
  }

  /**
   * Ikki ping orasidagi o'rtacha tezlik (km/soat), yoki filtrdan o'tmasa
   * `null`.
   *
   * Sof funksiya: hech qanday I/O yo'q, shuning uchun har bir chegarani
   * alohida test qilish mumkin.
   */
  static speedKmhBetween(previous: DriverPing, current: DriverPing): number | null {
    const elapsedSeconds = (current.t - previous.t) / 1000;

    // Manfiy oraliq — soat orqaga ketgani (qurilma vaqtini o'zgartirgan yoki
    // ping'lar teskari tartibda kelgani). MIN tekshiruvi buni ham qamraydi.
    if (!Number.isFinite(elapsedSeconds)) return null;
    if (elapsedSeconds < RoadSpeedService.MIN_INTERVAL_SECONDS) return null;
    if (elapsedSeconds > RoadSpeedService.MAX_INTERVAL_SECONDS) return null;

    const distanceKm = RoadSpeedService.haversineKm(previous, current);
    if (!Number.isFinite(distanceKm)) return null;

    const speedKmh = distanceKm / (elapsedSeconds / 3600);

    if (speedKmh < RoadSpeedService.MIN_SPEED_KMH) return null;
    if (speedKmh > RoadSpeedService.MAX_SPEED_KMH) return null;

    return speedKmh;
  }

  /** Nuqta tushadigan H3 hujayra. */
  static zoneFor(lat: number, lng: number): string {
    return latLngToCell(lat, lng, RoadSpeedService.ZONE_RESOLUTION);
  }

  /**
   * Vaqt belgisini mahalliy hafta kuni + soatga aylantiradi.
   *
   * `getUTC*` ATAYLAB: avval qo'lda +5 soat qo'shilib, keyin UTC bo'yicha
   * o'qiladi — shunda natija serverning TZ sozlamasiga umuman bog'liq
   * bo'lmaydi va testda ham, Railway'da ham bir xil chiqadi.
   */
  static slotFor(at: Date): TimeSlot {
    const local = new Date(
      at.getTime() + RoadSpeedService.UZ_UTC_OFFSET_HOURS * 60 * 60 * 1000,
    );

    return { dayOfWeek: local.getUTCDay(), hourOfDay: local.getUTCHours() };
  }

  /**
   * Zona + vaqt kesimidagi o'rtacha tezlik.
   *
   * Namuna yo'q bo'lsa `averageSpeedKmh: null` qaytadi — nol EMAS. Nol
   * "bu ko'cha to'liq to'xtab qolgan" degani bo'lardi, ya'ni ma'lumot
   * yo'qligini eng yomon ma'lumot sifatida ko'rsatib yuborardi.
   */
  async profileFor(
    zone: string,
    dayOfWeek: number,
    hourOfDay: number,
  ): Promise<ZoneSpeedProfile> {
    const row = await this.sampleRepository.findOne({
      where: { zone, dayOfWeek, hourOfDay },
    });

    const sampleCount = Number(row?.sampleCount ?? 0);
    const speedSum = Number(row?.speedSum ?? 0);

    return {
      zone,
      dayOfWeek,
      hourOfDay,
      sampleCount,
      averageSpeedKmh:
        sampleCount > 0 ? Math.round((speedSum / sampleCount) * 10) / 10 : null,
    };
  }

  /**
   * Agregatga bitta namuna qo'shadi.
   *
   * `ON CONFLICT ... DO UPDATE` — o'qib-hisoblab-yozish emas: bir zonada bir
   * vaqtning o'zida o'nlab haydovchi yurishi mumkin, ularning yozuvlari
   * JS tomonda hisoblansa bir-birini yo'q qilar edi.
   */
  private async addSample(zone: string, at: Date, speedKmh: number): Promise<void> {
    const { dayOfWeek, hourOfDay } = RoadSpeedService.slotFor(at);

    await this.sampleRepository.query(
      `INSERT INTO road_speed_samples (zone, day_of_week, hour_of_day, sample_count, speed_sum)
            VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT (zone, day_of_week, hour_of_day)
       DO UPDATE SET sample_count = road_speed_samples.sample_count + 1,
                     speed_sum    = road_speed_samples.speed_sum + EXCLUDED.speed_sum,
                     updated_at   = now()`,
      [zone, dayOfWeek, hourOfDay, speedKmh],
    );
  }

  /**
   * Redis'dagi qiymatni ping'ga aylantiradi.
   *
   * Buzuq JSON — bu formatni o'zgartirgan eski deploy qoldig'i. Uni xato deb
   * ko'tarish joylashuv yangilashni yiqitardi, holbuki eng to'g'ri javob —
   * "oldingi ping yo'q" deb hisoblash va keyingi ping'dan qaytadan boshlash.
   */
  private static parsePing(raw: string | null): DriverPing | null {
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<DriverPing>;

      if (
        typeof parsed?.lat !== 'number' ||
        typeof parsed?.lng !== 'number' ||
        typeof parsed?.t !== 'number'
      ) {
        return null;
      }

      return { lat: parsed.lat, lng: parsed.lng, t: parsed.t };
    } catch {
      return null;
    }
  }

  /**
   * Ikki nuqta orasidagi sferik masofa (km).
   *
   * Bu — to'g'ri chiziq, ya'ni haqiqiy yo'ldan biroz qisqa. Oraliq 2 daqiqadan
   * oshmagani uchun farq kichik, o'lchov esa doimo BIR TOMONGA (pastga)
   * og'adi — profil trafikni bor-yo'g'idan sekinroq ko'rsatadi, tezroq emas.
   */
  private static haversineKm(a: DriverPing, b: DriverPing): number {
    const EARTH_RADIUS_KM = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  }
}
