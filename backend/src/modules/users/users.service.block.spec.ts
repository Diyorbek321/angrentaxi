import { UserStatus } from '../../database/entities/user.entity';
import { UsersService } from './users.service';

/**
 * Bloklash faqat `status` ni yozardi: haydovchi onlayn qolib, geo-to'plamda
 * turib taklif olishda davom etardi. Endi bloklash ro'yxatdan o'tgan
 * tinglovchilarni (DriversService — oflayn qilish, RealtimeGateway —
 * socketlarni uzish) chaqiradi. UsersService ularga bog'lanmaydi: ikkalasi
 * ham UsersService ga bog'liq, to'g'ridan-to'g'ri chaqiruv aylanma bog'liqlik
 * bo'lardi.
 */
describe('UsersService.blockUser — bloklash oqibatlari', () => {
  const user = { id: 'u-1', status: UserStatus.ACTIVE };

  function build() {
    const repo = {
      findOne: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    return { service: new UsersService(repo as never), repo };
  }

  it('status yozilgach har bir tinglovchi foydalanuvchi ID si bilan chaqiriladi', async () => {
    const { service, repo } = build();
    const first = jest.fn().mockResolvedValue(undefined);
    const second = jest.fn().mockResolvedValue(undefined);
    service.onUserBlocked(first);
    service.onUserBlocked(second);

    const result = await service.blockUser('u-1', 'fraud');

    expect(repo.update).toHaveBeenCalledWith('u-1', { status: UserStatus.BLOCKED, blockReason: 'fraud' });
    expect(first).toHaveBeenCalledWith('u-1');
    expect(second).toHaveBeenCalledWith('u-1');
    expect(result.status).toBe(UserStatus.BLOCKED);
  });

  it('tinglovchi yiqilsa ham bloklash bajariladi va qolganlari chaqiriladi', async () => {
    const { service } = build();
    const failing = jest.fn().mockRejectedValue(new Error('redis down'));
    const other = jest.fn().mockResolvedValue(undefined);
    service.onUserBlocked(failing);
    service.onUserBlocked(other);

    await expect(service.blockUser('u-1')).resolves.toEqual(
      expect.objectContaining({ status: UserStatus.BLOCKED }),
    );
    expect(other).toHaveBeenCalledWith('u-1');
  });
});
