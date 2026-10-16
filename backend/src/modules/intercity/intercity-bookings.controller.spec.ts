import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { IntercityBookingKind } from '../../database/entities/order.entity';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { IntercityBookingsController } from './intercity-bookings.controller';

describe('IntercityBookingsController', () => {
  const reflector = new Reflector();
  const proto = IntercityBookingsController.prototype;

  it('hammasi autentifikatsiyadan keyin', () => {
    expect(reflector.get(GUARDS_METADATA, IntercityBookingsController)).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it("band qilish, o'z bandlari va bekor qilish — faqat yo'lovchi", () => {
    for (const handler of [proto.book, proto.listMine, proto.cancel]) {
      expect(reflector.get(ROLES_KEY, handler)).toEqual([UserRole.PASSENGER]);
    }
  });

  it("yig'ish, jo'nash va «kelmadi» — faqat haydovchi", () => {
    for (const handler of [proto.startBoarding, proto.depart, proto.noShow, proto.listTripBookings]) {
      expect(reflector.get(ROLES_KEY, handler)).toEqual([UserRole.DRIVER]);
    }
  });

  it('foydalanuvchi id si servisga uzatiladi (begona nomidan ish qilib bo‘lmaydi)', async () => {
    const bookings = {
      book: jest.fn().mockResolvedValue('booked'),
      listMine: jest.fn().mockResolvedValue('mine'),
      cancel: jest.fn().mockResolvedValue('cancelled'),
    };
    const lifecycle = {
      startBoarding: jest.fn().mockResolvedValue('boarding'),
      depart: jest.fn().mockResolvedValue('departed'),
      markNoShow: jest.fn().mockResolvedValue('noshow'),
      listBookingsForDriver: jest.fn().mockResolvedValue([]),
    };
    const controller = new IntercityBookingsController(bookings as never, lifecycle as never);
    const user = { id: 'user-1' } as never;
    const dto = {
      kind: IntercityBookingKind.SEAT,
      pickup: { lat: 40.1, lng: 70.9, address: 'a' },
      dropoff: { lat: 41.3, lng: 69.3, address: 'b' },
    };

    await expect(controller.book(user, 'trip-1', dto)).resolves.toBe('booked');
    expect(bookings.book).toHaveBeenCalledWith('user-1', 'trip-1', dto);
    await controller.cancel(user, 'order-1');
    expect(bookings.cancel).toHaveBeenCalledWith('user-1', 'order-1');
    await controller.startBoarding(user, 'trip-1');
    expect(lifecycle.startBoarding).toHaveBeenCalledWith('user-1', 'trip-1');
    await controller.depart(user, 'trip-1');
    expect(lifecycle.depart).toHaveBeenCalledWith('user-1', 'trip-1');
    await controller.noShow(user, 'order-1');
    expect(lifecycle.markNoShow).toHaveBeenCalledWith('user-1', 'order-1');
    await controller.listTripBookings(user, 'trip-1');
    expect(lifecycle.listBookingsForDriver).toHaveBeenCalledWith('user-1', 'trip-1');
  });
});
