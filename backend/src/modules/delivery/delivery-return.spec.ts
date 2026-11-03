import { BadRequestException } from '@nestjs/common';
import { DeliveryFailureReason, OrderStatus, ServiceType } from '../../database/entities/order.entity';
import { agreedFareBreakdown } from '../tariffs/fare-breakdown';
import {
  assertCanMarkDropoffArrived,
  assertCanMarkFailed,
  dropoffWaitingMinutes,
  isReturningRide,
  parseDeliveryFailureReason,
  returnFeeOf,
  vendorReturnRefund,
  withReturnFare,
} from './delivery-return';

const T0 = new Date('2026-11-03T10:00:00Z');
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const ride = (over: Record<string, unknown> = {}) => ({
  status: OrderStatus.IN_PROGRESS,
  serviceType: ServiceType.FOOD,
  dropoffArrivedAt: T0,
  deliveryFailedAt: null,
  ...over,
});

describe('delivery-return', () => {
  it('yetkazib bo\'lmadi — bepul kutish tugaguncha rad, keyin ruxsat', () => {
    expect(() => assertCanMarkFailed(ride() as never, at(3), 5)).toThrow(/2 daqiqa kuting/);
    expect(() => assertCanMarkFailed(ride() as never, at(5), 5)).not.toThrow();
  });

  it("manzilga yetib kelmagan — rad; dispetcher ozod", () => {
    const r = ride({ dropoffArrivedAt: null });
    expect(() => assertCanMarkFailed(r as never, at(10), 5)).toThrow(BadRequestException);
    expect(() => assertCanMarkFailed(r as never, at(0), 5, true)).not.toThrow();
  });

  it('taksi, yuk, boshqa holat va takror — rad', () => {
    expect(() => assertCanMarkFailed(ride({ serviceType: ServiceType.TAXI }) as never, at(9), 5)).toThrow();
    expect(() => assertCanMarkFailed(ride({ serviceType: ServiceType.CARGO }) as never, at(9), 5, true)).toThrow();
    expect(() => assertCanMarkFailed(ride({ status: OrderStatus.ARRIVED }) as never, at(9), 5, true)).toThrow();
    expect(() => assertCanMarkFailed(ride({ deliveryFailedAt: at(6) }) as never, at(9), 5, true)).toThrow(
      /allaqachon/,
    );
  });

  it('manzilga yetib keldim — faqat yetkazish davomida', () => {
    expect(() => assertCanMarkDropoffArrived(ride({ dropoffArrivedAt: null }) as never)).not.toThrow();
    expect(() => assertCanMarkDropoffArrived(ride({ status: OrderStatus.ACCEPTED }) as never)).toThrow();
    expect(() => assertCanMarkDropoffArrived(ride({ deliveryFailedAt: T0 }) as never)).toThrow();
    expect(() => assertCanMarkDropoffArrived(ride({ serviceType: ServiceType.TAXI }) as never)).toThrow();
  });

  it('sabab — faqat ro\'yxatdan', () => {
    expect(parseDeliveryFailureReason('customer_refused')).toBe(DeliveryFailureReason.CUSTOMER_REFUSED);
    expect(() => parseDeliveryFailureReason('lazy')).toThrow(BadRequestException);
    expect(() => parseDeliveryFailureReason(undefined)).toThrow(BadRequestException);
  });

  it('manzilda kutish: bepul daqiqalar ayiriladi, qaytish yo\'li sanalmaydi', () => {
    expect(dropoffWaitingMinutes({ dropoffArrivedAt: T0, deliveryFailedAt: null }, at(8), 5)).toBe(3);
    expect(dropoffWaitingMinutes({ dropoffArrivedAt: T0, deliveryFailedAt: at(7) }, at(40), 5)).toBe(2);
    expect(dropoffWaitingMinutes({ dropoffArrivedAt: null, deliveryFailedAt: null }, at(40), 5)).toBe(0);
  });

  it('qaytarish haqi — foiz, 100 so\'mga yaxlit', () => {
    expect(returnFeeOf(7000, 50)).toBe(3500);
    expect(returnFeeOf(7300, 50)).toBe(3700);
    expect(returnFeeOf(0, 50)).toBe(0);
    expect(returnFeeOf(7000, 0)).toBe(0);
  });

  it('tarkibga qaytarish haqi qo\'shiladi, invariant saqlanadi', () => {
    const base = agreedFareBreakdown(7000, 3, 8);
    const withFee = withReturnFare(base, 3500);
    expect(withFee.returnFare).toBe(3500);
    expect(withFee.total).toBe(10500);
    expect(withReturnFare(base, 0)).toBe(base);
  });

  it('kartali qaytarish: qolgani qaytariladi', () => {
    expect(vendorReturnRefund(57000, 10500)).toEqual({ refundDue: 46500, uncovered: 0 });
    expect(vendorReturnRefund(5000, 10500)).toEqual({ refundDue: 0, uncovered: 5500 });
  });

  it('qaytarilmoqda — in_progress + deliveryFailedAt', () => {
    expect(isReturningRide({ status: OrderStatus.IN_PROGRESS, deliveryFailedAt: T0 })).toBe(true);
    expect(isReturningRide({ status: OrderStatus.IN_PROGRESS, deliveryFailedAt: null })).toBe(false);
    expect(isReturningRide({ status: OrderStatus.COMPLETED, deliveryFailedAt: T0 })).toBe(false);
  });
});
