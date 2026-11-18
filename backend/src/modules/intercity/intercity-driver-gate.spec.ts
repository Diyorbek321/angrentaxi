import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ServiceType } from '../../database/entities/order.entity';
import { UserStatus } from '../../database/entities/user.entity';
import { IntercityDriverGate } from './intercity-driver-gate';

const NOW = new Date('2026-10-17T06:00:00.000Z');

const baseDriver = () => ({
  id: 'driver-1',
  userId: 'user-1',
  approvedTariffTier: 1,
  serviceTypes: [ServiceType.TAXI, ServiceType.INTERCITY],
  vehicleType: null,
  user: { id: 'user-1', status: UserStatus.ACTIVE, firstName: 'Ali' },
});

function build(
  options: {
    driver?: Record<string, unknown> | null;
    balance?: number;
    unmet?: Array<{ code: string; label: string }>;
    legalError?: Error;
  } = {},
) {
  const driver = options.driver === undefined ? baseDriver() : options.driver;
  const driverRepository = { findOne: jest.fn(async () => driver) };
  const transactionRepository = {
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(async () => ({ balance: String(options.balance ?? 0) })),
    })),
  };
  const verification = {
    assertCanGoOnline: jest.fn(async () => undefined),
    findUnmetRequirementsForServiceType: jest.fn(async () => options.unmet ?? []),
  };
  const legal = {
    assertCanCarryIntercity: jest.fn(async () => {
      if (options.legalError) throw options.legalError;
    }),
  };
  const gate = new IntercityDriverGate(
    driverRepository as never,
    transactionRepository as never,
    verification as never,
    legal as never,
  );
  return { gate, verification, legal };
}

describe('IntercityDriverGate.loadPublisher', () => {
  it('hamma talab bajarilgan — haydovchi qaytadi', async () => {
    const { gate, legal, verification } = build();
    await expect(gate.loadPublisher('user-1', NOW)).resolves.toMatchObject({ id: 'driver-1' });
    expect(legal.assertCanCarryIntercity).toHaveBeenCalledWith(expect.objectContaining({ id: 'driver-1' }), NOW);
    expect(verification.assertCanGoOnline).toHaveBeenCalled();
  });

  it('haydovchi profili yo‘q — 404', async () => {
    const { gate } = build({ driver: null });
    await expect(gate.loadPublisher('user-1', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([UserStatus.BLOCKED, UserStatus.PENDING])('akkaunt %s — 403', async (status) => {
    const { gate } = build({ driver: { ...baseDriver(), user: { id: 'user-1', status } } });
    await expect(gate.loadPublisher('user-1', NOW)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('«Shaharlararo» xizmati yoqilmagan — 403 INTERCITY_SERVICE_NOT_ENABLED', async () => {
    const { gate } = build({ driver: { ...baseDriver(), serviceTypes: [ServiceType.TAXI] } });
    await expect(gate.loadPublisher('user-1', NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_SERVICE_NOT_ENABLED' },
    });
  });

  it('manfiy hamyon — qarzni yopmaguncha e‘lon yo‘q', async () => {
    const { gate } = build({ balance: -5000 });
    await expect(gate.loadPublisher('user-1', NOW)).rejects.toMatchObject({
      response: { code: 'WALLET_NEGATIVE_BALANCE' },
    });
  });

  it('shaharlararo uchun tekshiruv hujjati yetishmaydi — 400', async () => {
    const { gate } = build({ unmet: [{ code: 'car_photo', label: 'Avtomobil surati' }] });
    await expect(gate.loadPublisher('user-1', NOW)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('huquqiy talablar (VMQ 200) bajarilmagan — darvoza xatosi uzatiladi', async () => {
    const { gate } = build({ legalError: new BadRequestException('legal') });
    await expect(gate.loadPublisher('user-1', NOW)).rejects.toThrow('legal');
  });
});
