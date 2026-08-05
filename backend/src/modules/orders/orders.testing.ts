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
