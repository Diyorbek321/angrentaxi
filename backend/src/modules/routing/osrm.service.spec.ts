import axios from 'axios';
import { OsrmService, OSRM_PUBLIC_DEMO, Coordinate } from './osrm.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const get = jest.fn();

function makeService(osrmUrl?: string): OsrmService {
  mockedAxios.create.mockReturnValue({ get } as never);
  const config = { get: jest.fn().mockReturnValue(osrmUrl) };
  return new OsrmService(config as never);
}

describe('OsrmService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('base URL', () => {
    it('uses the configured OSRM_URL', () => {
      expect(makeService('http://osrm:5000').baseUrl).toBe('http://osrm:5000');
    });

    it('strips a trailing slash so path joins do not double up', () => {
      expect(makeService('http://osrm:5000/').baseUrl).toBe('http://osrm:5000');
    });

    it('falls back to the public demo server when unset', () => {
      expect(makeService('').baseUrl).toBe(OSRM_PUBLIC_DEMO);
    });
  });

  describe('durationsTo', () => {
    const sources: Coordinate[] = [
      [69.1, 40.1],
      [69.2, 40.2],
    ];
    const destination: Coordinate = [69.15, 40.15];

    it('returns one duration per source, in source order', async () => {
      get.mockResolvedValueOnce({
        data: { code: 'Ok', durations: [[420], [180]] },
      });

      const service = makeService('http://osrm:5000');

      await expect(service.durationsTo(sources, destination)).resolves.toEqual([
        420, 180,
      ]);
    });

    it('asks OSRM only for the source→destination column', async () => {
      get.mockResolvedValueOnce({ data: { code: 'Ok', durations: [[1], [2]] } });

      await makeService('http://osrm:5000').durationsTo(sources, destination);

      const [url, options] = get.mock.calls[0] as [string, { params: Record<string, string> }];
      // Destination is appended after the sources, so it is index 2 here.
      expect(url).toBe('/table/v1/driving/69.1,40.1;69.2,40.2;69.15,40.15');
      expect(options.params).toEqual({ sources: '0;1', destinations: '2' });
    });

    it('maps an unroutable source to null rather than dropping the row', async () => {
      get.mockResolvedValueOnce({
        data: { code: 'Ok', durations: [[null], [90]] },
      });

      await expect(
        makeService('http://osrm:5000').durationsTo(sources, destination),
      ).resolves.toEqual([null, 90]);
    });

    it('returns null when OSRM reports a non-Ok code', async () => {
      get.mockResolvedValueOnce({ data: { code: 'NoRoute' } });

      await expect(
        makeService('http://osrm:5000').durationsTo(sources, destination),
      ).resolves.toBeNull();
    });

    it('returns null when the request fails, so dispatch keeps its own order', async () => {
      get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(
        makeService('http://osrm:5000').durationsTo(sources, destination),
      ).resolves.toBeNull();
    });

    it('short-circuits an empty source list without calling OSRM', async () => {
      await expect(
        makeService('http://osrm:5000').durationsTo([], destination),
      ).resolves.toEqual([]);
      expect(get).not.toHaveBeenCalled();
    });
  });

  describe('matchTrace', () => {
    const trace: Coordinate[] = [
      [69.1, 40.1],
      [69.11, 40.11],
      [69.12, 40.12],
    ];

    it('returns the snapped distance, duration and geometry', async () => {
      get.mockResolvedValueOnce({
        data: {
          code: 'Ok',
          matchings: [
            {
              distance: 1500,
              duration: 240,
              geometry: { coordinates: [[69.1, 40.1], [69.12, 40.12]] },
            },
          ],
        },
      });

      await expect(
        makeService('http://osrm:5000').matchTrace(trace),
      ).resolves.toEqual({
        distanceMeters: 1500,
        durationSeconds: 240,
        geometry: [
          [69.1, 40.1],
          [69.12, 40.12],
        ],
      });
    });

    it('sums every matching OSRM returns for a chunk', async () => {
      get.mockResolvedValueOnce({
        data: {
          code: 'Ok',
          matchings: [
            { distance: 1000, duration: 100, geometry: { coordinates: [[69.1, 40.1]] } },
            { distance: 500, duration: 60, geometry: { coordinates: [[69.12, 40.12]] } },
          ],
        },
      });

      const result = await makeService('http://osrm:5000').matchTrace(trace);

      expect(result?.distanceMeters).toBe(1500);
      expect(result?.durationSeconds).toBe(160);
    });

    it('splits a trace longer than OSRM\'s 100-point cap into overlapping chunks', async () => {
      const long: Coordinate[] = Array.from(
        { length: 150 },
        (_, i) => [69.1 + i * 0.001, 40.1] as Coordinate,
      );
      get.mockResolvedValue({
        data: {
          code: 'Ok',
          matchings: [
            { distance: 100, duration: 10, geometry: { coordinates: [[69.1, 40.1]] } },
          ],
        },
      });

      const result = await makeService('http://osrm:5000').matchTrace(long);

      // 150 points at 99 new points per chunk → 2 requests, distances summed.
      expect(get).toHaveBeenCalledTimes(2);
      expect(result?.distanceMeters).toBe(200);
    });

    it('returns null if any chunk fails, rather than under-reporting the fare', async () => {
      const long: Coordinate[] = Array.from(
        { length: 150 },
        (_, i) => [69.1 + i * 0.001, 40.1] as Coordinate,
      );
      get
        .mockResolvedValueOnce({
          data: {
            code: 'Ok',
            matchings: [
              { distance: 100, duration: 10, geometry: { coordinates: [[69.1, 40.1]] } },
            ],
          },
        })
        .mockRejectedValueOnce(new Error('timeout'));

      await expect(
        makeService('http://osrm:5000').matchTrace(long),
      ).resolves.toBeNull();
    });

    it('returns null for a trace too short to match', async () => {
      await expect(
        makeService('http://osrm:5000').matchTrace([[69.1, 40.1]]),
      ).resolves.toBeNull();
      expect(get).not.toHaveBeenCalled();
    });

    it('returns null when OSRM finds no matching', async () => {
      get.mockResolvedValueOnce({ data: { code: 'Ok', matchings: [] } });

      await expect(
        makeService('http://osrm:5000').matchTrace(trace),
      ).resolves.toBeNull();
    });
  });
});
