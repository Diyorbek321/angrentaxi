import { UsersService } from './users.service';
import { User, UserRole } from '../../database/entities/user.entity';

/** Push tokeni va javob roli sessiyaga qarab (`auth/session-role.ts`). */
describe('UsersService — sessiya roli bilan', () => {
  let repo: { update: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let service: UsersService;

  const driverRow = { id: 'u1', role: UserRole.DRIVER, fcmToken: 'drv' } as User;
  const passengerSession = { role: UserRole.PASSENGER, accountRole: UserRole.DRIVER };

  beforeEach(() => {
    repo = {
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(async (u: User) => u),
      findOne: jest.fn().mockResolvedValue(driverRow),
    };
    service = Object.assign(Object.create(UsersService.prototype) as UsersService, {
      userRepository: repo,
    });
  });

  it("yo'lovchi ilovasidagi haydovchi tokeni alohida ustunga", async () => {
    await service.updateFcmToken('u1', 'pax-token', passengerSession);
    expect(repo.update).toHaveBeenCalledWith('u1', { passengerAppFcmToken: 'pax-token' });
  });

  it('driver ilovasi / sessiyasiz — fcmToken', async () => {
    await service.updateFcmToken('u1', 't1', { role: UserRole.DRIVER, accountRole: UserRole.DRIVER });
    await service.updateFcmToken('u1', 't2');
    expect(repo.update).toHaveBeenNthCalledWith(1, 'u1', { fcmToken: 't1' });
    expect(repo.update).toHaveBeenNthCalledWith(2, 'u1', { fcmToken: 't2' });
  });

  it("PATCH /users/me — javobda sessiya roli, bazaga rol yozilmaydi", async () => {
    const result = await service.update('u1', { fcmToken: 'pax-token' }, passengerSession);

    const saved = repo.save.mock.calls[0][0] as User;
    expect(saved.role).toBe(UserRole.DRIVER);
    expect(saved.passengerAppFcmToken).toBe('pax-token');
    expect(saved.fcmToken).toBe('drv');
    expect(result.role).toBe(UserRole.PASSENGER);
    expect(result.accountRole).toBe(UserRole.DRIVER);
  });
});
