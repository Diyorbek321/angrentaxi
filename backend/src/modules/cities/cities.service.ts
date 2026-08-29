import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from '../../database/entities/city.entity';
// Haqiqiy haversine formulasi loyihada BITTA joyda turadi. Uni bu yerda
// qayta yozish ikkita nusxa yasardi va ular vaqt o'tishi bilan ajralib
// ketardi — masofa esa ikki joyda ham bir xil chiqishi kerak. Bu fayl sof
// funksiyalar to'plami (DI yo'q), shuning uchun modul bog'liqligi paydo
// bo'lmaydi.
import { haversineDistance } from '../orders/orders.distance.util';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

/**
 * Shaharni KOORDINATADAN aniqlash va shaharlar ro'yxatini boshqarish.
 *
 * ⚠️ ASOSIY QAROR: shahar olish nuqtasidan aniqlanadi, foydalanuvchi qo'lda
 * TANLAMAYDI. Qo'lda tanlash yana bir xato manbai bo'lardi — odam "Angren"
 * ni tanlab Toshkentdan buyurtma berishi mumkin, va tizim buni sezmasdi.
 * Koordinatadan aniqlangan shahar esa har doim rost.
 */
@Injectable()
export class CitiesService {
  private readonly logger = new Logger(CitiesService.name);

  /**
   * Faol shaharlar keshi.
   *
   * ⚠️ NEGA KESH: `resolveForPoint` HAR BUYURTMADA chaqiriladi, jadval esa
   * o'nlab qatordan iborat va oyiga bir marta o'zgaradi — har safar bazaga
   * borish sof isrof. Redis emas, XOTIRA: ma'lumot juda kichik, va Redis
   * chaqiruvi ham tarmoq sayohati, ya'ni asosiy yutuq yo'qolardi.
   *
   * TTL bor, chunki backend bir nechta nusxada ishlashi mumkin: bir
   * nusxada qilingan o'zgarish boshqasining keshini bekor qila olmaydi.
   * `invalidate()` esa yozuvni QILGAN nusxada darhol ta'sir qiladi —
   * menejer o'zgarishni saqlab, ro'yxatni qayta ochganda eskisini
   * ko'rmasligi uchun.
   */
  private cache: { cities: City[]; expiresAt: number } | null = null;

  /** 60 soniya — menejer uchun sezilarsiz kechikish, baza uchun sezilarli yengillik. */
  private static readonly CACHE_TTL_MS = 60_000;

  constructor(
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
  ) {}

  /** Keshni majburan bo'shatadi — har bir yozuvdan keyin chaqiriladi. */
  private invalidate(): void {
    this.cache = null;
  }

  /**
   * Faol shaharlar, ko'rsatish tartibida. Kesh'langan.
   *
   * Baza javob bermasa BO'SH ro'yxat qaytadi va xato yuqoriga otilmaydi:
   * chaqiruvchilar uchun "shahar yo'q" = "cheklov yo'q", ya'ni nosozlik
   * paytida buyurtma qabul qilinishda davom etadi. Teskarisi — bitta
   * so'rov xatosi butun shaharni buyurtma bera olmaydigan holga
   * keltirardi.
   */
  async listActive(): Promise<City[]> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.cities;
    }

    try {
      const cities = await this.cityRepository.find({
        where: { isActive: true },
        order: { sortOrder: 'ASC', name: 'ASC' },
      });
      this.cache = { cities, expiresAt: now + CitiesService.CACHE_TTL_MS };
      return cities;
    } catch (error) {
      this.logger.error(
        `Shaharlar ro'yxatini o'qib bo'lmadi — qamrov cheklovi shu so'rov uchun qo'llanmaydi: ${String(error)}`,
      );
      return [];
    }
  }

  /**
   * Qamrov cheklovi UMUMAN kuchdami?
   *
   * ⚠️ HIMOYA (a): jadvalda birorta FAOL shahar bo'lmasa — hech narsa rad
   * etilmaydi va hech qanday filtr qo'llanmaydi. Bo'sh sozlama = cheklov
   * yo'q. Bu naqsh loyihada allaqachon qabul qilingan
   * (`driver_verification_requirements` bo'sh bo'lsa hech kim oflayn
   * bo'lib qolmaydi) va u deploy lahzasida hech narsa to'xtamasligini
   * kafolatlaydi.
   */
  async isCoverageEnforced(): Promise<boolean> {
    return (await this.listActive()).length > 0;
  }

  /**
   * Nuqta qaysi shaharga tushadi.
   *
   * Markazgacha masofasi radiusdan oshmagan FAOL shaharlar ichidan ENG
   * YAQINI qaytariladi. Hech biri mos kelmasa — `null`.
   *
   * ⚠️ NEGA "eng yaqini", "birinchi mosi" emas: ikki shahar doirasi
   * ustma-ust tushishi mumkin (masalan Angren va yondosh shaharcha).
   * Bunday nuqtada "ro'yxatdagi birinchisi" javobi tartibga bog'liq
   * bo'lardi — ya'ni `sortOrder` ni o'zgartirish jimgina buyurtmalarni
   * boshqa shaharga yozib qo'yardi. Masofa esa tartibdan mustaqil.
   *
   * ⚠️ CHEGARA ICHKARIGA TEGISHLI (`<=`): aynan radiusda turgan nuqtani
   * rad etish "1 metr narida buyurtma bermadi" degan tushunarsiz xatoga
   * olib kelardi.
   */
  async resolveForPoint(lat: number, lng: number): Promise<City | null> {
    const cities = await this.listActive();
    if (cities.length === 0) return null;

    let nearest: City | null = null;
    let nearestDistanceKm = Number.POSITIVE_INFINITY;

    for (const city of cities) {
      const distanceKm = haversineDistance(
        lat,
        lng,
        city.centerLat,
        city.centerLng,
      );
      if (distanceKm <= city.radiusKm && distanceKm < nearestDistanceKm) {
        nearest = city;
        nearestDistanceKm = distanceKm;
      }
    }

    return nearest;
  }

  /**
   * Nuqtadan shahar ID si — `null` bo'lsa "yozadigan narsa yo'q".
   *
   * Qulaylik uchun: chaqiruvchilarning ko'pi (haydovchi profili, tarif
   * filtri) shaharning o'zini emas, faqat ID sini yozadi va qamrovdan
   * tashqaridagi nuqta ular uchun XATO EMAS.
   */
  async resolveCityIdForPoint(lat: number, lng: number): Promise<string | null> {
    return (await this.resolveForPoint(lat, lng))?.id ?? null;
  }

  /** Menejer paneli uchun — nofaollari bilan birga. */
  async findAll(): Promise<City[]> {
    return this.cityRepository.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findByIdOrThrow(id: string): Promise<City> {
    const city = await this.cityRepository.findOne({ where: { id } });
    if (!city) {
      throw new NotFoundException(`Shahar topilmadi: ${id}`);
    }
    return city;
  }

  async create(dto: CreateCityDto): Promise<City> {
    const city = await this.cityRepository.save({
      name: dto.name,
      centerLat: dto.centerLat,
      centerLng: dto.centerLng,
      radiusKm: dto.radiusKm,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    this.invalidate();
    return city;
  }

  async update(id: string, dto: UpdateCityDto): Promise<City> {
    const city = await this.findByIdOrThrow(id);

    // Yangi obyekt yasaladi, mavjudi o'zgartirilmaydi.
    const updated = await this.cityRepository.save({
      ...city,
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.centerLat !== undefined && { centerLat: dto.centerLat }),
      ...(dto.centerLng !== undefined && { centerLng: dto.centerLng }),
      ...(dto.radiusKm !== undefined && { radiusKm: dto.radiusKm }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
    });

    this.invalidate();
    return updated;
  }

  /**
   * Shaharni yoqish/o'chirish.
   *
   * ⚠️ Qator O'CHIRILMAYDI: unga bog'langan buyurtmalar tarixi shahar
   * nomini yo'qotmasligi kerak. Nofaol shahar `resolveForPoint` uchun
   * mavjud emas — ya'ni yangi buyurtma u yerda yaratilmaydi, lekin
   * eskilari joyida qoladi.
   */
  async setActive(id: string, isActive: boolean): Promise<City> {
    const city = await this.findByIdOrThrow(id);
    const updated = await this.cityRepository.save({ ...city, isActive });
    this.invalidate();
    return updated;
  }
}
