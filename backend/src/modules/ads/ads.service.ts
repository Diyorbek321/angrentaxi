import { Readable } from 'stream';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { AdBanner, AdLinkType } from '../../database/entities/ad-banner.entity';
import { AdBannerDailyStat } from '../../database/entities/ad-banner-daily-stat.entity';
import { Restaurant } from '../../database/entities/restaurant.entity';
import { Store } from '../../database/entities/store.entity';
import { OBJECT_STORAGE, ObjectStorage } from '../storage/object-storage';
import type { UploadedMemoryFile } from '../drivers/driver-uploads';
import { adImageKeyFor, adImageMimeType } from './ad-images';
import { AD_STATS_MAX_DAYS, AdDailyRow, fillDailySeries, tashkentDay } from './ad-daily-series';
import { CreateAdBannerDto } from './dto/create-ad-banner.dto';
import { UpdateAdBannerDto } from './dto/update-ad-banner.dto';

/** Karuselda bir vaqtda ko'rsatiladigan bannerlar soni — undan ko'pi o'qilmaydi ham. */
const MAX_ACTIVE_BANNERS = 10;

export interface AdImage {
  stream: Readable;
  mimeType: string;
}

interface LinkFields {
  linkType: AdLinkType;
  linkTarget: string | null;
}

@Injectable()
export class AdsService {
  constructor(
    @InjectRepository(AdBanner)
    private readonly adRepository: Repository<AdBanner>,
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @InjectRepository(AdBannerDailyStat)
    private readonly dailyRepository: Repository<AdBannerDailyStat>,
  ) {}

  private readonly logger = new Logger(AdsService.name);

  /** Admin: hammasi, nofaollari va muddati tugaganlari bilan. */
  findAll(): Promise<AdBanner[]> {
    return this.adRepository.find({ order: { sortOrder: 'ASC', createdAt: 'DESC' } });
  }

  /** Yo'lovchi ilovasi: hozir ko'rsatilishi kerak bo'lganlar. */
  listActive(now = new Date()): Promise<AdBanner[]> {
    const started = [{ startsAt: IsNull() }, { startsAt: LessThanOrEqual(now) }];
    const notEnded = [{ endsAt: IsNull() }, { endsAt: MoreThan(now) }];
    return this.adRepository.find({
      where: started.flatMap((s) => notEnded.map((e) => ({ isActive: true, ...s, ...e }))),
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
      take: MAX_ACTIVE_BANNERS,
    });
  }

  async create(dto: CreateAdBannerDto, file: UploadedMemoryFile): Promise<AdBanner> {
    // Hamma tekshiruv rasm yozilishidan OLDIN: aks holda rad etilgan forma
    // bucket'da hech kim ko'rmaydigan yetim fayl qoldirardi.
    const link = await this.validateLink({
      linkType: dto.linkType ?? AdLinkType.NONE,
      linkTarget: dto.linkTarget ?? null,
    });
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    assertWindow(startsAt, endsAt);

    const image = adImageKeyFor(file.buffer);
    if (!image) {
      throw new UnsupportedMediaTypeException('Fayl JPEG, PNG yoki WEBP rasm emas');
    }
    await this.storage.put(image.key, file.buffer, image.mimeType);

    const saved = await this.adRepository.save(
      this.adRepository.create({
        title: dto.title.trim(),
        imageKey: image.key,
        ...link,
        startsAt,
        endsAt,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      }),
    );
    // `imageKey` select:false — javobga ham chiqmasin.
    const { imageKey: _imageKey, ...publicFields } = saved;
    return publicFields as AdBanner;
  }

  async update(id: string, dto: UpdateAdBannerDto): Promise<AdBanner> {
    const banner = await this.adRepository.findOne({ where: { id } });
    if (!banner) throw new NotFoundException('Banner topilmadi');

    const link = await this.validateLink({
      linkType: dto.linkType ?? banner.linkType,
      linkTarget: dto.linkTarget !== undefined ? dto.linkTarget : banner.linkTarget,
    });
    const startsAt = dto.startsAt !== undefined ? toDate(dto.startsAt) : banner.startsAt;
    const endsAt = dto.endsAt !== undefined ? toDate(dto.endsAt) : banner.endsAt;
    assertWindow(startsAt, endsAt);

    return this.adRepository.save({
      ...banner,
      ...link,
      title: dto.title?.trim() ?? banner.title,
      startsAt,
      endsAt,
      isActive: dto.isActive ?? banner.isActive,
      sortOrder: dto.sortOrder ?? banner.sortOrder,
    });
  }

  /**
   * Qator, keyin rasmi o'chiriladi. Rasmni o'chirish yiqilsa banner baribir
   * o'chgan hisoblanadi (log yoziladi): yetim rasmni hech narsa ko'rsatmaydi,
   * chunki u faqat banner id orqali ochiladi — admin esa xato ko'rmasin.
   */
  async remove(id: string): Promise<void> {
    const banner = await this.adRepository.findOne({
      where: { id },
      select: { id: true, imageKey: true },
    });
    if (!banner) throw new NotFoundException('Banner topilmadi');

    const result = await this.adRepository.delete({ id });
    if (!result.affected) throw new NotFoundException('Banner topilmadi');

    try {
      await this.storage.delete(banner.imageKey);
    } catch (err) {
      this.logger.warn(`Banner ${id} rasmi (${banner.imageKey}) o'chmadi: ${(err as Error).message}`);
    }
  }

  /** Oxirgi [days] kunning ko'rish/bosish soni, eskisidan boshlab. */
  async dailyStats(id: string, days: number, now = new Date()): Promise<AdDailyRow[]> {
    if (!(await this.adRepository.exists({ where: { id } }))) {
      throw new NotFoundException('Banner topilmadi');
    }
    const span = Math.min(Math.max(Math.floor(days) || 1, 1), AD_STATS_MAX_DAYS);
    const today = tashkentDay(now);
    const rows = (await this.dailyRepository.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, impressions, clicks
         FROM ad_banner_daily_stats
        WHERE banner_id = $1 AND day > $2::date - $3::int
        ORDER BY day`,
      [id, today, span],
    )) as AdDailyRow[];
    return fillDailySeries(rows, span, today);
  }

  async openImage(id: string): Promise<AdImage | null> {
    const banner = await this.adRepository.findOne({
      where: { id },
      select: { id: true, imageKey: true },
    });
    if (!banner) return null;
    const mimeType = adImageMimeType(banner.imageKey);
    if (!mimeType) return null;
    const object = await this.storage.get(banner.imageKey);
    return object ? { stream: object.stream, mimeType } : null;
  }

  recordImpression(id: string): Promise<void> {
    return this.bump(id, 'impressions');
  }

  recordClick(id: string): Promise<void> {
    return this.bump(id, 'clicks');
  }

  /**
   * Atomar `+1` (o'qib-yozish emas — bir vaqtda kelgan ikki so'rov bittasini
   * yo'qotmasin). O'chirilgan bannerga hisob yozilmaydi: admin uni o'chirib
   * qo'ygandan keyin eski keshdan kelgan ko'rishlar hisobotni buzmasin.
   */
  private async bump(id: string, column: 'impressions' | 'clicks'): Promise<void> {
    const result = await this.adRepository.increment({ id, isActive: true }, column, 1);
    if (!result.affected) throw new NotFoundException('Banner topilmadi');

    // Kunlik kesim — Toshkent sanasi bazaning o'zida olinadi (server zonasi
    // muhim emas). Bir qator = bir bannerning bir kuni. Yiqilsa faqat log:
    // jami son yozildi, ilovaning ko'rish so'rovi xato bilan qaytmasin.
    await this.dailyRepository.query(
      `INSERT INTO ad_banner_daily_stats (banner_id, day, impressions, clicks)
       VALUES ($1, (now() AT TIME ZONE 'Asia/Tashkent')::date, $2, $3)
       ON CONFLICT (banner_id, day) DO UPDATE SET
         impressions = ad_banner_daily_stats.impressions + EXCLUDED.impressions,
         clicks = ad_banner_daily_stats.clicks + EXCLUDED.clicks`,
      [id, column === 'impressions' ? 1 : 0, column === 'clicks' ? 1 : 0],
    ).catch((err: Error) => this.logger.warn(`Banner ${id} kunlik hisobi yozilmadi: ${err.message}`));
  }

  private async validateLink({ linkType, linkTarget }: LinkFields): Promise<LinkFields> {
    const target = linkTarget?.trim() || null;
    switch (linkType) {
      case AdLinkType.NONE:
        return { linkType, linkTarget: null };
      case AdLinkType.URL:
        if (!target || !isHttpsUrl(target)) {
          throw new BadRequestException('Havola https:// bilan boshlanishi kerak');
        }
        return { linkType, linkTarget: target };
      case AdLinkType.RESTAURANT:
      case AdLinkType.STORE: {
        const repository =
          linkType === AdLinkType.RESTAURANT ? this.restaurantRepository : this.storeRepository;
        if (!target || !isUUID(target) || !(await repository.exists({ where: { id: target } }))) {
          throw new BadRequestException(
            linkType === AdLinkType.RESTAURANT ? 'Restoran topilmadi' : "Do'kon topilmadi",
          );
        }
        return { linkType, linkTarget: target };
      }
      default:
        throw new BadRequestException("Noma'lum havola turi");
    }
  }
}

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function assertWindow(startsAt: Date | null, endsAt: Date | null): void {
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new BadRequestException("Tugash sanasi boshlanishdan keyin bo'lishi kerak");
  }
}

// Ilova havolani tashqi brauzerda ochadi: `javascript:`, `intent:` yoki
// oddiy `http:` (yo'lda almashtirilishi mumkin) — hammasi rad etiladi.
function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.includes('.');
  } catch {
    return false;
  }
}
