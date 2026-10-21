import { meta } from './uz/meta';
import { common } from './uz/common';
import { shell } from './uz/shell';
import { login } from './uz/login';
import { dashboard } from './uz/dashboard';
import { settings } from './uz/settings';
import { staff } from './uz/staff';
import { audit } from './uz/audit';
import { orders } from './uz/orders';
import { drivers } from './uz/drivers';
import { driverDocs } from './uz/driverDocs';
import { finance } from './uz/finance';
import { compliance } from './uz/compliance';
import { reports } from './uz/reports';
import { vendors } from './uz/vendors';
import { moderation } from './uz/moderation';
import { ads } from './uz/ads';
import { promo } from './uz/promo';
import { push } from './uz/push';
import { users } from './uz/users';
import { intercity } from './uz/intercity';
import { tariffs } from './uz/tariffs';
import { bonuses } from './uz/bonuses';

/**
 * Admin panel lug'ati (o'zbekcha — asosiy til). Har bo'lim alohida faylda:
 * `uz/<bo'lim>.ts`, ruschasi `ru/<bo'lim>.ts`.
 */
export const uz = {
  common,
  meta,
  shell,
  login,
  dashboard,
  settings,
  staff,
  audit,
  orders,
  drivers,
  driverDocs,
  finance,
  compliance,
  reports,
  vendors,
  moderation,
  ads,
  promo,
  push,
  users,
  intercity,
  tariffs,
  bonuses,
};

export type Messages = typeof uz;
