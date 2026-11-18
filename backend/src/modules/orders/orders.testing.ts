// Test-only wiring helper for the orders module specs.
//
// OrdersCompletionService takes a DataSource so trip settlement (order status,
// passenger charge, both driver payout legs and the wallet movement) commits
// atomically. The specs mock repositories directly rather than booting TypeORM,
// so they need a DataSource stand-in whose `transaction()` simply runs the
// callback against a manager — no real transaction, no real connection.
//
// The manager's writes are intentionally inert: no spec asserts on the
// in-transaction ledger rows (the assertions that do exist cover the referral
// bonus, which is written outside the transaction by design, and the atomic
// status transitions, which go through QueryBuilder). Should a spec ever need
// to assert on settlement writes, pass overrides for the methods it cares
// about.
import { Provider } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CitiesService } from '../cities/cities.service';

type ManagerOverrides = Partial<
  Pick<EntityManager, 'update' | 'save' | 'findOne' | 'query'>
>;

export function createFakeDataSource(overrides: ManagerOverrides = {}): DataSource {
  const manager = {
    update: async () => ({ affected: 1 }),
    save: async (_entity: unknown, value: unknown) => value,
    findOne: async () => null,
    query: async () => [],
    ...overrides,
  } as unknown as EntityManager;

  return {
    transaction: async (runInTransaction: (m: EntityManager) => Promise<unknown>) =>
      runInTransaction(manager),
  } as unknown as DataSource;
}

/** Drop-in provider for the specs' `providers` array. */
export function fakeDataSourceProvider(overrides: ManagerOverrides = {}): Provider {
  return { provide: DataSource, useValue: createFakeDataSource(overrides) };
}

/**
 * Transaction-repository stand-in for specs that exercise order creation.
 *
 * `OrdersCreationService.create` refuses a new order while the passenger has
 * an unpaid wallet charge, which it reads through a QueryBuilder aggregate.
 * Specs that only care about pricing or persistence want the "no debt" answer
 * without restating that chain; `outstandingDebt` overrides it for the specs
 * that do test the block.
 */
export function fakeTransactionRepository(
  outstandingDebt = 0,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ debt: String(outstandingDebt) }),
    })),
    ...overrides,
  };
}

/**
 * Coverage stand-in for the specs that boot `ORDERS_PROVIDERS`.
 *
 * `OrdersCreationService` resolves a pickup point to a city before writing an
 * order, so every spec that constructs the orders facade now needs a
 * `CitiesService` in the container — even the ones that never place an order.
 *
 * The default answers "coverage is not enforced", which is the shipped
 * behaviour while the `cities` table is empty: no point is rejected and
 * `city_id` stays null. That keeps these specs asserting what they were
 * written to assert instead of accidentally testing the coverage gate. Specs
 * that DO exercise the gate pass their own city list.
 */
export function fakeCitiesServiceProvider(
  cities: Array<{ id: string; centerLat: number; centerLng: number; radiusKm: number }> = [],
): Provider {
  return {
    provide: CitiesService,
    useValue: {
      isCoverageEnforced: jest.fn().mockResolvedValue(cities.length > 0),
      resolveForPoint: jest.fn().mockResolvedValue(cities[0] ?? null),
      resolveCityIdForPoint: jest.fn().mockResolvedValue(cities[0]?.id ?? null),
      listActive: jest.fn().mockResolvedValue(cities),
    },
  };
}
