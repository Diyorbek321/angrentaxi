import { DriversService } from './drivers.service';
import { ServiceType } from '../../database/entities/order.entity';

/**
 * `GET /drivers` (web-manager / web-admin ro'yxati) — har haydovchiga
 * `legal: { eligible, blocking, issueCount }`, BITTA guruhlangan hisobda.
 */
describe('DriversService.findAll — huquqiy xulosa', () => {
  const drivers = [
    { id: 'd-1', userId: 'u-1', serviceTypes: [ServiceType.TAXI], user: { firstName: 'A', phone: '+1' } },
    { id: 'd-2', userId: 'u-2', serviceTypes: [ServiceType.FOOD], user: { firstName: 'B', phone: '+2' } },
  ];

  function build(legalGate?: { summarizeMany: jest.Mock }) {
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(async () => [drivers.map((d) => ({ ...d })), 2]),
    };
    const driverRepository = {
      createQueryBuilder: jest.fn(() => qb),
      query: jest.fn(async () => []),
    };
    const service = new DriversService(
      driverRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      undefined,
      legalGate as never,
    );
    return { service };
  }

  it('bitta summarizeMany chaqiruvi, har haydovchiga legal maydoni', async () => {
    const gate = {
      summarizeMany: jest.fn(
        async () =>
          new Map([
            ['d-1', { eligible: false, blocking: true, issueCount: 3 }],
            ['d-2', { eligible: true, blocking: false, issueCount: 0 }],
          ]),
      ),
    };
    const result = await build(gate).service.findAll(1, 20);

    expect(gate.summarizeMany).toHaveBeenCalledTimes(1);
    expect((gate.summarizeMany.mock.calls as unknown as Array<[Array<{ id: string }>]>)[0][0].map((d) => d.id)).toEqual(['d-1', 'd-2']);
    expect(result.drivers.map((d) => (d as unknown as { legal: unknown }).legal)).toEqual([
      { eligible: false, blocking: true, issueCount: 3 },
      { eligible: true, blocking: false, issueCount: 0 },
    ]);
    expect(result.total).toBe(2);
  });

  it("xulosa xato bersa ro'yxat buzilmaydi — legal: null", async () => {
    const gate = { summarizeMany: jest.fn(async () => Promise.reject(new Error('db down'))) };
    const result = await build(gate).service.findAll(1, 20);
    expect(result.drivers.map((d) => (d as unknown as { legal: unknown }).legal)).toEqual([null, null]);
  });
});
