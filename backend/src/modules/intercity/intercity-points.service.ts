import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntercityPoint } from '../../database/entities/intercity-point.entity';
import { CreateIntercityPointDto } from './dto/create-intercity-point.dto';
import { UpdateIntercityPointDto } from './dto/update-intercity-point.dto';
import { assertIntercityPointExtension } from './intercity-point-policy';

/**
 * Shaharlararo yo'nalish uchlari (Angren, Rohat krugi (Toshkent)...).
 *
 * Nuqta o'chirilmaydi, faqat `isActive = false` qilinadi — unga bog'langan
 * yo'nalishlar va qatnovlar tarixi ma'nosini yo'qotmasin (FK RESTRICT).
 */
@Injectable()
export class IntercityPointsService {
  constructor(
    @InjectRepository(IntercityPoint)
    private readonly pointRepository: Repository<IntercityPoint>,
  ) {}

  /** Admin paneli uchun — nofaollari bilan. */
  async findAll(): Promise<IntercityPoint[]> {
    return this.pointRepository.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async create(dto: CreateIntercityPointDto): Promise<IntercityPoint> {
    const point = {
      name: dto.name.trim(),
      centerLat: dto.centerLat,
      centerLng: dto.centerLng,
      radiusKm: dto.radiusKm,
      extensionMaxKm: dto.extensionMaxKm ?? 0,
      extensionPricePerKm: dto.extensionPricePerKm ?? 0,
      extensionComfortPricePerKm: dto.extensionComfortPricePerKm ?? null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    };
    assertIntercityPointExtension(point);
    return this.pointRepository.save(this.pointRepository.create(point));
  }

  /**
   * Qoida BIRLASHTIRILGAN natijaga qo'llanadi: faqat radiusni kichraytirish
   * ham mavjud davom chegarasini radiusdan kichik qilib qo'yishi mumkin.
   */
  async update(id: string, dto: UpdateIntercityPointDto): Promise<IntercityPoint> {
    const existing = await this.findOneOrThrow(id);
    const changes = Object.fromEntries(
      Object.entries({ ...dto, name: dto.name?.trim() }).filter(([, value]) => value !== undefined),
    );
    const merged = { ...existing, ...changes };
    assertIntercityPointExtension(merged);
    return this.pointRepository.save(merged);
  }

  /**
   * Yangi yo'nalish uchun nuqta: yo'q bo'lsa 404, faol emas bo'lsa 400.
   * O'chirilgan nuqtaga yangi yo'nalish ochish — yo'lovchiga ko'rinmaydigan
   * (`listPublic` uni yashiradi) va shuning uchun hech kim sezmaydigan xato.
   */
  async getActiveOrThrow(id: string): Promise<IntercityPoint> {
    const point = await this.findOneOrThrow(id);
    if (!point.isActive) {
      throw new BadRequestException(`"${point.name}" nuqtasi faol emas`);
    }
    return point;
  }

  private async findOneOrThrow(id: string): Promise<IntercityPoint> {
    const point = await this.pointRepository.findOne({ where: { id } });
    if (!point) {
      throw new NotFoundException('Shaharlararo nuqta topilmadi');
    }
    return point;
  }
}
