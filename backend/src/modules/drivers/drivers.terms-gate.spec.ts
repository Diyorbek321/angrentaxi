import { BadRequestException } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { UserStatus } from '../../database/entities/user.entity';

/**
 * Oferta darvozasi ULANISHI (qaror — `LegalAcceptanceService`, o'z spec'i bor):
 * faqat OFLAYN → ONLAYN o'tishda tekshiriladi. Allaqachon onlayn haydovchi
 * (masalan, safar o'rtasida ilova qayta ishga tushib holatni qayta yuborsa)
 * to'silmaydi, oflayn bo'lishga hech qachon aralashmaydi.
 */
describe('DriversService.setOnlineStatus — oferta darvozasi', () => {
  function build(isOnline: boolean, termsGate: { assertDriverTermsAccepted: jest.Mock }) {
    const driver = {
      id: 'driver-1',
      userId: 'user-1',
      isOnline,
      currentLocation: null,
      vehicleType: null,
      serviceTypes: ['taxi'],
      user: { id: 'user-1', status: UserStatus.ACTIVE },
    };
    const driverRepository = {
      findOne: jest.fn(async () => driver),
      update: jest.fn(async () => undefined),
      query: jest.fn(async () => []),
    };
    const transactionRepository = {
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(async () => ({ balance: '0' })),
      })),
    };
    const redis = {
      zrem: jest.fn(async () => 1),
      geoadd: jest.fn(async () => 1),
      set: jest.fn(async () => 'OK'),
      del: jest.fn(async () => 1),
    };
    const service = new DriversService(
      driverRepository as never,
      transactionRepository as never,
      redis as never,
      {} as never,
      {} as never,
      { assertCanGoOnline: jest.fn(async () => undefined) } as never,
      undefined,
      { assertCanGoOnline: jest.fn(async () => undefined) } as never,
      termsGate as never,
    );
    return { service, driverRepository, redis };
  }

  it('oflayn → onlayn: darvoza haydovchining user id si bilan chaqiriladi', async () => {
    const gate = { assertDriverTermsAccepted: jest.fn(async () => undefined) };
    const { service, driverRepository } = build(false, gate);
    await service.setOnlineStatus('user-1', true);
    expect(gate.assertDriverTermsAccepted).toHaveBeenCalledWith('user-1');
    expect(driverRepository.update).toHaveBeenCalledWith('driver-1', { isOnline: true });
  });

  it("qabul qilinmagan — onlayn BO'LMAYDI, xato o'zgarmay yetadi", async () => {
    const gate = {
      assertDriverTermsAccepted: jest.fn(async () => {
        throw new BadRequestException('Onlayn chiqish uchun haydovchi ofertasining yangi tahririni qabul qiling.');
      }),
    };
    const { service, driverRepository, redis } = build(false, gate);
    await expect(service.setOnlineStatus('user-1', true)).rejects.toThrow('ofertasining');
    expect(driverRepository.update).not.toHaveBeenCalled();
    expect(redis.geoadd).not.toHaveBeenCalled();
  });

  it('allaqachon onlayn — darvoza chaqirilmaydi (safar o\'rtasida buzilmaydi)', async () => {
    const gate = { assertDriverTermsAccepted: jest.fn(async () => undefined) };
    await build(true, gate).service.setOnlineStatus('user-1', true);
    expect(gate.assertDriverTermsAccepted).not.toHaveBeenCalled();
  });

  it("oflayn bo'lishga aralashmaydi", async () => {
    const gate = { assertDriverTermsAccepted: jest.fn(async () => undefined) };
    await build(false, gate).service.setOnlineStatus('user-1', false);
    expect(gate.assertDriverTermsAccepted).not.toHaveBeenCalled();
  });
});
