import { cellToLatLng, gridDisk, latLngToCell } from 'h3-js';
import { SurgeController, SurgeZoneFeature } from './surge.controller';
import { SurgeService } from './surge.service';

// Angren city centre.
const CENTRE = { lat: 40.1392, lng: 69.1225 };

/** Cells in a disc of [rings] rings: 1, 7, 19, 37, 61, 91, 127. */
function cellsIn(rings: number): number {
  return 3 * rings * rings + 3 * rings + 1;
}

describe('SurgeController', () => {
  let orderRepository: { query: jest.Mock };
  let driversService: { countOnlineDriversNear: jest.Mock };
  let controller: SurgeController;

  /** Rows as the pickup-coordinate query returns them. */
  function requests(count: number, at = CENTRE) {
    return Array.from({ length: count }, () => ({ lat: at.lat, lng: at.lng }));
  }

  /**
   * The hexagon the map is centred on. Every assertion about a level looks it
   * up by H3 index rather than by position: gridDisk's ordering is an
   * implementation detail of h3-js, not a contract.
   */
  function centreFeature(features: SurgeZoneFeature[]): SurgeZoneFeature {
    const zone = latLngToCell(CENTRE.lat, CENTRE.lng, 8);
    const feature = features.find((f) => f.properties.zone === zone);

    if (!feature) throw new Error('centre hexagon missing from the map');
    return feature;
  }

  /** Puts the whole city at one demand/supply ratio and returns the map. */
  async function mapWith(demand: number, supply: number) {
    orderRepository.query.mockResolvedValue(requests(demand));
    driversService.countOnlineDriversNear.mockResolvedValue(supply);

    return controller.zones({ lat: CENTRE.lat, lng: CENTRE.lng, rings: 1 });
  }

  beforeEach(() => {
    orderRepository = { query: jest.fn().mockResolvedValue([]) };
    driversService = { countOnlineDriversNear: jest.fn().mockResolvedValue(0) };
    controller = new SurgeController(
      new SurgeService(orderRepository as never, driversService as never),
    );
  });

  describe('response shape', () => {
    it('answers with a FeatureCollection of Polygon features', async () => {
      const result = await controller.zones({
        lat: CENTRE.lat,
        lng: CENTRE.lng,
        rings: 1,
      });

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(cellsIn(1));

      for (const feature of result.features) {
        expect(feature.type).toBe('Feature');
        expect(feature.geometry.type).toBe('Polygon');
        // A Polygon's coordinates are an array *of rings*, not a ring.
        expect(feature.geometry.coordinates).toHaveLength(1);
      }
    });

    it('returns one feature per hexagon, with no zone repeated', async () => {
      const result = await controller.zones({
        lat: CENTRE.lat,
        lng: CENTRE.lng,
        rings: 2,
      });

      const zones = result.features.map((f) => f.properties.zone);

      expect(zones).toHaveLength(cellsIn(2));
      expect(new Set(zones).size).toBe(cellsIn(2));
      expect(new Set(zones)).toEqual(
        new Set(gridDisk(latLngToCell(CENTRE.lat, CENTRE.lng, 8), 2)),
      );
    });

    it('defaults to the standard radius when rings is omitted', async () => {
      const result = await controller.zones({
        lat: CENTRE.lat,
        lng: CENTRE.lng,
      });

      expect(result.features).toHaveLength(
        cellsIn(SurgeService.DEFAULT_MAP_RINGS),
      );
    });

    it('caps an oversized radius instead of melting Redis', async () => {
      const result = await controller.zones({
        lat: CENTRE.lat,
        lng: CENTRE.lng,
        rings: 500,
      });

      expect(result.features).toHaveLength(cellsIn(SurgeService.MAX_MAP_RINGS));
    });
  });

  describe('coordinate order', () => {
    it('emits [lng, lat] pairs, not h3-js’s native [lat, lng]', async () => {
      const result = await controller.zones({
        lat: CENTRE.lat,
        lng: CENTRE.lng,
        rings: 0,
      });

      const [ring] = centreFeature(result.features).geometry.coordinates;
      const [centreLat, centreLng] = cellToLatLng(
        latLngToCell(CENTRE.lat, CENTRE.lng, 8),
      );

      // A resolution-8 hexagon is ~1 km across, so every vertex sits within a
      // hundredth of a degree of the centre. Swap the pair and longitude lands
      // near 40 while latitude lands near 69 — both fail by ~29 degrees.
      for (const [lng, lat] of ring) {
        expect(Math.abs(lng - centreLng)).toBeLessThan(0.02);
        expect(Math.abs(lat - centreLat)).toBeLessThan(0.02);
      }

      // Sanity check that the tolerance above could actually catch a swap.
      expect(Math.abs(centreLng - centreLat)).toBeGreaterThan(1);
    });

    it('closes the ring, as GeoJSON requires', async () => {
      const result = await controller.zones({
        lat: CENTRE.lat,
        lng: CENTRE.lng,
        rings: 0,
      });

      const [ring] = centreFeature(result.features).geometry.coordinates;

      // Six corners plus the repeated first vertex.
      expect(ring).toHaveLength(7);
      expect(ring[ring.length - 1]).toEqual(ring[0]);
    });
  });

  describe('level thresholds', () => {
    it('reads normal below 1.2x', async () => {
      // 6 requests against 5 drivers → 1.1x.
      const result = await mapWith(6, 5);
      const centre = centreFeature(result.features);

      expect(centre.properties.multiplier).toBe(1.1);
      expect(centre.properties.level).toBe('normal');
    });

    it('reads normal when nothing is happening', async () => {
      const result = await mapWith(0, 5);
      const centre = centreFeature(result.features);

      expect(centre.properties.multiplier).toBe(1.0);
      expect(centre.properties.level).toBe('normal');
    });

    it('reads elevated at exactly 1.2x', async () => {
      // 7 requests against 5 drivers → 1.2x, the first non-normal bucket.
      const result = await mapWith(7, 5);
      const centre = centreFeature(result.features);

      expect(centre.properties.multiplier).toBe(1.2);
      expect(centre.properties.level).toBe('elevated');
    });

    it('still reads elevated just under 1.6x', async () => {
      // 10 requests against 5 drivers → 1.5x.
      const result = await mapWith(10, 5);
      const centre = centreFeature(result.features);

      expect(centre.properties.multiplier).toBe(1.5);
      expect(centre.properties.level).toBe('elevated');
    });

    it('reads high at exactly 1.6x', async () => {
      // 11 requests against 5 drivers → 1.6x.
      const result = await mapWith(11, 5);
      const centre = centreFeature(result.features);

      expect(centre.properties.multiplier).toBe(1.6);
      expect(centre.properties.level).toBe('high');
    });

    it('reads high when demand has nobody at all to serve it', async () => {
      const result = await mapWith(8, 0);
      const centre = centreFeature(result.features);

      expect(centre.properties.multiplier).toBe(SurgeService.MAX_MULTIPLIER);
      expect(centre.properties.level).toBe('high');
    });

    it('keeps the multiplier in the payload for analytics, alongside the level', async () => {
      const result = await mapWith(10, 5);

      for (const feature of result.features) {
        expect(feature.properties).toEqual(
          expect.objectContaining({
            zone: expect.any(String),
            level: expect.any(String),
            multiplier: expect.any(Number),
          }),
        );
      }
    });
  });

  describe('quiet and empty maps', () => {
    it('draws an all-normal map when the city has no orders at all', async () => {
      orderRepository.query.mockResolvedValue([]);
      driversService.countOnlineDriversNear.mockResolvedValue(4);

      const result = await controller.zones({
        lat: CENTRE.lat,
        lng: CENTRE.lng,
        rings: 2,
      });

      expect(result.features).toHaveLength(cellsIn(2));
      expect(
        result.features.every((f) => f.properties.level === 'normal'),
      ).toBe(true);
      expect(
        result.features.every((f) => f.properties.multiplier === 1.0),
      ).toBe(true);
    });

    it('leaves a far-away zone normal while its neighbour surges', async () => {
      // Demand sits on the centre; the outer ring of a 4-ring disc is well
      // outside the centre's neighbour ring and must stay untouched.
      orderRepository.query.mockResolvedValue(requests(20));
      driversService.countOnlineDriversNear.mockResolvedValue(2);

      const result = await controller.zones({
        lat: CENTRE.lat,
        lng: CENTRE.lng,
        rings: 4,
      });

      expect(centreFeature(result.features).properties.level).toBe('high');
      expect(
        result.features.some((f) => f.properties.level === 'normal'),
      ).toBe(true);
    });

    it('clears the map rather than guessing when the demand read fails', async () => {
      orderRepository.query.mockRejectedValue(new Error('db down'));

      const result = await controller.zones({
        lat: CENTRE.lat,
        lng: CENTRE.lng,
        rings: 1,
      });

      // Still a valid FeatureCollection, so the client's source binding holds.
      expect(result).toEqual({ type: 'FeatureCollection', features: [] });
    });

    it('clears the map when the driver count is unavailable', async () => {
      orderRepository.query.mockResolvedValue(requests(20));
      driversService.countOnlineDriversNear.mockRejectedValue(
        new Error('redis down'),
      );

      const result = await controller.zones({
        lat: CENTRE.lat,
        lng: CENTRE.lng,
        rings: 1,
      });

      expect(result.features).toEqual([]);
    });
  });

  describe('cost', () => {
    it('reads recent demand once for the whole map, not once per hexagon', async () => {
      await controller.zones({ lat: CENTRE.lat, lng: CENTRE.lng, rings: 4 });

      expect(orderRepository.query).toHaveBeenCalledTimes(1);
      expect(driversService.countOnlineDriversNear).toHaveBeenCalledTimes(
        cellsIn(4),
      );
    });
  });
});
