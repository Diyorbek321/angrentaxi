import { FoodService } from './food.service';

function setup(rows: unknown[] = [], total = 0) {
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
  };
  const dishRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
  const none = {} as never;
  const service = new FoodService(
    none, none, dishRepo as never, none, none, none, none, none, none, none, none,
  );
  return { service, qb };
}

describe('FoodService.adminListDishes', () => {
  it('sahifalaydi: hammasini emas, faqat bitta sahifani oladi', async () => {
    const { service, qb } = setup([{ id: 'd1' }], 45);
    const result = await service.adminListDishes({ page: 3, limit: 20 });
    expect(qb.skip).toHaveBeenCalledWith(40);
    expect(qb.take).toHaveBeenCalledWith(20);
    expect(qb.where).not.toHaveBeenCalled();
    expect(result).toEqual({ dishes: [{ id: 'd1' }], total: 45, page: 3, limit: 20 });
  });

  it('nom yoki restoran nomi bo\'yicha qidiradi', async () => {
    const { service, qb } = setup();
    await service.adminListDishes({ search: '  osh ' });
    expect(qb.where).toHaveBeenCalledWith('(dish.name ILIKE :q OR restaurant.name ILIKE :q)', { q: '%osh%' });
  });

  it('standart: 1-sahifa, 20 ta', async () => {
    const { service, qb } = setup();
    await service.adminListDishes({});
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(20);
  });
});
