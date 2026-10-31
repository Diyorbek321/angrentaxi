import { BadRequestException } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { DriverServicesService } from './driver-services.service';
import { UserStatus } from '../../database/entities/user.entity';
import { ServiceType } from '../../database/entities/order.entity';

/**
 * Huquqiy darvoza ULANISHI: qaror `DriverLegalService` da (o'z spec'i bor),
 * bu yerda faqat uning to'g'ri joyda chaqirilishi sinaladi.
 */
describe('huquqiy darvoza ulanishi', () => {
  const driver = {
    id: 'driver-1',
    userId: 'user-1',
    isOnline: false,
    currentLocation: null,
    vehicleType: null,
    serviceTypes: [ServiceType.FOOD],
    user: { id: 'user-1', status: UserStatus.ACTIVE },
  };

  describe('DriversService.setOnlineStatus', () => {
    function build(legalGate?: { assertCanGoOnline: jest.Mock }) {
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
      const redis = { zrem: jest.fn(), geoadd: jest.fn(), set: jest.fn(), del: jest.fn() };
      const service = new DriversService(
        driverRepository as never,
        transactionRepository as never,
        redis as never,
        {} as never,
        {} as never,
        { assertCanGoOnline: jest.fn(async () => undefined) } as never,
        undefined,
        legalGate as never,
      );
      return { service, driverRepository };
    }

    it('onlayn chiqishda huquqiy darvoza chaqiriladi', async () => {
      const gate = { assertCanGoOnline: jest.fn(async () => undefined) };
      await build(gate).service.setOnlineStatus('user-1', true);
      expect(gate.assertCanGoOnline).toHaveBeenCalledWith(driver);
    });

    it("darvoza rad etsa onlayn bo'lmaydi, sabab o'zgarmaydi", async () => {
      const gate = {
        assertCanGoOnline: jest.fn(async () => {
          throw new BadRequestException('Taksi uchun onlayn chiqa olmaysiz: ...');
        }),
      };
      const { service, driverRepository } = build(gate);
      await expect(service.setOnlineStatus('user-1', true)).rejects.toThrow('Taksi uchun onlayn chiqa olmaysiz');
      expect(driverRepository.update).not.toHaveBeenCalled();
    });

    it("oflayn bo'lishda chaqirilmaydi", async () => {
      const gate = { assertCanGoOnline: jest.fn() };
      await build(gate).service.setOnlineStatus('user-1', false);
      expect(gate.assertCanGoOnline).not.toHaveBeenCalled();
    });

    it("darvoza ulanmagan (eski wiring) — avvalgi xulq", async () => {
      await expect(build().service.setOnlineStatus('user-1', true)).resolves.toEqual(
        expect.objectContaining({ isOnline: true }),
      );
    });
  });

  describe('DriverServicesService.updateForUser — taksini yoqish', () => {
    function build(legalGate: { assertCanEnableTaxi: jest.Mock; assertCanCarryIntercity?: jest.Mock }) {
      const driverRepository = {
        findOne: jest.fn(async () => driver),
        save: jest.fn(async (value: unknown) => value),
      };
      const orderRepository = { find: jest.fn(async () => []) };
      const verification = { findUnmetRequirementsForServiceType: jest.fn(async () => []) };
      return new DriverServicesService(
        driverRepository as never,
        orderRepository as never,
        verification as never,
        legalGate as never,
        { isIntercityEnabled: jest.fn(async () => true) } as never,
      );
    }

    it('taksi YANGI yoqilayotganda darvoza tekshiradi', async () => {
      const gate = {
        assertCanEnableTaxi: jest.fn(async () => {
          throw new BadRequestException('«Taksi» xizmatini yoqib bo‘lmadi: ...');
        }),
      };
      await expect(
        build(gate).updateForUser('user-1', [ServiceType.FOOD, ServiceType.TAXI]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(gate.assertCanEnableTaxi).toHaveBeenCalledWith(driver, expect.any(Date));
    });

    it('shaharlararo YANGI yoqilayotganda ham darvoza tekshiradi', async () => {
      const gate = {
        assertCanEnableTaxi: jest.fn(),
        assertCanCarryIntercity: jest.fn(async () => {
          throw new BadRequestException('«Shaharlararo» qatnov uchun hujjatlar yetarli emas: ...');
        }),
      };
      await expect(
        build(gate).updateForUser('user-1', [ServiceType.FOOD, ServiceType.INTERCITY]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(gate.assertCanCarryIntercity).toHaveBeenCalledWith(driver, expect.any(Date));
    });

    it('taksi so‘ralmasa darvoza chaqirilmaydi', async () => {
      const gate = { assertCanEnableTaxi: jest.fn() };
      await build(gate).updateForUser('user-1', [ServiceType.FOOD]);
      expect(gate.assertCanEnableTaxi).not.toHaveBeenCalled();
    });
  });
});
