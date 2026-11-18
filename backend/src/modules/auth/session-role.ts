import { User, UserRole } from '../../database/entities/user.entity';
import { parseEnvBoolean } from '../../common/utils/env-boolean.util';

/**
 * Qaysi mobil ilovadan kirilgan. Token ichida `app` claim sifatida yuradi va
 * har bir so'rovda sessiya rolini shu bo'yicha aniqlaymiz.
 */
export type ClientApp = 'passenger' | 'driver';

export const CLIENT_APPS: readonly ClientApp[] = ['passenger', 'driver'];

/** Env: `false` — eski qoida (bitta raqam = bitta rol), B reja. */
export const DUAL_ROLE_LOGIN_ENV = 'DUAL_ROLE_LOGIN_ENABLED';

/** Yoqilganmi: o'rnatilmagan bo'lsa — HA (default). Faqat aniq `false/0/off` o'chiradi. */
export function isDualRoleLoginEnabled(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true;
  return parseEnvBoolean(raw) !== false;
}

export function isClientApp(value: unknown): value is ClientApp {
  return typeof value === 'string' && (CLIENT_APPS as readonly string[]).includes(value);
}

/**
 * "Faol rol". Bitta raqam — bitta akkaunt, lekin HAYDOVCHI yo'lovchi
 * ilovasidan kirsa, shu sessiyada u oddiy yo'lovchi.
 *
 * ⚠️ Faqat PASTGA tushiradi (driver → passenger). Boshqa hech qanday holatda
 * token bazadagi roldan yuqori huquq bera olmaydi: `app` claim'ni mijoz
 * tanlaydi, shuning uchun u imtiyozni faqat kamaytirishi mumkin.
 *
 * `app` yo'q (eski token yoki eski ilova) — bazadagi rol, ya'ni eski xatti-harakat.
 */
export function resolveSessionRole(
  accountRole: UserRole,
  app: ClientApp | null | undefined,
  enabled: boolean,
): UserRole {
  if (enabled && accountRole === UserRole.DRIVER && app === 'passenger') {
    return UserRole.PASSENGER;
  }
  return accountRole;
}

/**
 * So'rov uchun foydalanuvchi nusxasi: `role` — sessiya roli, `accountRole` —
 * bazadagi haqiqiy rol. Asl obyekt O'ZGARMAYDI; prototip saqlanadi.
 *
 * Rol farq qilmasa ham `accountRole` qo'yiladi — chaqiruvchilar uni doim
 * ishonch bilan o'qiy oladi.
 */
export function withSessionRole(
  user: User,
  app: ClientApp | null | undefined,
  enabled: boolean,
): User {
  const role = resolveSessionRole(user.role, app, enabled);
  const copy = Object.create(Object.getPrototypeOf(user) as object) as User;
  return Object.assign(copy, user, { role, accountRole: user.role });
}

/** Bazadagi rol: sessiya roli bilan almashtirilgan nusxada ham to'g'ri. */
export function accountRoleOf(user: Pick<User, 'role' | 'accountRole'>): UserRole {
  return user.accountRole ?? user.role;
}

/** Haydovchi akkaunti yo'lovchi ilovasida ishlayaptimi. */
export function isDriverActingAsPassenger(user: Pick<User, 'role' | 'accountRole'>): boolean {
  return accountRoleOf(user) === UserRole.DRIVER && user.role === UserRole.PASSENGER;
}

/**
 * Token payload'idan so'rov foydalanuvchisi: HTTP (`JwtStrategy`) va socket
 * (`RealtimeGateway`, `WsJwtGuard`) bir xil qoidani ishlatsin. Noma'lum `app`
 * e'tiborsiz — bazadagi rol.
 */
export function scopeUserToToken(user: User, payloadApp: unknown, rawFlag: unknown): User {
  return withSessionRole(user, isClientApp(payloadApp) ? payloadApp : undefined, isDualRoleLoginEnabled(rawFlag));
}
