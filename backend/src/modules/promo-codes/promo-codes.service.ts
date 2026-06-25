import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromoCode } from '../../database/entities/promo_code.entity';
import { PromoCodeUsage } from '../../database/entities/promo_code_usage.entity';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';

export interface ValidatePromoResult {
  promoCodeId: string;
  discountAmount: number;
  finalAmount: number;
}

@Injectable()
export class PromoCodesService {
  constructor(
    @InjectRepository(PromoCode)
    private readonly promoCodeRepository: Repository<PromoCode>,
    @InjectRepository(PromoCodeUsage)
    private readonly promoCodeUsageRepository: Repository<PromoCodeUsage>,
  ) {}

  async validate(
    code: string,
    userId: string,
    orderAmount: number,
  ): Promise<ValidatePromoResult> {
    const promoCode = await this.promoCodeRepository.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!promoCode) {
      throw new BadRequestException('Promo code not found');
    }

    if (!promoCode.isActive) {
      throw new BadRequestException('Promo code is no longer active');
    }

    if (promoCode.expiresAt !== null && new Date() > promoCode.expiresAt) {
      throw new BadRequestException('Promo code has expired');
    }

    if (promoCode.maxUses !== null && promoCode.usedCount >= promoCode.maxUses) {
      throw new BadRequestException('Promo code usage limit has been reached');
    }

    if (orderAmount < promoCode.minOrderAmount) {
      throw new BadRequestException(
        `Minimum order amount for this promo code is ${promoCode.minOrderAmount} UZS`,
      );
    }

    const existingUsage = await this.promoCodeUsageRepository.findOne({
      where: { promoCodeId: promoCode.id, userId },
    });

    if (existingUsage) {
      throw new BadRequestException('You have already used this promo code');
    }

    const discountAmount = this.calculateDiscount(promoCode, orderAmount);
    const finalAmount = Math.max(0, orderAmount - discountAmount);

    return {
      promoCodeId: promoCode.id,
      discountAmount,
      finalAmount,
    };
  }

  async apply(promoCodeId: string, userId: string, orderId: string): Promise<void> {
    const promoCode = await this.promoCodeRepository.findOne({ where: { id: promoCodeId } });

    if (!promoCode) {
      throw new NotFoundException(`Promo code with id ${promoCodeId} not found`);
    }

    await this.promoCodeRepository.update(promoCodeId, {
      usedCount: promoCode.usedCount + 1,
    });

    await this.promoCodeUsageRepository.save({
      promoCodeId,
      userId,
      orderId,
    });
  }

  async create(dto: CreatePromoCodeDto): Promise<PromoCode> {
    const existing = await this.promoCodeRepository.findOne({
      where: { code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new BadRequestException(`Promo code '${dto.code.toUpperCase()}' already exists`);
    }

    return this.promoCodeRepository.save({
      code: dto.code.toUpperCase(),
      discountPercent: dto.discountPercent ?? null,
      discountFixed: dto.discountFixed ?? null,
      maxUses: dto.maxUses ?? null,
      minOrderAmount: dto.minOrderAmount ?? 0,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isActive: true,
      usedCount: 0,
    });
  }

  async findAll(): Promise<PromoCode[]> {
    return this.promoCodeRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async deactivate(id: string): Promise<PromoCode> {
    const promoCode = await this.promoCodeRepository.findOne({ where: { id } });

    if (!promoCode) {
      throw new NotFoundException(`Promo code with id ${id} not found`);
    }

    return this.promoCodeRepository.save({ ...promoCode, isActive: false });
  }

  private calculateDiscount(promoCode: PromoCode, orderAmount: number): number {
    if (promoCode.discountPercent !== null) {
      return Math.round((orderAmount * promoCode.discountPercent) / 100);
    }

    if (promoCode.discountFixed !== null) {
      return Math.min(promoCode.discountFixed, orderAmount);
    }

    return 0;
  }
}
