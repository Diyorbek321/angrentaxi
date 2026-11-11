import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PromoCode } from '../../database/entities/promo_code.entity';
import { PromoCodeUsage } from '../../database/entities/promo_code_usage.entity';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { ServiceType } from '../../database/entities/order.entity';
import { ERROR_CODES, codedBadRequest } from '../../common/errors/coded-error';

export interface ValidatePromoResult {
  promoCodeId: string;
  discountAmount: number;
  finalAmount: number;
}

export interface ValidatePromoOptions {
  /** Berilsa — `promo_codes.service_types` bilan solishtiriladi. */
  serviceType?: ServiceType;
}

/** `POST /promo-codes/validate` javobi (docs/specs/food-market-ux-v5.md §2). */
export interface PromoCheckResult extends Partial<ValidatePromoResult> {
  valid: boolean;
  /** Muvaffaqiyatda — promokod; `valid:false` da — xato kodi. */
  code: string;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  message?: string;
}

/** Ovqat/market buyurtmasi — promokod ishlatilishi shu buyurtmaga yoziladi. */
export interface VendorOrderRef {
  kind: 'food' | 'market';
  id: string;
}

const PROMO_NOT_APPLICABLE_MESSAGE = "Bu promokod ushbu xizmatda amal qilmaydi";

@Injectable()
export class PromoCodesService {
  constructor(
    @InjectRepository(PromoCode)
    private readonly promoCodeRepository: Repository<PromoCode>,
    @InjectRepository(PromoCodeUsage)
    private readonly promoCodeUsageRepository: Repository<PromoCodeUsage>,
  ) {}

  /**
   * `orderAmount = null` — summa noma'lum (ilova faqat kodni tekshiryapti):
   * eng kam summa tekshiruvi o'tkaziladi, chegirma 0.
   */
  async validate(
    code: string,
    userId: string,
    orderAmount: number | null,
    options: ValidatePromoOptions = {},
  ): Promise<ValidatePromoResult> {
    const promoCode = await this.checkUsable(code, userId, orderAmount, options);
    const amount = orderAmount ?? 0;
    const discountAmount = this.calculateDiscount(promoCode, amount);
    const finalAmount = Math.max(0, amount - discountAmount);

    return {
      promoCodeId: promoCode.id,
      discountAmount,
      finalAmount,
    };
  }

  /**
   * Ilova uchun tekshiruv. Xizmat turi mos kelmasa — 200 `{ valid:false,
   * code:'PROMO_NOT_APPLICABLE' }`; boshqa xatolar avvalgidek 400 (eski
   * taksi ilovasi shunga tayanadi).
   */
  async describe(
    code: string,
    userId: string,
    input: { serviceType?: ServiceType; amount?: number | null },
  ): Promise<PromoCheckResult> {
    let result: ValidatePromoResult;
    try {
      result = await this.validate(code, userId, input.amount ?? null, { serviceType: input.serviceType });
    } catch (err) {
      const body = err instanceof BadRequestException ? (err.getResponse() as { code?: string }) : null;
      if (body?.code === ERROR_CODES.promoNotApplicable) {
        return { valid: false, code: ERROR_CODES.promoNotApplicable, message: PROMO_NOT_APPLICABLE_MESSAGE };
      }
      throw err;
    }
    const promoCode = await this.findById(result.promoCodeId);
    const isPercent = promoCode.discountPercent !== null;
    return {
      valid: true,
      code: promoCode.code,
      discountType: isPercent ? 'percent' : 'fixed',
      discountValue: Number(isPercent ? promoCode.discountPercent : promoCode.discountFixed ?? 0),
      ...result,
    };
  }

  private async checkUsable(
    code: string,
    userId: string,
    orderAmount: number | null,
    options: ValidatePromoOptions,
  ): Promise<PromoCode> {
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

    if (
      options.serviceType &&
      Array.isArray(promoCode.serviceTypes) &&
      promoCode.serviceTypes.length > 0 &&
      !promoCode.serviceTypes.includes(options.serviceType)
    ) {
      throw codedBadRequest(ERROR_CODES.promoNotApplicable, PROMO_NOT_APPLICABLE_MESSAGE);
    }

    if (orderAmount !== null && orderAmount < promoCode.minOrderAmount) {
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

    return promoCode;
  }

  async findById(id: string): Promise<PromoCode> {
    const promoCode = await this.promoCodeRepository.findOne({ where: { id } });
    if (!promoCode) {
      throw new NotFoundException(`Promo code with id ${id} not found`);
    }
    return promoCode;
  }

  /**
   * `manager` — safar yakunining tranzaksiyasi: hisoblagich va foydalanish
   * yozuvi pul yozuvlari bilan birga commit/rollback bo'ladi. Aks holda
   * rollback'dan keyin promokod "yeyilgan" bo'lib qolar, qayta urinish esa
   * ikkinchi foydalanishni yerdi.
   */
  async apply(promoCodeId: string, userId: string, orderId: string, manager?: EntityManager): Promise<void> {
    const promoRepo = manager?.getRepository(PromoCode) ?? this.promoCodeRepository;
    const usageRepo = manager?.getRepository(PromoCodeUsage) ?? this.promoCodeUsageRepository;
    await this.claimUse(promoCodeId, promoRepo);
    await usageRepo.save({
      promoCodeId,
      userId,
      orderId,
    });
  }

  /**
   * Ovqat/market: ishlatish buyurtma YARATILGANDA band qilinadi (chegirma
   * darhol summaga kiradi — mijoz shu summani to'laydi). Bekor qilinsa
   * `releaseForVendorOrder` qaytaradi — taksidagi "bekor qilingan safar
   * promokodni yemaydi" qoidasi bilan bir xil natija.
   */
  async claimForVendorOrder(promoCodeId: string, userId: string, ref: VendorOrderRef): Promise<void> {
    await this.claimUse(promoCodeId);
    await this.promoCodeUsageRepository.save({
      promoCodeId,
      userId,
      orderId: null,
      foodOrderId: ref.kind === 'food' ? ref.id : null,
      marketOrderId: ref.kind === 'market' ? ref.id : null,
    });
  }

  async releaseForVendorOrder(promoCodeId: string, userId: string, ref: VendorOrderRef): Promise<void> {
    const removed = await this.promoCodeUsageRepository.delete({
      promoCodeId,
      userId,
      ...(ref.kind === 'food' ? { foodOrderId: ref.id } : { marketOrderId: ref.id }),
    });
    if (!removed.affected) return;
    await this.promoCodeRepository
      .createQueryBuilder()
      .update(PromoCode)
      .set({ usedCount: () => 'GREATEST("used_count" - 1, 0)' })
      .where('id = :id', { id: promoCodeId })
      .execute();
  }

  private async claimUse(
    promoCodeId: string,
    promoRepo: Repository<PromoCode> = this.promoCodeRepository,
  ): Promise<void> {
    const promoCode = await promoRepo.findOne({ where: { id: promoCodeId } });

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
    const result = await promoRepo
      .createQueryBuilder()
      .update(PromoCode)
      .set({ usedCount: () => '"used_count" + 1' })
      .where('id = :id', { id: promoCodeId })
      .andWhere('(max_uses IS NULL OR used_count < max_uses)')
      .execute();

    if (!result.affected) {
      throw new BadRequestException('Promo code usage limit has been reached');
    }
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
      serviceTypes: dto.serviceTypes && dto.serviceTypes.length > 0 ? [...new Set(dto.serviceTypes)] : null,
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
