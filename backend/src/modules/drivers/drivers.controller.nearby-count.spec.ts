import { PATH_METADATA } from '@nestjs/common/constants';
import { ValidationPipe } from '@nestjs/common';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { PASSENGER_APP_ROLES } from '../../database/entities/user.entity';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { NearbyCountQueryDto } from './dto/nearby-count-query.dto';

/**
 * `GET /drivers/nearby-count` — yo'lovchi qidiruv ekrani va buyurtmadan
 * oldingi ogohlantirish uchun. Faqat SON (koordinatalar berilmaydi).
 */
describe('DriversController.getNearbyCount', () => {
  const proto = DriversController.prototype as unknown as Record<string, () => unknown>;

  function build(count: number) {
    const countFreeDriversNear = jest.fn().mockResolvedValue(count);
    const controller = new DriversController(
      { countFreeDriversNear } as unknown as DriversService,
      {} as never,
      {} as never,
      {} as never,
    );
    return { controller, countFreeDriversNear };
  }

  it('qidiruvning eng keng radiusidagi (5 km) sonni qaytaradi — boshqa hech narsa', async () => {
    const { controller, countFreeDriversNear } = build(3);

    const result = await controller.getNearbyCount({ lat: 41.0167, lng: 70.1436 });

    expect(result).toEqual({ count: 3, radiusKm: 5 });
    expect(countFreeDriversNear).toHaveBeenCalledWith(41.0167, 70.1436, 5);
  });

  it("yo'lovchi ilovasi rollari; marshrut ':id' dan OLDIN", () => {
    expect(Reflect.getMetadata(ROLES_KEY, proto.getNearbyCount)).toEqual([...PASSENGER_APP_ROLES]);
    expect(Reflect.getMetadata(PATH_METADATA, proto.getNearbyCount)).toBe('nearby-count');
    const names = Object.getOwnPropertyNames(DriversController.prototype);
    expect(names.indexOf('getNearbyCount')).toBeLessThan(names.indexOf('findOne'));
  });

  it("noto'g'ri koordinata — 400", async () => {
    const pipe = new ValidationPipe({ transform: true });
    await expect(
      pipe.transform({ lat: '200', lng: '70' }, { type: 'query', metatype: NearbyCountQueryDto }),
    ).rejects.toBeDefined();
    await expect(
      pipe.transform({ lat: '41.01', lng: '70.14' }, { type: 'query', metatype: NearbyCountQueryDto }),
    ).resolves.toEqual({ lat: 41.01, lng: 70.14 });
  });
});
