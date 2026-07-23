import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  calculatePrice(
    tariff: Tariff,
    distanceKm: number,
    durationMin: number,
  ): number {
    const baseTotal =
      tariff.basePrice +
      distanceKm * tariff.pricePerKm +
      durationMin * tariff.pricePerMin;

    const raw = Math.max(tariff.minPrice, baseTotal) * (tariff.surgeMultiplier ?? 1.0);

    return tariff.maxPrice != null ? Math.min(raw, tariff.maxPrice) : raw;
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
  ): Promise<number> {
    const tariff = await this.findById(tariffId);
    return this.calculatePrice(tariff, distanceKm, durationMin);
  }
}
