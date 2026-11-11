import { ForbiddenException } from '@nestjs/common';
import { UserStatus } from '../../database/entities/user.entity';
import { DriversService } from './drivers.service';

/**
 * Bloklangan haydovchi taklif OLMAYDI:
 *   - bloklanganda u darhol oflayn qilinadi (is_online, geo-to'plam, mavjudlik);
 *   - nomzodlar va yurak urishi faqat ACTIVE foydalanuvchilarni oladi, ya'ni
 *     uzilmay qolgan socket ham uni qayta "tirik" qila olmaydi.
 */
describe('DriversService — bloklangan haydovchi', () => {
  const PICKUP = { lat: 41.02, lng: 70.08 };

  interface Row {
    id: string;
    userId: string;
    approvedTariffTier: number;
    serviceTypes: null;
    vehicleType: null;
    isOnline: boolean;
    user: { status: UserStatus };
  }

  let pool: Row[];
  let driverRepository: Record<string, jest.Mock>;
  let redis: Record<string, jest.Mock>;
  let usersService: { onUserBlocked: jest.Mock };
  let service: DriversService;

  const row = (id: string, status: UserStatus): Row => ({
    id,
    userId: `user-${id}`,
    approvedTariffTier: 1,
    serviceTypes: null,
    vehicleType: null,
    isOnline: true,
    user: { status },
  });

  /** TypeORM `where` ning shu yerda ishlatiladigan qismini hurmat qiladi. */
  const matches = (d: Row, where: Record<string, unknown>) => {
    const ids = (where.id as { value?: string[] } | undefined)?.value;
    const userIds = (where.userId as { value?: string[] } | undefined)?.value;
    const status = (where.user as { status?: UserStatus } | undefined)?.status;
    return (
      (!ids || ids.includes(d.id)) &&
      (!userIds || userIds.includes(d.userId)) &&
      (where.isOnline === undefined || d.isOnline === where.isOnline) &&
      (!status || d.user.status === status)
    );
  };

  beforeEach(() => {
    pool = [row('active', UserStatus.ACTIVE), row('blocked', UserStatus.BLOCKED)];
    driverRepository = {
      find: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(pool.filter((d) => matches(d, where))),
      ),
      findOne: jest.fn(({ where }: { where: { userId?: string } }) =>
        Promise.resolve(pool.find((d) => d.userId === where.userId) ?? null),
      ),
      query: jest.fn(() => Promise.resolve([])),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
    };
    redis = {
      georadius: jest.fn(() =>
        Promise.resolve(pool.map((d, i) => [d.id, String(0.5 + i * 0.1), [String(PICKUP.lng), String(PICKUP.lat)]])),
      ),
      mget: jest.fn((...keys: string[]) => Promise.resolve(keys.map(() => '1'))),
      zrem: jest.fn(() => Promise.resolve(1)),
      set: jest.fn(() => Promise.resolve('OK')),
      del: jest.fn(() => Promise.resolve(1)),
    };
    usersService = { onUserBlocked: jest.fn() };
    service = new DriversService(
      driverRepository as never,
      {} as never,
      redis as never,
      usersService as never,
      {} as never,
      {} as never,
    );
  });

  it('getNearbyDrivers bloklangan haydovchini nomzod qilmaydi', async () => {
    const ids = (await service.getNearbyDrivers(PICKUP.lat, PICKUP.lng, 3)).map((d) => d.driverId);

    expect(ids).toEqual(['active']);
    expect(driverRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ user: { status: UserStatus.ACTIVE } }) }),
    );
  });

  it('touchPresence bloklangan haydovchining mavjudligini uzaytirmaydi', async () => {
    await service.touchPresence(['user-active', 'user-blocked']);

    expect(redis.set).toHaveBeenCalledWith('driver:presence:active', '1', 'EX', expect.any(Number));
    expect(redis.set).not.toHaveBeenCalledWith('driver:presence:blocked', expect.anything(), 'EX', expect.any(Number));
  });

  it('bloklanganda: is_online=false, geo-to‘plamdan chiqadi, mavjudlik o‘chadi', async () => {
    await service.forceOffline('user-blocked');

    expect(driverRepository.update).toHaveBeenCalledWith('blocked', { isOnline: false });
    expect(redis.zrem).toHaveBeenCalledWith('drivers:online', 'blocked');
    expect(redis.del).toHaveBeenCalledWith('driver:presence:blocked');
  });

  it('forceOffline haydovchi profili yo‘q foydalanuvchi uchun jim o‘tadi', async () => {
    await expect(service.forceOffline('user-nobody')).resolves.toBeUndefined();
    expect(driverRepository.update).not.toHaveBeenCalled();
  });

  it('modul ishga tushganda bloklash tinglovchisi ro‘yxatdan o‘tadi va forceOffline ni chaqiradi', async () => {
    service.onModuleInit();
    expect(usersService.onUserBlocked).toHaveBeenCalledTimes(1);

    const listener = usersService.onUserBlocked.mock.calls[0][0] as (id: string) => Promise<void>;
    await listener('user-blocked');

    expect(redis.zrem).toHaveBeenCalledWith('drivers:online', 'blocked');
  });

  it('bloklangan haydovchi onlayn chiqa olmaydi', async () => {
    await expect(service.setOnlineStatus('user-blocked', true)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
