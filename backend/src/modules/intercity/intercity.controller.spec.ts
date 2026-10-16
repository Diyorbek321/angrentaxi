import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { Permission, UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { IntercityController, IntercityManageController } from './intercity.controller';

describe('Intercity controllers', () => {
  const reflector = new Reflector();

  it("ommaviy ro'yxat himoyasiz, boshqaruv — menejer/admin + TARIFFS_MANAGE", () => {
    expect(reflector.get(GUARDS_METADATA, IntercityController)).toBeUndefined();
    expect(reflector.get(GUARDS_METADATA, IntercityManageController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, PermissionsGuard]),
    );
    expect(reflector.get(ROLES_KEY, IntercityManageController)).toEqual([UserRole.MANAGER, UserRole.ADMIN]);
    expect(reflector.get(PERMISSIONS_KEY, IntercityManageController)).toEqual([Permission.TARIFFS_MANAGE]);
  });

  it("yo'nalish yozuvlari amalni bajargan xodim id si bilan uzatiladi", async () => {
    const routes = {
      create: jest.fn().mockResolvedValue('created'),
      update: jest.fn().mockResolvedValue('updated'),
    };
    const controller = new IntercityManageController(routes as never, {} as never);
    const dto = { originPointId: 'a', destinationPointId: 'b', seatPrice: 1, wholeCarPrice: 1 };

    await expect(controller.createRoute({ id: 'admin-1' } as never, dto)).resolves.toBe('created');
    await expect(controller.updateRoute({ id: 'admin-1' } as never, 'r1', { seatPrice: 2 })).resolves.toBe(
      'updated',
    );
    expect(routes.create).toHaveBeenCalledWith('admin-1', dto);
    expect(routes.update).toHaveBeenCalledWith('admin-1', 'r1', { seatPrice: 2 });
  });
});
