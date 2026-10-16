import { latLngToCell } from 'h3-js';
import { SurgeService } from './surge.service';

// Angren city centre, and a point ~40 km away (well outside the zone ring).
const PICKUP = { lat: 40.1392, lng: 69.1225 };
const FAR_AWAY = { lat: 40.5, lng: 69.6 };

describe('SurgeService', () => {
  let orderRepository: { query: jest.Mock };
  let supply: { positionsNear: jest.Mock };
  let service: SurgeService;

  interface DemandRowFixture {
    passenger_id: string;
    lat: number;
    lng: number;
    status: string;
    cancel_reason: string | null;
    driver_id: string | null;
    lifetime_s: number;
  }

  /** Rows as the demand query returns them — one live request per passenger. */
  function requests(count: number, at = PICKUP, overrides: Partial<DemandRowFixture> = {}): DemandRowFixture[] {
    return Array.from({ length: count }, (_, i) => ({
      passenger_id: `passenger-${i}`,
      lat: at.lat,
      lng: at.lng,
      status: 'searching',
      cancel_reason: null,
      driver_id: null,
      lifetime_s: 5,
      ...overrides,
    }));
  }

  /** Eligible taxi drivers' positions, as TaxiSupplyService returns them. */
  function drivers(count: number, at = PICKUP) {
    return Array.from({ length: count }, () => ({ lat: at.lat, lng: at.lng }));
  }

  beforeEach(() => {
    orderRepository = { query: jest.fn().mockResolvedValue([]) };
    supply = { positionsNear: jest.fn().mockResolvedValue([]) };
    service = new SurgeService(orderRepository as never, supply as never);
  });

  describe('multiplierFor', () => {
    it('does not surge when supply meets demand', () => {
      expect(SurgeService.multiplierFor(5, 5)).toBe(1.0);
      expect(SurgeService.multiplierFor(3, 10)).toBe(1.0);
    });

    it('damps the excess ratio by half', () => {
      // 2 requests per driver → 1.5x, not 2x.
      expect(SurgeService.multiplierFor(10, 5)).toBe(1.5);
      expect(SurgeService.multiplierFor(6, 4)).toBe(1.3);
    });

    it('caps at the ceiling however extreme the ratio', () => {
      expect(SurgeService.multiplierFor(1000, 1)).toBe(SurgeService.MAX_MULTIPLIER);
    });

    it('goes to the ceiling — not beyond — when no drivers are online', () => {
      expect(SurgeService.multiplierFor(20, 0)).toBe(SurgeService.MAX_MULTIPLIER);
    });
  });

  describe('snapshotFor', () => {
    it('reports the H3 zone the pickup falls in', async () => {
      const snapshot = await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      expect(snapshot.zone).toBe(latLngToCell(PICKUP.lat, PICKUP.lng, 8));
    });

    it('stays at 1.0 while requests are too few to mean anything', async () => {
      // 2 requests and zero drivers would otherwise hit the ceiling.
      orderRepository.query.mockResolvedValue(requests(2));
      supply.positionsNear.mockResolvedValue(drivers(0));

      const snapshot = await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      expect(snapshot.multiplier).toBe(1.0);
      expect(snapshot.demand).toBe(2);
    });

    it('surges once demand outruns the drivers on hand', async () => {
      orderRepository.query.mockResolvedValue(requests(8));
      supply.positionsNear.mockResolvedValue(drivers(4));

      const snapshot = await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      expect(snapshot).toMatchObject({ demand: 8, supply: 4, multiplier: 1.5 });
    });

    it('ignores requests outside the zone', async () => {
      orderRepository.query.mockResolvedValue([
        ...requests(2),
        ...requests(20, FAR_AWAY),
      ]);
      supply.positionsNear.mockResolvedValue(drivers(1));

      const snapshot = await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      // Only the 2 local requests count, which is below the noise floor.
      expect(snapshot.demand).toBe(2);
      expect(snapshot.multiplier).toBe(1.0);
    });

    it('counts requests in a neighbouring cell as the same zone', async () => {
      // ~1 km north — a different H3 cell, still inside the ring.
      const neighbour = { lat: PICKUP.lat + 0.009, lng: PICKUP.lng };
      expect(latLngToCell(neighbour.lat, neighbour.lng, 8)).not.toBe(
        latLngToCell(PICKUP.lat, PICKUP.lng, 8),
      );

      orderRepository.query.mockResolvedValue(requests(6, neighbour));
      supply.positionsNear.mockResolvedValue(drivers(3));

      const snapshot = await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      expect(snapshot.demand).toBe(6);
      expect(snapshot.multiplier).toBe(1.5);
    });

    it('never surges on a failed query', async () => {
      orderRepository.query.mockRejectedValue(new Error('db down'));

      const snapshot = await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      expect(snapshot.multiplier).toBe(1.0);
    });

    it('never surges when the driver count is unavailable', async () => {
      orderRepository.query.mockResolvedValue(requests(20));
      supply.positionsNear.mockRejectedValue(
        new Error('redis down'),
      );

      const snapshot = await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      expect(snapshot.multiplier).toBe(1.0);
    });

    it('reads only the recent demand window', async () => {
      await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      const sql = orderRepository.query.mock.calls[0][0] as string;
      expect(sql).toContain("INTERVAL '10 minutes'");
    });

    /**
     * Rejalashtirilgan buyurtmalar talabga kirmasligi.
     *
     * Ular `created_at` bo'yicha 10 daqiqalik oynaga tushadi, lekin HOZIR
     * haydovchi so'ramayapti. Filtrisiz kechqurun ertangi safarni
     * rejalashtirgan besh kishi hozirgi surge'ni ko'tarib, o'sha daqiqada
     * haqiqiy safar buyurtma qilayotgan yo'lovchilardan ortiqcha pul
     * olinishiga sabab bo'lardi.
     */
    it('excludes scheduled orders from the demand count', async () => {
      await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      const sql = orderRepository.query.mock.calls[0][0] as string;
      expect(sql).toContain("status <> 'scheduled'");
    });
  });

  /**
   * Surge o'z muvaffaqiyatsizligidan oziqlanmasligi kerak: bo'sh hududda
   * bitta yo'lovchi 3 marta qayta urinsa, talab 3 bo'lib 2.0× chiqardi.
   */
  describe('demand definition', () => {
    it('counts one passenger retrying in an empty zone once — no surge', async () => {
      // Bir yo'lovchi: ikki marta "No drivers available", uchinchisi qidiruvda.
      orderRepository.query.mockResolvedValue([
        ...requests(1, PICKUP, { passenger_id: 'p-1' }),
        ...requests(2, PICKUP, {
          passenger_id: 'p-1',
          status: 'cancelled',
          cancel_reason: 'No drivers available',
          lifetime_s: 120,
        }),
      ]);
      supply.positionsNear.mockResolvedValue([]);

      const snapshot = await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      expect(snapshot.demand).toBe(1);
      expect(snapshot.multiplier).toBe(1.0);
    });

    it('keeps no-driver cancellations as real demand (distinct passengers)', async () => {
      orderRepository.query.mockResolvedValue(
        requests(3, PICKUP, { status: 'cancelled', cancel_reason: 'No drivers available', lifetime_s: 20 }),
      );
      supply.positionsNear.mockResolvedValue([]);

      const snapshot = await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      expect(snapshot.demand).toBe(3);
      expect(snapshot.multiplier).toBe(SurgeService.MAX_MULTIPLIER);
    });

    it('drops orders the passenger cancelled within a minute of creating them', async () => {
      orderRepository.query.mockResolvedValue([
        ...requests(3, PICKUP, { status: 'cancelled', cancel_reason: null, lifetime_s: 30 }).map((row, i) => ({
          ...row,
          passenger_id: `quick-${i}`,
        })),
        ...requests(2),
      ]);

      const snapshot = await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      expect(snapshot.demand).toBe(2);
    });

    it('still counts a cancellation that came after the first minute, or after a driver accepted', async () => {
      orderRepository.query.mockResolvedValue([
        { ...requests(1, PICKUP, { status: 'cancelled', lifetime_s: 300 })[0], passenger_id: 'late' },
        { ...requests(1, PICKUP, { status: 'cancelled', driver_id: 'd-1', lifetime_s: 30 })[0], passenger_id: 'driver' },
      ]);

      const snapshot = await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      expect(snapshot.demand).toBe(2);
    });

    it('reads only taxi-service orders (no food/market courier rides)', async () => {
      await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      const sql = orderRepository.query.mock.calls[0][0] as string;
      expect(sql).toContain("service_type = 'taxi'");
      // Bir yo'lovchining eng so'nggi so'rovi birinchi keladi — dedup shunga tayanadi.
      expect(sql).toContain('ORDER BY created_at DESC');
    });

    it('asks the supply side for taxi drivers within the reach radius of the pickup', async () => {
      await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      expect(supply.positionsNear).toHaveBeenCalledWith(PICKUP.lat, PICKUP.lng, 2);
    });
  });
});
