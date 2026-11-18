import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentMethod } from '../../database/entities/order.entity';
import {
  assertDriverMayOrderAsPassenger,
  DRIVER_ON_TRIP_MESSAGE,
  DRIVER_ONLINE_MESSAGE,
  DRIVER_WALLET_PAYMENT_MESSAGE,
  isOwnOrder,
  OWN_ORDER_MESSAGE,
  PASSENGER_ORDER_ACTIVE_MESSAGE,
} from './driver-as-passenger';
import { ERROR_CATALOGUE } from '../../common/i18n/error-catalogue';

describe('assertDriverMayOrderAsPassenger', () => {
  const idle = { isDriver: true, isOnline: false, hasActiveTrip: false };

  it("haydovchi bo'lmagan akkaunt — tekshiruv yo'q (hamyon ham mumkin)", () => {
    expect(() => assertDriverMayOrderAsPassenger(null, PaymentMethod.WALLET)).not.toThrow();
    expect(() =>
      assertDriverMayOrderAsPassenger({ isDriver: false, isOnline: false, hasActiveTrip: false }, PaymentMethod.WALLET),
    ).not.toThrow();
  });

  it("liniyadan chiqqan, safarsiz haydovchi naqd/karta bilan chaqira oladi", () => {
    expect(() => assertDriverMayOrderAsPassenger(idle, PaymentMethod.CASH)).not.toThrow();
    expect(() => assertDriverMayOrderAsPassenger(idle, PaymentMethod.CARD)).not.toThrow();
    expect(() => assertDriverMayOrderAsPassenger(idle, undefined)).not.toThrow();
  });

  it('liniyada — rad', () => {
    expect(() => assertDriverMayOrderAsPassenger({ ...idle, isOnline: true }, PaymentMethod.CASH)).toThrow(
      new ConflictException(DRIVER_ONLINE_MESSAGE),
    );
  });

  it('haydovchi sifatida safarda — rad (liniyadan oldin tekshiriladi)', () => {
    expect(() =>
      assertDriverMayOrderAsPassenger({ ...idle, isOnline: true, hasActiveTrip: true }, PaymentMethod.CASH),
    ).toThrow(new ConflictException(DRIVER_ON_TRIP_MESSAGE));
  });

  it('haydovchi hamyoni bilan to\'lov — rad', () => {
    expect(() => assertDriverMayOrderAsPassenger(idle, PaymentMethod.WALLET)).toThrow(
      new BadRequestException(DRIVER_WALLET_PAYMENT_MESSAGE),
    );
  });
});

describe('isOwnOrder', () => {
  it("yo'lovchi = haydovchi", () => {
    expect(isOwnOrder({ passengerId: 'u1' }, 'u1')).toBe(true);
    expect(isOwnOrder({ passengerId: 'u1' }, 'u2')).toBe(false);
  });
});

describe('xato matnlari ruscha tarjimada bor', () => {
  it.each([
    OWN_ORDER_MESSAGE,
    PASSENGER_ORDER_ACTIVE_MESSAGE,
    DRIVER_ONLINE_MESSAGE,
    DRIVER_ON_TRIP_MESSAGE,
    DRIVER_WALLET_PAYMENT_MESSAGE,
  ])('%s', (message) => {
    expect(ERROR_CATALOGUE.find((e) => e.source === message)?.ru).toBeTruthy();
  });
});
