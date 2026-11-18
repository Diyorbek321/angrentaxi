import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Store } from '../../database/entities/store.entity';
import { MarketCategory } from '../../database/entities/market-category.entity';
import { Product } from '../../database/entities/product.entity';
import { StockMovement } from '../../database/entities/stock-movement.entity';
import { MarketOrder } from '../../database/entities/market-order.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService } from '../users/users.service';
import { OrdersService } from '../orders/orders.service';
import { MatchingService } from '../matching/matching.service';
import { TariffsService } from '../tariffs/tariffs.service';
import { SettingsService } from '../settings/settings.service';
import { MarketService } from './market.service';

import * as summary from './vendor-catalog-summary';

/** Kategoriyalar va Zaxira sahifalari endi butun katalogni olmaydi — sanash bazada. */
describe('MarketService — vendor catalogue summaries', () => {
  const STORE_ID = 'store-1';
  let service: MarketService;
  let categoryFind: jest.Mock;

  beforeEach(async () => {
    categoryFind = jest.fn().mockResolvedValue([
      { id: 'c1', name: 'Sut', sortOrder: 0 },
      { id: 'c2', name: 'Non', sortOrder: 1 },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        {
          provide: getRepositoryToken(Store),
          useValue: {
            findOneOrFail: jest.fn().mockResolvedValue({
              id: STORE_ID,
              name: 'Test Do‘kon',
              lowStockThreshold: 5,
            }),
          },
        },
        { provide: getRepositoryToken(MarketCategory), useValue: { find: categoryFind } },
        {
          provide: getRepositoryToken(Product),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        { provide: getRepositoryToken(StockMovement), useValue: {} },
        {
          provide: getRepositoryToken(MarketOrder),
          useValue: {},
        },
        { provide: getRepositoryToken(Transaction), useValue: {} },
        { provide: RealtimeGateway, useValue: { emitToUser: jest.fn() } },
        { provide: UsersService, useValue: {} },
        { provide: OrdersService, useValue: { findByIdOrThrow: jest.fn() } },
        { provide: MatchingService, useValue: {} },
        { provide: TariffsService, useValue: {} },
        // Order creation reads the platform delivery fee; the vendor-query
        // tests never create an order, so a fixed value is enough.
        {
          provide: SettingsService,
          useValue: {
            getDeliveryFee: jest.fn().mockResolvedValue(7000),
            getDeliveryPricing: jest.fn().mockResolvedValue({ deliveryFee: 7000, freeDeliveryFrom: 0 }),
          },
        },
      ],
    }).compile();

    service = module.get<MarketService>(MarketService);
  });

  afterEach(() => jest.restoreAllMocks());

  it("har kategoriyaga productCount qo'shadi, mahsulotsiz kategoriya — 0", async () => {
    jest.spyOn(summary, 'countProductsByCategory').mockResolvedValue({ c1: 7 });

    const result = await service.listCategoriesWithCounts(STORE_ID);

    expect(categoryFind).toHaveBeenCalledWith({ where: { storeId: STORE_ID }, order: { sortOrder: 'ASC' } });
    expect(result.map((c) => [c.id, c.productCount])).toEqual([
      ['c1', 7],
      ['c2', 0],
    ]);
  });

  it("zaxira xulosasi do'konning o'z chegarasi bilan", async () => {
    const spy = jest.spyOn(summary, 'vendorStockSummary').mockResolvedValue({
      threshold: 5,
      totalCount: 9,
      outCount: 1,
      lowCount: 2,
      restockTotal: 3,
      restock: [],
    });

    await service.stockSummary({ id: STORE_ID, lowStockThreshold: 5 });

    expect(spy).toHaveBeenCalledWith(expect.anything(), STORE_ID, 5);
  });
});
