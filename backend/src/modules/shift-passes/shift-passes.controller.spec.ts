import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { AdminShiftPassesController, DriverShiftPassController } from './shift-passes.controller';

describe('Shift pass controllers', () => {
  const reflector = new Reflector();

  it('haydovchi faqat o‘zinikini, ro‘yxat faqat admin', () => {
    expect(reflector.get(ROLES_KEY, DriverShiftPassController.prototype.getMine)).toEqual([UserRole.DRIVER]);
    expect(reflector.get(ROLES_KEY, DriverShiftPassController.prototype.buy)).toEqual([UserRole.DRIVER]);
    expect(reflector.get(ROLES_KEY, AdminShiftPassesController)).toEqual([UserRole.ADMIN]);
  });

  it('haydovchi so‘rovi foydalanuvchi id si bilan uzatiladi', async () => {
    const service = { getMine: jest.fn().mockResolvedValue('mine'), buy: jest.fn().mockResolvedValue('pass') };
    const controller = new DriverShiftPassController(service as never);
    await expect(controller.getMine({ id: 'u1' } as never)).resolves.toBe('mine');
    await expect(controller.buy({ id: 'u1' } as never)).resolves.toBe('pass');
    expect(service.buy).toHaveBeenCalledWith('u1');
  });

  it('admin: standart oraliq — oxirgi 30 kun; from > to — 400', async () => {
    const service = { listForAdmin: jest.fn().mockResolvedValue('list') };
    const controller = new AdminShiftPassesController(service as never);
    await controller.list({ to: '2026-10-31T00:00:00Z' });
    expect(service.listForAdmin).toHaveBeenCalledWith(
      new Date('2026-10-01T00:00:00Z'),
      new Date('2026-10-31T00:00:00Z'),
      { page: undefined, limit: undefined },
    );
    await controller.list({ to: '2026-10-31T00:00:00Z', page: 2, limit: 50 });
    expect(service.listForAdmin).toHaveBeenLastCalledWith(
      new Date('2026-10-01T00:00:00Z'),
      new Date('2026-10-31T00:00:00Z'),
      { page: 2, limit: 50 },
    );
    expect(() => controller.list({ from: '2026-11-01T00:00:00Z', to: '2026-10-01T00:00:00Z' })).toThrow(
      BadRequestException,
    );
  });
});
