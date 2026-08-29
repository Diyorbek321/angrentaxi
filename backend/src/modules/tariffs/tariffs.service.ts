import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FareBreakdown } from './fare-breakdown';
import { Tariff } from '../../database/entities/tariff.entity';
import { CreateTariffDto } from './dto/create-tariff.dto';
import { UpdateTariffDto } from './dto/update-tariff.dto';

@Injectable()
export class TariffsService {
  constructor(
    @InjectRepository(Tariff)
    private readonly tariffRepository: Repository<Tariff>,
  ) {}

  async findAll(serviceType = 'taxi'): Promise<Tariff[]> {
    // tier first so taxi tiers display Start -> Biznes regardless of
    // insertion order; cargo tariffs all share tier's default (1), so they
    // still fall back to creation order.
    return this.tariffRepository.find({
      where: { isActive: true, serviceType },
      order: { tier: 'ASC', createdAt: 'ASC' },
    });
  }

  async findAllIncludingInactive(): Promise<Tariff[]> {
    return this.tariffRepository.find({ order: { createdAt: 'ASC' } });
  }

  async findById(id: string): Promise<Tariff> {
    const tariff = await this.tariffRepository.findOne({ where: { id } });
    if (!tariff) {
      throw new NotFoundException(`Tariff with id ${id} not found`);
    }
    return tariff;
  }

  private validatePriceBounds(minPrice: number, maxPrice: number | null | undefined): void {
    if (maxPrice != null && maxPrice < minPrice) {
      throw new BadRequestException('maxPrice must be greater than or equal to minPrice');
    }
  }

  async create(dto: CreateTariffDto): Promise<Tariff> {
    this.validatePriceBounds(dto.minPrice, dto.maxPrice);

    return this.tariffRepository.save({
      name: dto.name,
      basePrice: dto.basePrice,
      pricePerKm: dto.pricePerKm,
      pricePerMin: dto.pricePerMin,
      minPrice: dto.minPrice,
      maxPrice: dto.maxPrice ?? null,
      isActive: dto.isActive ?? true,
    });
  }

  async update(id: string, dto: UpdateTariffDto): Promise<Tariff> {
    const tariff = await this.findById(id);

    const updated = {
      ...tariff,
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
      ...(dto.pricePerKm !== undefined && { pricePerKm: dto.pricePerKm }),
      ...(dto.pricePerMin !== undefined && { pricePerMin: dto.pricePerMin }),
      ...(dto.minPrice !== undefined && { minPrice: dto.minPrice }),
      ...(dto.maxPrice !== undefined && { maxPrice: dto.maxPrice }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    this.validatePriceBounds(updated.minPrice, updated.maxPrice);

    return this.tariffRepository.save(updated);
  }

  /**
   * [zoneSurge], when given, is the live demand-based multiplier for the pickup
   * area (see SurgeService). It does not replace the tariff's own
   * `surgeMultiplier` — the higher of the two wins, so an admin who sets a
   * manual multiplier for a holiday keeps it as a floor while the automatic
   * one can still react to a rush hour above it.
   */
  calculatePrice(
    tariff: Tariff,
    distanceKm: number,
    durationMin: number,
    zoneSurge?: number,
  ): number {
    return this.calculatePriceBreakdown(
      tariff,
      distanceKm,
      durationMin,
      zoneSurge,
    ).total;
  }

  /**
   * Narxni qatorlarga ajratib hisoblaydi — chek uchun.
   *
   * `calculatePrice` shu metodning ustidagi yupqa qobiq. Ular ATAYLAB bitta
   * hisob-kitobdan chiqadi: ikkita alohida formula yozilsa, ular vaqt o'tishi
   * bilan ajralib ketadi va chekdagi summa undirilgan summadan farq qila
   * boshlaydi — bu esa eng yomon xato turi, chunki u jimgina yuzaga keladi.
   *
   * Qatorlar tartibi hisob-kitob tartibini aks ettiradi:
   *   asos + masofa + vaqt  →  eng kam haq  →  koeffitsient  →  yuqori chegara
   *
   * ⚠️ KUTISH HAQI BU YERDA HISOBLANMAYDI va ataylab shunday. Kutish safar
   * BOSHLANISHIDAN oldingi vaqtga bog'liq (`orders.arrived_at` → safar
   * boshlanishi), ya'ni narx baholanayotgan lahzada u hali mavjud emas.
   * U safar yakunlanganda, `withWaitingFare` orqali BITTA joyda qo'shiladi
   * (`orders-completion.service.ts`) — shu sababli qat'iy narxli va
   * hisoblagichli safarlar kutish uchun AYNAN bir xil qoidadan o'tadi.
   */
  calculatePriceBreakdown(
    tariff: Tariff,
    distanceKm: number,
    durationMin: number,
    zoneSurge?: number,
  ): FareBreakdown {
    const baseFare = tariff.basePrice;
    const distanceFare = distanceKm * tariff.pricePerKm;
    const timeFare = durationMin * tariff.pricePerMin;
    const subtotal = baseFare + distanceFare + timeFare;

    // Eng kam haq — `Math.max(minPrice, subtotal)` ning qator ko'rinishi.
    const minPriceAdjustment = Math.max(0, tariff.minPrice - subtotal);
    const afterMin = subtotal + minPriceAdjustment;

    const surgeMultiplier = Math.max(
      tariff.surgeMultiplier ?? 1.0,
      zoneSurge ?? 1.0,
    );
    const surgeFare = afterMin * (surgeMultiplier - 1);
    const afterSurge = afterMin + surgeFare;

    // Yuqori chegara har doim MANFIY (yoki 0) — shunda u jamiga
    // to'g'ridan-to'g'ri qo'shiladi va invariant saqlanadi.
    const maxPriceCap =
      tariff.maxPrice != null ? Math.min(0, tariff.maxPrice - afterSurge) : 0;

    return {
      baseFare,
      distanceKm,
      pricePerKm: tariff.pricePerKm,
      distanceFare,
      durationMin,
      pricePerMin: tariff.pricePerMin,
      timeFare,
      minPriceAdjustment,
      surgeMultiplier,
      surgeFare,
      maxPriceCap,
      // Baholash lahzasida kutish yo'q — qatorlar mavjud, lekin nol.
      // Ular tarkibda HAR DOIM bo'lishi shart: mobil ilova maydon bor-yo'qligini
      // tekshirmasdan o'qiy olsin (eski jsonb qatorlaridan farqli o'laroq).
      waitingMinutes: 0,
      waitingFare: 0,
      total: afterSurge + maxPriceCap,
    };
  }

  async setSurgeMultiplier(id: string, multiplier: number): Promise<Tariff> {
    if (multiplier < 1.0 || multiplier > 3.0) {
      throw new BadRequestException(
        'Surge multiplier must be between 1.0 and 3.0',
      );
    }

    const tariff = await this.findById(id);

    return this.tariffRepository.save({
      ...tariff,
      surgeMultiplier: multiplier,
    });
  }

  async calculatePriceByTariffId(
    tariffId: string,
    distanceKm: number,
    durationMin: number,
    zoneSurge?: number,
  ): Promise<number> {
    const tariff = await this.findById(tariffId);
    return this.calculatePrice(tariff, distanceKm, durationMin, zoneSurge);
  }
}
