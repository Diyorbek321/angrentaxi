import 'reflect-metadata';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { Permission, UserRole } from '../../database/entities/user.entity';
import { IntercityTripClass } from '../../database/entities/intercity-trip.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { IntercityTripsController } from './intercity-trips.controller';

describe('IntercityTripsController', () => {
  const reflector = new Reflector();
  const proto = IntercityTripsController.prototype;

  it('hammasi autentifikatsiyadan keyin', () => {
    expect(reflector.get(GUARDS_METADATA, IntercityTripsController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
      PermissionsGuard,
    ]);
  });

  it("e'lon, o'z qatnovlari va bekor qilish — faqat haydovchi", () => {
    for (const handler of [proto.publish, proto.listMine, proto.cancel]) {
      expect(reflector.get(ROLES_KEY, handler)).toEqual([UserRole.DRIVER]);
    }
  });

  it('boshqaruv ro‘yxati — menejer/admin + DISPATCH', () => {
    expect(reflector.get(ROLES_KEY, proto.listForManage)).toEqual([UserRole.MANAGER, UserRole.ADMIN]);
    expect(reflector.get(PERMISSIONS_KEY, proto.listForManage)).toEqual([Permission.DISPATCH]);
  });

  it('qatnov bandlari (menejer) — menejer/admin + DISPATCH, GET trips/:id/bookings/manage', async () => {
    expect(reflector.get(ROLES_KEY, proto.listBookingsForManage)).toEqual([UserRole.MANAGER, UserRole.ADMIN]);
    expect(reflector.get(PERMISSIONS_KEY, proto.listBookingsForManage)).toEqual([Permission.DISPATCH]);
    expect(reflector.get(PATH_METADATA, proto.listBookingsForManage)).toBe('trips/:id/bookings/manage');

    const bookings = { listForManage: jest.fn().mockResolvedValue(['b']) };
    const controller = new IntercityTripsController({} as never, bookings as never);
    await expect(controller.listBookingsForManage('t1')).resolves.toEqual(['b']);
    expect(bookings.listForManage).toHaveBeenCalledWith('t1');
  });

  it('bandni dispetcher bekor qiladi — menejer/admin + DISPATCH, POST bookings/:orderId/cancel/manage', async () => {
    expect(reflector.get(ROLES_KEY, proto.cancelBookingForManage)).toEqual([UserRole.MANAGER, UserRole.ADMIN]);
    expect(reflector.get(PERMISSIONS_KEY, proto.cancelBookingForManage)).toEqual([Permission.DISPATCH]);
    expect(reflector.get(PATH_METADATA, proto.cancelBookingForManage)).toBe('bookings/:orderId/cancel/manage');
    expect(reflector.get(METHOD_METADATA, proto.cancelBookingForManage)).toBe(1); // POST

    const bookings = { cancelForManage: jest.fn().mockResolvedValue('cancelled') };
    const controller = new IntercityTripsController({} as never, bookings as never);
    await expect(controller.cancelBookingForManage('o1', { reason: 'Telefon orqali' })).resolves.toBe('cancelled');
    expect(bookings.cancelForManage).toHaveBeenCalledWith('o1', 'Telefon orqali');
  });

  it("literal yo'llar `trips/:id` dan OLDIN e'lon qilingan (marshrut to'qnashmasin)", () => {
    const getPaths = Object.getOwnPropertyNames(proto)
      .filter((name) => name !== 'constructor')
      .map((name) => proto[name as keyof typeof proto] as unknown as () => unknown)
      .filter((handler) => reflector.get(METHOD_METADATA, handler) === 0) // GET
      .map((handler) => reflector.get<string>(PATH_METADATA, handler));
    expect(getPaths.indexOf('trips/:id')).toBeGreaterThan(getPaths.indexOf('trips/mine'));
    expect(getPaths.indexOf('trips/:id')).toBeGreaterThan(getPaths.indexOf('trips/manage'));
  });

  it('foydalanuvchi id si servisga uzatiladi', async () => {
    const trips = {
      publish: jest.fn().mockResolvedValue('published'),
      listMine: jest.fn().mockResolvedValue('mine'),
      cancelByDriver: jest.fn().mockResolvedValue('cancelled'),
      search: jest.fn().mockResolvedValue('found'),
    };
    const controller = new IntercityTripsController(trips as never, {} as never);
    const user = { id: 'user-1' } as never;
    const dto = { routeId: 'r1', departureAt: '2026-10-18T02:00:00.000Z', tripClass: IntercityTripClass.START };

    await expect(controller.publish(user, dto)).resolves.toBe('published');
    expect(trips.publish).toHaveBeenCalledWith('user-1', dto);
    await controller.listMine(user, { page: 1 });
    expect(trips.listMine).toHaveBeenCalledWith('user-1', { page: 1 });
    await controller.cancel(user, 't1', { reason: 'Buzildi' });
    expect(trips.cancelByDriver).toHaveBeenCalledWith('user-1', 't1', 'Buzildi');
    await controller.search({ routeId: 'r1', date: '2026-10-18' });
    expect(trips.search).toHaveBeenCalledWith('r1', '2026-10-18');
  });
});
