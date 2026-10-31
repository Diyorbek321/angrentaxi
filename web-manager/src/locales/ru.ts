import type { Messages } from './uz';
import { common } from './ru/common';
import { meta } from './ru/meta';
import { lib } from './ru/lib';
import { orders } from './ru/orders';
import { dispatch } from './ru/dispatch';
import { drivers } from './ru/drivers';
import { ops } from './ru/ops';
import { control } from './ru/control';

/** Ruscha lug'at — tipi `uz` dan, kalit tushib qolsa TypeScript to'xtatadi. */
export const ru: Messages = { common, meta, lib, orders, dispatch, drivers, ops, control };
