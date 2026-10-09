import { BadRequestException } from '@nestjs/common';
import { OrdersMeterService } from './orders-meter.service';
import { OrderStatus } from '../../database/entities/order.entity';
import { UserRole } from '../../database/entities/user.entity';
import { TariffsService } from '../tariffs/tariffs.service';

const NOW = new Date('2026-10-06T10:30:00Z');
const tariff = {
  id: 't-1', basePrice: 3000, pricePerKm: 1500, pricePerMin: 200, minPrice: 5000,
  maxPrice: null, surgeMultiplier: 1, freeWaitMinutes: 3, waitingPricePerMinute: 500,
};

function build(order: Record<string, unknown>, liveKm = 4) {
  const tariffs = new TariffsService({} as never);
  const service = new OrdersMeterService(
    { findOne: jest.fn(async () => ({ startTime: new Date('2026-10-06T10:18:00Z') })) } as never,
    { findByIdForUser: jest.fn(async () => order) } as never,
    { findById: jest.fn(async () => tariff), calculatePriceBreakdown: tariffs.calculatePriceBreakdown.bind(tariffs) } as never,
    { liveDistanceKm: jest.fn(async () => liveKm) } as never,
  );
  return service;
}

const passenger = { id: 'p-1', role: UserRole.PASSENGER };

describe('OrdersMeterService.reading', () => {
  it('adds up base, distance, time and waiting by the tariff', async () => {
    const service = build({
      id: 'o-1', isMetered: true, status: OrderStatus.IN_PROGRESS, tariffId: 't-1',
      // Waited 8 min at pickup, 3 free → 5 paid minutes.
      arrivedAt: new Date('2026-10-06T10:10:00Z'),
    });

    const reading = await service.reading('o-1', passenger, NOW);

    expect(reading.distanceKm).toBe(4);
    expect(reading.durationMin).toBe(12);
    expect(reading.waitingFare).toBe(2500);
    // 3000 + 4×1500 + 12×200 + 2500
    expect(reading.fare).toBe(13900);
  });

  it("adds the trip option fee frozen in the order's quote", async () => {
    const service = build({
      id: 'o-1', isMetered: true, status: OrderStatus.IN_PROGRESS, tariffId: 't-1',
      arrivedAt: null,
      fareBreakdown: { optionsFare: 5000, optionCharges: [{ option: 'child_seat', fee: 5000 }] },
    });

    const reading = await service.reading('o-1', passenger, NOW);

    expect(reading.optionsFare).toBe(5000);
    // 3000 + 4×1500 + 12×200 + 5000
    expect(reading.fare).toBe(16400);
  });

  it('only for a metered ride that is under way', async () => {
    await expect(
      build({ isMetered: false, status: OrderStatus.IN_PROGRESS, tariffId: 't-1' }).reading('o-1', passenger, NOW),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      build({ isMetered: true, status: OrderStatus.ARRIVED, tariffId: 't-1' }).reading('o-1', passenger, NOW),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
