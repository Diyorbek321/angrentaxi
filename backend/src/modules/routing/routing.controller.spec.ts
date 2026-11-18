import { BadRequestException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RoutingController, parseRouteCoords } from './routing.controller';
import { RouteQueryDto } from './dto/route-query.dto';

describe('RoutingController', () => {
  const route = jest.fn();
  const controller = new RoutingController({ route } as never);

  beforeEach(() => jest.clearAllMocks());

  it('passes parsed [lng, lat] pairs to OSRM in order', async () => {
    const result = { distance: 1200, duration: 180, geometry: {}, legs: [] };
    route.mockResolvedValueOnce(result);

    await expect(
      controller.route({ coords: '70.07,41.02;70.08,41.03;70.1,41.05' }),
    ).resolves.toBe(result);
    expect(route).toHaveBeenCalledWith([
      [70.07, 41.02],
      [70.08, 41.03],
      [70.1, 41.05],
    ]);
  });

  it('answers 404 when OSRM has no route, so the app draws a straight line', async () => {
    route.mockResolvedValueOnce(null);
    await expect(controller.route({ coords: '70,41;70.1,41.1' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects out-of-range coordinates', () => {
    expect(() => parseRouteCoords('190,41;70,41')).toThrow(BadRequestException);
    expect(() => parseRouteCoords('70,95;70,41')).toThrow(BadRequestException);
  });

  describe('RouteQueryDto', () => {
    const errorsFor = (coords: string) =>
      validate(plainToInstance(RouteQueryDto, { coords }));

    it.each([
      '70.07,41.02;70.08,41.03',
      '-1.5,-2.25;3,4',
      Array.from({ length: 10 }, (_, i) => `70.${i},41.${i}`).join(';'),
    ])('accepts %s', async (coords) => {
      expect(await errorsFor(coords)).toHaveLength(0);
    });

    it.each([
      '70.07,41.02',
      '70,41;',
      'abc,41;70,41',
      '70,41;70,41;../../etc',
      Array.from({ length: 11 }, (_, i) => `70.${i},41.${i}`).join(';'),
    ])('rejects %s', async (coords) => {
      expect(await errorsFor(coords)).not.toHaveLength(0);
    });
  });
});
