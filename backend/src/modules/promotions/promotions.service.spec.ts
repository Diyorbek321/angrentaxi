import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import {
  Promotion,
  PromotionDiscountType,
  PromotionScope,
  PromotionVendorType,
} from '../../database/entities/promotion.entity';
import { ServiceType } from '../../database/entities/order.entity';

describe('PromotionsService', () => {
  const NOW = new Date('2026-10-16T10:00:00Z');
  const R = PromotionVendorType.RESTAURANT;

  const row = (overrides: Partial<Promotion> = {}): Promotion => ({
    id: 'p1',
    vendorType: R,
    vendorId: 'rest-1',
    title: 'Kechki aksiya',
    description: null,
    discountType: PromotionDiscountType.PERCENT,
    discountValue: 10,
    scope: PromotionScope.ALL,
    categoryIds: [],
    itemIds: [],
    minOrderAmount: null,
    startsAt: new Date('2026-10-01T00:00:00Z'),
    endsAt: null,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });

  let promotionRepo: Record<string, jest.Mock>;
  let dishRepo: { find: jest.Mock };
  let menuCategoryRepo: { count: jest.Mock };
  let productRepo: { find: jest.Mock };
  let marketCategoryRepo: { count: jest.Mock };
  let restaurantRepo: { find: jest.Mock };
  let storeRepo: { find: jest.Mock };
  let service: PromotionsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    promotionRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 'new-id', ...x })),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    dishRepo = { find: jest.fn().mockResolvedValue([]) };
    menuCategoryRepo = { count: jest.fn().mockResolvedValue(0) };
    productRepo = { find: jest.fn().mockResolvedValue([]) };
    marketCategoryRepo = { count: jest.fn().mockResolvedValue(0) };
    restaurantRepo = { find: jest.fn().mockResolvedValue([]) };
    storeRepo = { find: jest.fn().mockResolvedValue([]) };
    service = new PromotionsService(
      promotionRepo as never,
      dishRepo as never,
      menuCategoryRepo as never,
      productRepo as never,
      marketCategoryRepo as never,
      restaurantRepo as never,
      storeRepo as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  describe('create', () => {
    it('saves a percent promotion owned by the vendor (startsAt defaults to now)', async () => {
      const saved = await service.create(R, 'rest-1', {
        title: 'Kechki aksiya',
        discountType: PromotionDiscountType.PERCENT,
        discountValue: 20,
      });
      expect(saved).toMatchObject({
        vendorType: R,
        vendorId: 'rest-1',
        scope: PromotionScope.ALL,
        categoryIds: [],
        itemIds: [],
        startsAt: NOW,
        endsAt: null,
        isActive: true,
      });
    });

    it.each([0, 91, 150])('rejects percent %p (must be 1–90)', async (value) => {
      await expect(
        service.create(R, 'rest-1', { title: 'x', discountType: PromotionDiscountType.PERCENT, discountValue: value }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a fixed discount not smaller than an item price (scope=items)', async () => {
      dishRepo.find.mockResolvedValue([{ id: 'd1', price: 15000 }]);
      await expect(
        service.create(R, 'rest-1', {
          title: 'x',
          discountType: PromotionDiscountType.FIXED,
          discountValue: 15000,
          scope: PromotionScope.ITEMS,
          itemIds: ['d1'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects items/categories that belong to another vendor", async () => {
      dishRepo.find.mockResolvedValue([]); // d-foreign is not in rest-1
      await expect(
        service.create(R, 'rest-1', {
          title: 'x',
          discountType: PromotionDiscountType.PERCENT,
          discountValue: 10,
          scope: PromotionScope.ITEMS,
          itemIds: ['d-foreign'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      menuCategoryRepo.count.mockResolvedValue(0);
      await expect(
        service.create(R, 'rest-1', {
          title: 'x',
          discountType: PromotionDiscountType.PERCENT,
          discountValue: 10,
          scope: PromotionScope.CATEGORY,
          categoryIds: ['c-foreign'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects endsAt before startsAt', async () => {
      await expect(
        service.create(R, 'rest-1', {
          title: 'x',
          discountType: PromotionDiscountType.PERCENT,
          discountValue: 10,
          startsAt: '2026-10-20T00:00:00Z',
          endsAt: '2026-10-19T00:00:00Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('ownership', () => {
    it('update/remove look the row up by id AND vendor — another vendor gets 404', async () => {
      promotionRepo.findOne.mockResolvedValue(null);
      await expect(service.update(R, 'rest-2', 'p1', { title: 'y' })).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.remove(R, 'rest-2', 'p1')).rejects.toBeInstanceOf(NotFoundException);
      expect(promotionRepo.findOne).toHaveBeenCalledWith({ where: { id: 'p1', vendorType: R, vendorId: 'rest-2' } });
    });

    it('update re-validates the merged result', async () => {
      promotionRepo.findOne.mockResolvedValue(row());
      await expect(service.update(R, 'rest-1', 'p1', { discountValue: 95 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      const updated = await service.update(R, 'rest-1', 'p1', { title: 'Yangi', isActive: false });
      expect(updated).toMatchObject({ id: 'p1', title: 'Yangi', isActive: false });
    });
  });

  describe('active reads', () => {
    it('activeByVendor drops expired rows and groups by vendor', async () => {
      promotionRepo.find.mockResolvedValue([
        row({ id: 'a', vendorId: 'rest-1' }),
        row({ id: 'b', vendorId: 'rest-2' }),
        row({ id: 'c', vendorId: 'rest-1', endsAt: new Date('2026-10-15T00:00:00Z') }),
      ]);
      const map = await service.activeByVendor(R);
      expect(map.get('rest-1')?.map((p) => p.id)).toEqual(['a']);
      expect(map.get('rest-2')?.map((p) => p.id)).toEqual(['b']);
    });

    it('activeFeed returns the spec shape, strongest first, only for active vendors', async () => {
      promotionRepo.find.mockResolvedValue([
        row({ id: 'small', vendorId: 'rest-1', discountValue: 5 }),
        row({ id: 'big', vendorId: 'rest-1', discountValue: 30, description: 'Hammasiga' }),
        row({ id: 'hidden', vendorId: 'rest-closed', discountValue: 50 }),
      ]);
      restaurantRepo.find.mockResolvedValue([{ id: 'rest-1', name: 'Oshxona', imageKey: 'catalog/a.jpg' }]);

      const feed = await service.activeFeed(ServiceType.FOOD);

      expect(feed.map((f) => f.id)).toEqual(['big', 'small']);
      expect(feed[0]).toEqual({
        id: 'big',
        title: 'Kechki aksiya',
        description: 'Hammasiga',
        discountType: 'percent',
        discountValue: 30,
        vendorType: 'restaurant',
        vendorId: 'rest-1',
        vendorName: 'Oshxona',
        vendorImageKey: 'catalog/a.jpg',
        endsAt: null,
      });
      expect(storeRepo.find).not.toHaveBeenCalled();
    });
  });
});
