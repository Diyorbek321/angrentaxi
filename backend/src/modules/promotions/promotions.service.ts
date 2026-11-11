import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import {
  Promotion,
  PromotionDiscountType,
  PromotionScope,
  PromotionVendorType,
} from '../../database/entities/promotion.entity';
import { Dish } from '../../database/entities/dish.entity';
import { MenuCategory } from '../../database/entities/menu-category.entity';
import { Product } from '../../database/entities/product.entity';
import { MarketCategory } from '../../database/entities/market-category.entity';
import { Restaurant, RestaurantStatus } from '../../database/entities/restaurant.entity';
import { Store, StoreStatus } from '../../database/entities/store.entity';
import { ServiceType } from '../../database/entities/order.entity';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto';
import { compareStrength, isPromotionActive } from './promotion-pricing';

const PERCENT_MIN = 1;
const PERCENT_MAX = 90;
/** Bosh ekran lentasi uchun yuqori chegara (kichik shahar — bir necha o'nlab aksiya). */
const FEED_SCAN_LIMIT = 500;

/** `GET /promotions/active` elementi (spec §4). */
export interface ActivePromotionFeedItem {
  id: string;
  title: string;
  description: string | null;
  discountType: PromotionDiscountType;
  discountValue: number;
  vendorType: PromotionVendorType;
  vendorId: string;
  vendorName: string;
  vendorImageKey: string | null;
  endsAt: Date | null;
}

interface FeedVendor {
  id: string;
  name: string;
  imageKey: string | null;
}

type PromotionDraft = Pick<
  Promotion,
  | 'title'
  | 'description'
  | 'discountType'
  | 'discountValue'
  | 'scope'
  | 'categoryIds'
  | 'itemIds'
  | 'minOrderAmount'
  | 'startsAt'
  | 'endsAt'
  | 'isActive'
>;

/**
 * Sotuvchi aksiyalari: CRUD (egalik — har so'rov `vendorType + vendorId`
 * bilan cheklanadi, begona aksiya 404) va vitrina uchun faol aksiyalar.
 * Narx hisobi — `promotion-pricing.ts`.
 */
@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion) private readonly promotionRepo: Repository<Promotion>,
    @InjectRepository(Dish) private readonly dishRepo: Repository<Dish>,
    @InjectRepository(MenuCategory) private readonly menuCategoryRepo: Repository<MenuCategory>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(MarketCategory) private readonly marketCategoryRepo: Repository<MarketCategory>,
    @InjectRepository(Restaurant) private readonly restaurantRepo: Repository<Restaurant>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
  ) {}

  // ---------- vendor CRUD ----------

  listForVendor(vendorType: PromotionVendorType, vendorId: string): Promise<Promotion[]> {
    return this.promotionRepo.find({ where: { vendorType, vendorId }, order: { createdAt: 'DESC' } });
  }

  async create(vendorType: PromotionVendorType, vendorId: string, dto: CreatePromotionDto): Promise<Promotion> {
    const draft: PromotionDraft = {
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      scope: dto.scope ?? PromotionScope.ALL,
      categoryIds: dto.categoryIds ?? [],
      itemIds: dto.itemIds ?? [],
      minOrderAmount: dto.minOrderAmount ?? null,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : new Date(),
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      isActive: dto.isActive ?? true,
    };
    const normalized = await this.validateDraft(vendorType, vendorId, draft);
    return this.promotionRepo.save(this.promotionRepo.create({ ...normalized, vendorType, vendorId }));
  }

  async update(
    vendorType: PromotionVendorType,
    vendorId: string,
    id: string,
    dto: UpdatePromotionDto,
  ): Promise<Promotion> {
    const existing = await this.findOwned(vendorType, vendorId, id);
    const merged: PromotionDraft = {
      title: dto.title !== undefined ? dto.title.trim() : existing.title,
      description: dto.description !== undefined ? dto.description?.trim() || null : existing.description,
      discountType: dto.discountType ?? existing.discountType,
      discountValue: dto.discountValue ?? Number(existing.discountValue),
      scope: dto.scope ?? existing.scope,
      categoryIds: dto.categoryIds ?? existing.categoryIds ?? [],
      itemIds: dto.itemIds ?? existing.itemIds ?? [],
      minOrderAmount: dto.minOrderAmount !== undefined ? dto.minOrderAmount : existing.minOrderAmount,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : existing.startsAt,
      endsAt: dto.endsAt !== undefined ? (dto.endsAt ? new Date(dto.endsAt) : null) : existing.endsAt,
      isActive: dto.isActive ?? existing.isActive,
    };
    const normalized = await this.validateDraft(vendorType, vendorId, merged);
    return this.promotionRepo.save({ ...existing, ...normalized });
  }

  async remove(vendorType: PromotionVendorType, vendorId: string, id: string): Promise<{ id: string }> {
    const existing = await this.findOwned(vendorType, vendorId, id);
    await this.promotionRepo.remove(existing);
    return { id };
  }

  private async findOwned(vendorType: PromotionVendorType, vendorId: string, id: string): Promise<Promotion> {
    const promotion = await this.promotionRepo.findOne({ where: { id, vendorType, vendorId } });
    if (!promotion) {
      throw new NotFoundException('Aksiya topilmadi');
    }
    return promotion;
  }

  private async validateDraft(
    vendorType: PromotionVendorType,
    vendorId: string,
    draft: PromotionDraft,
  ): Promise<PromotionDraft> {
    const value = Number(draft.discountValue);
    if (draft.discountType === PromotionDiscountType.PERCENT && !(value >= PERCENT_MIN && value <= PERCENT_MAX)) {
      throw new BadRequestException("Foizli chegirma 1 dan 90 gacha bo'lishi kerak");
    }
    if (draft.discountType === PromotionDiscountType.FIXED && !(value > 0)) {
      throw new BadRequestException("Chegirma summasi 0 dan katta bo'lishi kerak");
    }
    if (draft.endsAt && draft.endsAt.getTime() <= draft.startsAt.getTime()) {
      throw new BadRequestException('Aksiya tugash vaqti boshlanishidan keyin bo‘lishi kerak');
    }

    const categoryIds = [...new Set(draft.categoryIds)];
    const itemIds = [...new Set(draft.itemIds)];
    if (draft.scope === PromotionScope.CATEGORY) {
      await this.assertOwnCategories(vendorType, vendorId, categoryIds);
    }
    if (draft.scope === PromotionScope.ITEMS) {
      const prices = await this.ownItemPrices(vendorType, vendorId, itemIds);
      if (draft.discountType === PromotionDiscountType.FIXED && prices.some((price) => value >= price)) {
        throw new BadRequestException('Chegirma summasi taom narxidan kichik bo‘lishi kerak');
      }
    }
    return {
      ...draft,
      discountValue: value,
      categoryIds: draft.scope === PromotionScope.CATEGORY ? categoryIds : [],
      itemIds: draft.scope === PromotionScope.ITEMS ? itemIds : [],
    };
  }

  private async assertOwnCategories(
    vendorType: PromotionVendorType,
    vendorId: string,
    categoryIds: string[],
  ): Promise<void> {
    if (categoryIds.length === 0) {
      throw new BadRequestException('Kamida bitta kategoriya tanlang');
    }
    const owned =
      vendorType === PromotionVendorType.RESTAURANT
        ? await this.menuCategoryRepo.count({ where: { id: In(categoryIds), restaurantId: vendorId } })
        : await this.marketCategoryRepo.count({ where: { id: In(categoryIds), storeId: vendorId } });
    if (owned !== categoryIds.length) {
      throw new BadRequestException('Kategoriya topilmadi');
    }
  }

  private async ownItemPrices(
    vendorType: PromotionVendorType,
    vendorId: string,
    itemIds: string[],
  ): Promise<number[]> {
    if (itemIds.length === 0) {
      throw new BadRequestException('Kamida bitta taom yoki mahsulot tanlang');
    }
    const rows: Array<{ id: string; price: number }> =
      vendorType === PromotionVendorType.RESTAURANT
        ? await this.dishRepo.find({ where: { id: In(itemIds), restaurantId: vendorId } })
        : await this.productRepo.find({ where: { id: In(itemIds), storeId: vendorId } });
    if (rows.length !== itemIds.length) {
      throw new BadRequestException('Taom yoki mahsulot topilmadi');
    }
    return rows.map((row) => Number(row.price));
  }

  // ---------- storefront ----------

  /** Bitta sotuvchining hozir faol aksiyalari (eng kattasi birinchi). */
  async activeForVendor(vendorType: PromotionVendorType, vendorId: string): Promise<Promotion[]> {
    const now = new Date();
    const rows = await this.promotionRepo.find({
      where: { vendorType, vendorId, isActive: true, startsAt: LessThanOrEqual(now) },
    });
    return rows.filter((p) => isPromotionActive(p, now)).sort(compareStrength);
  }

  /** Bir turdagi barcha sotuvchilarning faol aksiyalari, sotuvchi bo'yicha. */
  async activeByVendor(vendorType: PromotionVendorType): Promise<Map<string, Promotion[]>> {
    const now = new Date();
    const rows = await this.promotionRepo.find({
      where: { vendorType, isActive: true, startsAt: LessThanOrEqual(now) },
      take: FEED_SCAN_LIMIT,
    });
    const byVendor = new Map<string, Promotion[]>();
    for (const promotion of rows.filter((p) => isPromotionActive(p, now)).sort(compareStrength)) {
      byVendor.set(promotion.vendorId, [...(byVendor.get(promotion.vendorId) ?? []), promotion]);
    }
    return byVendor;
  }

  /** `GET /promotions/active` — faqat ochiq (active) sotuvchilar, eng katta chegirma birinchi. */
  async activeFeed(serviceType?: ServiceType | 'food' | 'market'): Promise<ActivePromotionFeedItem[]> {
    const types: PromotionVendorType[] =
      serviceType === ServiceType.FOOD
        ? [PromotionVendorType.RESTAURANT]
        : serviceType === ServiceType.MARKET
          ? [PromotionVendorType.STORE]
          : [PromotionVendorType.RESTAURANT, PromotionVendorType.STORE];

    const pairs: Array<{ promotion: Promotion; vendor: FeedVendor }> = [];
    for (const vendorType of types) {
      const byVendor = await this.activeByVendor(vendorType);
      const vendorIds = [...byVendor.keys()];
      if (vendorIds.length === 0) continue;
      const vendors: FeedVendor[] =
        vendorType === PromotionVendorType.RESTAURANT
          ? await this.restaurantRepo.find({ where: { id: In(vendorIds), status: RestaurantStatus.ACTIVE } })
          : await this.storeRepo.find({ where: { id: In(vendorIds), status: StoreStatus.ACTIVE } });
      for (const vendor of vendors) {
        for (const promotion of byVendor.get(vendor.id) ?? []) {
          pairs.push({ promotion, vendor });
        }
      }
    }
    return pairs
      .sort((a, b) => compareStrength(a.promotion, b.promotion))
      .map(({ promotion: p, vendor }) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        discountType: p.discountType,
        discountValue: Number(p.discountValue),
        vendorType: p.vendorType,
        vendorId: p.vendorId,
        vendorName: vendor.name,
        vendorImageKey: vendor.imageKey ?? null,
        endsAt: p.endsAt,
      }));
  }
}
