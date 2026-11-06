import { DriversController } from './drivers.controller';

/**
 * Security review #2: `GET /drivers` va `GET /drivers/:id` (DRIVERS_VIEW)
 * xom Driver obyektini qaytarardi — JShShIR, STIR, tug'ilgan sana har bir
 * menejerga ochiq edi. Endi bu maydonlar faqat `GET /drivers/:id/legal` da
 * (DRIVERS_APPROVE'siz — niqoblangan).
 */
describe('DriversController — PII (#2)', () => {
  const raw = {
    id: 'driver-1',
    userId: 'user-1',
    carNumber: '01A123AA',
    pinfl: '12345678901234',
    tin: '123456789',
    birthDate: '1990-01-01',
    legal: { eligible: true, blocking: false, issueCount: 0 },
  };
  const PII = ['pinfl', 'tin', 'birthDate'];

  function build() {
    const driversService = {
      findAll: jest.fn(async () => ({ drivers: [{ ...raw }], total: 1, page: 1, limit: 20 })),
      findById: jest.fn(async () => ({ ...raw })),
      findByIdOrThrow: jest.fn(async () => ({ ...raw })),
      setCommissionRate: jest.fn(async () => ({ ...raw })),
      setApprovedTariffTier: jest.fn(async () => ({ ...raw })),
    };
    const usersService = { updateStatus: jest.fn() };
    const walletAdjustments = { adjust: jest.fn(async () => ({ ...raw, walletBalance: 1 })) };
    const controller = new DriversController(
      driversService as never,
      usersService as never,
      {} as never,
      walletAdjustments as never,
    );
    return { controller };
  }

  const expectNoPii = (value: unknown) => {
    for (const key of PII) expect(value).not.toHaveProperty(key);
  };

  it('GET /drivers — ro‘yxatda PII yo‘q, qolgan maydonlar (legal brief) saqlanadi', async () => {
    const { controller } = build();
    const res = await controller.findAll(1, 20);
    expect(res.total).toBe(1);
    expectNoPii(res.drivers[0]);
    expect(res.drivers[0]).toMatchObject({ id: 'driver-1', carNumber: '01A123AA', legal: { eligible: true } });
  });

  it('GET /drivers/:id — PII yo‘q', async () => {
    const { controller } = build();
    expectNoPii(await controller.findOne('driver-1'));
  });

  it('boshqa menejer javoblari ham (approve, balance, commission, tariff)', async () => {
    const { controller } = build();
    expectNoPii(await controller.approveDriver('driver-1'));
    expectNoPii(await controller.addFunds({ id: 'a', role: 'admin' } as never, 'driver-1', { amount: 1, note: 'x' }));
    expectNoPii(await controller.setCommissionRate('driver-1', { commissionRate: 5 } as never));
    expectNoPii(await controller.setTariffTier('driver-1', { tier: 2 } as never));
  });
});
