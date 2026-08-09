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

  async findById(id: string): Promise<PromoCode> {
    const promoCode = await this.promoCodeRepository.findOne({ where: { id } });
    if (!promoCode) {
      throw new NotFoundException(`Promo code with id ${id} not found`);
    }
    return promoCode;
  }

  async apply(promoCodeId: string, userId: string, orderId: string): Promise<void> {
    const promoCode = await this.promoCodeRepository.findOne({ where: { id: promoCodeId } });

    if (!promoCode) {
      throw new NotFoundException(`Promo code with id ${promoCodeId} not found`);
    }

    // Atomic increment, and the max-uses ceiling is re-checked here in the
    // same statement rather than trusting the earlier validate() call.
    //
    // Read-modify-write on `usedCount` let two trips completing at the same
    // moment both read the same count and write count+1, so a code could be
    // redeemed past its maxUses — validate() reads the stale counter and both
    // callers pass. The conditional UPDATE makes the loser touch 0 rows.
    const result = await this.promoCodeRepository
      .createQueryBuilder()
      .update(PromoCode)
      .set({ usedCount: () => '"used_count" + 1' })
      .where('id = :id', { id: promoCodeId })
      .andWhere('(max_uses IS NULL OR used_count < max_uses)')
      .execute();

    if (!result.affected) {
      throw new BadRequestException('Promo code usage limit has been reached');
    }

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

  async findActive(): Promise<PromoCode[]> {
    return this.promoCodeRepository
      .createQueryBuilder('promoCode')
      .where('promoCode.isActive = :isActive', { isActive: true })
      .andWhere('(promoCode.expiresAt IS NULL OR promoCode.expiresAt > NOW())')
      .andWhere('(promoCode.maxUses IS NULL OR promoCode.usedCount < promoCode.maxUses)')
      .orderBy('promoCode.createdAt', 'DESC')
      .getMany();
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
