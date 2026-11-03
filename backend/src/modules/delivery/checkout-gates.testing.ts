/**
 * Spec yordamchisi: checkout darvozasi (`customer-delivery-gates.ts`) uchun
 * "qarz yo'q, rad yo'q" bazasi — food/market createOrder spec'lari ishlatadi.
 */
export function noDebtQueryBuilder(): () => Record<string, unknown> {
  return () => {
    const qb: Record<string, unknown> = {};
    qb.select = () => qb;
    qb.where = () => qb;
    qb.andWhere = () => qb;
    qb.getRawOne = async () => ({ debt: '0' });
    return qb;
  };
}

export const noRefusalsQuery = (): jest.Mock => jest.fn(async () => [{ refusals: 0 }]);
