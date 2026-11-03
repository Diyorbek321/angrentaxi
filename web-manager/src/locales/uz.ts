import { common } from './uz/common';
import { meta } from './uz/meta';
import { lib } from './uz/lib';
import { orders } from './uz/orders';
import { dispatch } from './uz/dispatch';
import { drivers } from './uz/drivers';
import { ops } from './uz/ops';
import { control } from './uz/control';
import { incidents } from './uz/incidents';

/** O'zbekcha (asosiy) lug'at. Har bo'lim o'z faylida: `uz/<bo'lim>.ts`. */
export const uz = { common, meta, lib, orders, dispatch, drivers, ops, control, incidents };

export type Messages = typeof uz;
