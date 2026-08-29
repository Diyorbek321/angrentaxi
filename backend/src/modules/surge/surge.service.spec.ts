import { latLngToCell } from 'h3-js';
import { SurgeService } from './surge.service';

// Angren city centre, and a point ~40 km away (well outside the zone ring).
const PICKUP = { lat: 40.1392, lng: 69.1225 };
const FAR_AWAY = { lat: 40.5, lng: 69.6 };

describe('SurgeService', () => {
  let orderRepository: { query: jest.Mock };
  let driversService: { countOnlineDriversNear: jest.Mock };
  let service: SurgeService;

  /** Rows as the pickup-coordinate query returns them. */
  function requests(count: number, at = PICKUP) {
    return Array.from({ length: count }, () => ({ lat: at.lat, lng: at.lng }));
  }

  beforeEach(() => {
    orderRepository = { query: jest.fn().mockResolvedValue([]) };
    driversService = { countOnlineDriversNear: jest.fn().mockResolvedValue(0) };
    service = new SurgeService(orderRepository as never, driversService as never);
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
      driversService.countOnlineDriversNear.mockResolvedValue(0);

      const snapshot = await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      expect(snapshot.multiplier).toBe(1.0);
      expect(snapshot.demand).toBe(2);
    });

    it('surges once demand outruns the drivers on hand', async () => {
      orderRepository.query.mockResolvedValue(requests(8));
      driversService.countOnlineDriversNear.mockResolvedValue(4);

      const snapshot = await service.snapshotFor(PICKUP.lat, PICKUP.lng);

      expect(snapshot).toMatchObject({ demand: 8, supply: 4, multiplier: 1.5 });
    });

    it('ignores requests outside the zone', async () => {
      orderRepository.query.mockResolvedValue([
        ...requests(2),
        ...requests(20, FAR_AWAY),
      ]);
      driversService.countOnlineDriversNear.mockResolvedValue(1);

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
      driversService.countOnlineDriversNear.mockResolvedValue(3);

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
      driversService.countOnlineDriversNear.mockRejectedValue(
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
});
