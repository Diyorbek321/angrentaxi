import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DriverLegalController } from './driver-legal.controller';
import { DriversModule } from './drivers.module';
import { DriversController } from './drivers.controller';
import { UpdateDriverLegalDto } from './dto/update-driver-legal.dto';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { Permission, UserRole } from '../../database/entities/user.entity';

describe('DriverLegalController', () => {
  const reflector = new Reflector();
  const proto = DriverLegalController.prototype;

  it("haydovchi faqat o'zinikini, menejer/admin hammasini", () => {
    expect(reflector.get(ROLES_KEY, proto.getMine)).toEqual([UserRole.DRIVER]);
    expect(reflector.get(ROLES_KEY, proto.updateMine)).toEqual([UserRole.DRIVER]);
    expect(reflector.get(ROLES_KEY, proto.getOne)).toEqual([UserRole.MANAGER, UserRole.ADMIN]);
    expect(reflector.get(PERMISSIONS_KEY, proto.getOne)).toEqual([Permission.DRIVERS_VIEW]);
    expect(reflector.get(PERMISSIONS_KEY, proto.updateOne)).toEqual([Permission.DRIVERS_APPROVE]);
  });

  it('servisga foydalanuvchi id si bilan uzatadi', async () => {
    const service = {
      getForUser: jest.fn().mockResolvedValue('ok'),
      updateForUser: jest.fn(),
      localizeSummary: jest.fn((summary: unknown) => summary),
    };
    const controller = new DriverLegalController(service as never);
    await expect(controller.getMine({ id: 'user-1' } as never)).resolves.toBe('ok');
    await controller.getMine({ id: 'user-1' } as never, 'ru-RU,ru;q=0.9');
    expect(service.localizeSummary).toHaveBeenLastCalledWith('ok', 'ru');
    await controller.updateMine({ id: 'user-1' } as never, { pinfl: '12345678901234' });
    expect(service.updateForUser).toHaveBeenCalledWith('user-1', { pinfl: '12345678901234' });
  });

  it('DriversController dan oldin ro‘yxatdan o‘tgan', () => {
    const controllers: unknown[] = Reflect.getMetadata('controllers', DriversModule);
    expect(controllers.indexOf(DriverLegalController)).toBeGreaterThanOrEqual(0);
    expect(controllers.indexOf(DriverLegalController)).toBeLessThan(controllers.indexOf(DriversController));
  });

  describe('DTO formatlari', () => {
    const errors = async (body: Record<string, unknown>) =>
      (await validate(plainToInstance(UpdateDriverLegalDto, body))).map((e) => e.property);

    it("PINFL 14 raqam, STIR 9 raqam", async () => {
      expect(await errors({ pinfl: '1234567890123' })).toEqual(['pinfl']);
      expect(await errors({ pinfl: '1234567890123a' })).toEqual(['pinfl']);
      expect(await errors({ tin: '12345678' })).toEqual(['tin']);
      expect(await errors({ pinfl: '12345678901234', tin: '123456789' })).toEqual([]);
    });

    it("null tozalash uchun ruxsat", async () => {
      expect(await errors({ tin: null, taxStatus: null })).toEqual([]);
    });

    it('sanalar YYYY-MM-DD, soliq maqomi enum', async () => {
      expect(await errors({ birthDate: '01.05.1990' })).toEqual(['birthDate']);
      expect(await errors({ taxStatus: 'llc' })).toEqual(['taxStatus']);
      expect(await errors({ citizenship: 'uz' })).toEqual(['citizenship']);
    });
  });
});
