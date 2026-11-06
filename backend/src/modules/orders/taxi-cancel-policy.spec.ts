import { OrderStatus, ServiceType } from '../../database/entities/order.entity';
import { checkNoShow, penaltiesApply, quoteCancelFee, TaxiPenaltySettings } from './taxi-cancel-policy';

const settings: TaxiPenaltySettings = { freeCancelMinutes: 2, lateCancelFee: 3000, noShowWaitMinutes: 5, noShowFee: 5000 };
const acceptedAt = new Date('2026-11-04T10:00:00Z');
const base = {
  status: OrderStatus.ACCEPTED,
  serviceType: ServiceType.TAXI,
  intercityTripId: null,
  driverId: 'd1',
  acceptedAt,
  arrivedAt: null as Date | null,
};
const at = (min: number) => new Date(acceptedAt.getTime() + min * 60_000);

describe('taxi-cancel-policy (INCIDENT-POLICY §5)', () => {
  it('qabuldan 2 daqiqa ichida — bepul, oyna tugash vaqti bilan', () => {
    expect(quoteCancelFee(base, settings, at(1.9))).toEqual({ fee: 0, reason: null, freeUntil: '2026-11-04T10:02:00.000Z' });
  });

  it("2 daqiqadan keyin — 3000", () => {
    expect(quoteCancelFee(base, settings, at(2.1))).toEqual({ fee: 3000, reason: 'after_free_window', freeUntil: null });
  });

  it('haydovchi yetib kelgan — darhol jarima', () => {
    expect(quoteCancelFee({ ...base, status: OrderStatus.ARRIVED }, settings, at(0.5)).fee).toBe(3000);
  });

  it("qidiruvda, haydovchisiz, eski qator (acceptedAt yo'q), yetkazish, shaharlararo, 0 sozlama — bepul", () => {
    expect(quoteCancelFee({ ...base, status: OrderStatus.SEARCHING, driverId: null }, settings, at(9)).fee).toBe(0);
    expect(quoteCancelFee({ ...base, acceptedAt: null }, settings, at(9)).fee).toBe(0);
    expect(quoteCancelFee({ ...base, serviceType: ServiceType.FOOD }, settings, at(9)).fee).toBe(0);
    expect(quoteCancelFee({ ...base, intercityTripId: 't1' }, settings, at(9)).fee).toBe(0);
    expect(quoteCancelFee(base, { ...settings, lateCancelFee: 0 }, at(9)).fee).toBe(0);
    expect(penaltiesApply({ serviceType: ServiceType.CARGO, intercityTripId: null })).toBe(true);
  });

  it("kelmaslik: yetib kelgandan 5 daqiqa keyin, server vaqti bo'yicha", () => {
    const arrived = { ...base, status: OrderStatus.ARRIVED, arrivedAt: at(0) };
    expect(checkNoShow(arrived, settings, at(4.9))).toEqual({
      allowed: false,
      reason: 'too_early',
      waitUntil: '2026-11-04T10:05:00.000Z',
    });
    expect(checkNoShow(arrived, settings, at(5))).toEqual({ allowed: true, fee: 5000 });
    expect(checkNoShow(base, settings, at(9))).toMatchObject({ allowed: false, reason: 'not_arrived' });
    expect(checkNoShow({ ...arrived, serviceType: ServiceType.PARCEL }, settings, at(9))).toMatchObject({ reason: 'not_taxi' });
  });
});
