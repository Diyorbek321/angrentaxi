import { User, UserRole } from '../../database/entities/user.entity';
import {
  accountRoleOf,
  isClientApp,
  isDriverActingAsPassenger,
  isDualRoleLoginEnabled,
  resolveSessionRole,
  withSessionRole,
} from './session-role';

function makeUser(role: UserRole): User {
  const user = new User();
  user.id = 'u1';
  user.phone = '+998901112233';
  user.role = role;
  return user;
}

describe('resolveSessionRole', () => {
  it('haydovchi yo\'lovchi ilovasida — passenger', () => {
    expect(resolveSessionRole(UserRole.DRIVER, 'passenger', true)).toBe(UserRole.PASSENGER);
  });

  it('haydovchi driver ilovasida — driver', () => {
    expect(resolveSessionRole(UserRole.DRIVER, 'driver', true)).toBe(UserRole.DRIVER);
  });

  it('app yo\'q (eski token) — bazadagi rol', () => {
    expect(resolveSessionRole(UserRole.DRIVER, undefined, true)).toBe(UserRole.DRIVER);
    expect(resolveSessionRole(UserRole.DRIVER, null, true)).toBe(UserRole.DRIVER);
  });

  it('flag o\'chiq — B reja: doim bazadagi rol', () => {
    expect(resolveSessionRole(UserRole.DRIVER, 'passenger', false)).toBe(UserRole.DRIVER);
  });

  it.each([UserRole.PASSENGER, UserRole.MANAGER, UserRole.ADMIN, UserRole.MARKET, UserRole.RESTAURANT])(
    '%s roli hech qachon o\'zgarmaydi (app imtiyoz BERA olmaydi)',
    (role) => {
      expect(resolveSessionRole(role, 'passenger', true)).toBe(role);
      expect(resolveSessionRole(role, 'driver', true)).toBe(role);
    },
  );
});

describe('withSessionRole', () => {
  it('nusxa qaytaradi, asl obyekt o\'zgarmaydi, prototip saqlanadi', () => {
    const user = makeUser(UserRole.DRIVER);
    const scoped = withSessionRole(user, 'passenger', true);

    expect(scoped).not.toBe(user);
    expect(scoped).toBeInstanceOf(User);
    expect(scoped.role).toBe(UserRole.PASSENGER);
    expect(scoped.accountRole).toBe(UserRole.DRIVER);
    expect(scoped.id).toBe('u1');
    expect(user.role).toBe(UserRole.DRIVER);
    expect(user.accountRole).toBeUndefined();
  });

  it('rol o\'zgarmasa ham accountRole qo\'yiladi', () => {
    const scoped = withSessionRole(makeUser(UserRole.PASSENGER), 'passenger', true);
    expect(scoped.role).toBe(UserRole.PASSENGER);
    expect(scoped.accountRole).toBe(UserRole.PASSENGER);
  });
});

describe('yordamchilar', () => {
  it('accountRoleOf — nusxada bazadagi rol, oddiy obyektda role', () => {
    expect(accountRoleOf({ role: UserRole.PASSENGER, accountRole: UserRole.DRIVER })).toBe(UserRole.DRIVER);
    expect(accountRoleOf({ role: UserRole.DRIVER })).toBe(UserRole.DRIVER);
  });

  it('isDriverActingAsPassenger', () => {
    expect(isDriverActingAsPassenger({ role: UserRole.PASSENGER, accountRole: UserRole.DRIVER })).toBe(true);
    expect(isDriverActingAsPassenger({ role: UserRole.DRIVER, accountRole: UserRole.DRIVER })).toBe(false);
    expect(isDriverActingAsPassenger({ role: UserRole.PASSENGER })).toBe(false);
  });

  it('isClientApp faqat ma\'lum qiymatlar', () => {
    expect(isClientApp('passenger')).toBe(true);
    expect(isClientApp('driver')).toBe(true);
    expect(isClientApp('admin')).toBe(false);
    expect(isClientApp(undefined)).toBe(false);
  });

  it('isDualRoleLoginEnabled — default yoqilgan, faqat aniq false o\'chiradi', () => {
    expect(isDualRoleLoginEnabled(undefined)).toBe(true);
    expect(isDualRoleLoginEnabled('true')).toBe(true);
    expect(isDualRoleLoginEnabled('false')).toBe(false);
    expect(isDualRoleLoginEnabled('0')).toBe(false);
    expect(isDualRoleLoginEnabled('off')).toBe(false);
  });
});
