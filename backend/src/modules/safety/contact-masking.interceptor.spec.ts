import { of, lastValueFrom } from 'rxjs';
import { ExecutionContext } from '@nestjs/common';
import { OrderStatus } from '../../database/entities/order.entity';
import { UserRole } from '../../database/entities/user.entity';
import {
  CourierContactMaskingInterceptor,
  maskCourierTracking,
  OrderContactMaskingInterceptor,
} from './contact-masking.interceptor';

function ctx(user: unknown, headers: Record<string, string> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, headers }) }),
  } as unknown as ExecutionContext;
}

const order = {
  id: 'o1',
  passengerId: 'p1',
  driverId: 'd1',
  status: OrderStatus.IN_PROGRESS,
  driver: { phone: '+998900000002' },
  passenger: { phone: '+998900000001' },
};

describe('OrderContactMaskingInterceptor', () => {
  const interceptor = new OrderContactMaskingInterceptor();

  it("yangi ilova (call-relay) — faol safarda ham raqam yo'q", async () => {
    const out = (await lastValueFrom(
      interceptor.intercept(ctx({ id: 'p1', role: UserRole.PASSENGER }, { 'x-client-features': 'call-relay' }), {
        handle: () => of(order),
      }),
    )) as typeof order;
    expect(out.driver.phone).toBeNull();
  });

  it('eski ilova — faol safarda raqam qoladi (orqaga moslik)', async () => {
    const out = (await lastValueFrom(
      interceptor.intercept(ctx({ id: 'p1', role: UserRole.PASSENGER }), { handle: () => of(order) }),
    )) as typeof order;
    expect(out.driver.phone).toBe('+998900000002');
  });

  it("menejer — o'zgarishsiz", async () => {
    const out = await lastValueFrom(
      interceptor.intercept(ctx({ id: 'm', role: UserRole.MANAGER }, { 'x-client-features': 'call-relay' }), {
        handle: () => of(order),
      }),
    );
    expect(out).toBe(order);
  });
});

describe('CourierContactMaskingInterceptor', () => {
  const food = { id: 'f1', delivery: { status: OrderStatus.IN_PROGRESS, driverPhone: '+998900000009' } };

  it("mijozga kuryer raqami yo'q; eski ilovada faqat faol yetkazishda", () => {
    expect((maskCourierTracking(food, false) as typeof food).delivery.driverPhone).toBeNull();
    expect((maskCourierTracking(food, true) as typeof food).delivery.driverPhone).toBe('+998900000009');
    const done = { ...food, delivery: { ...food.delivery, status: OrderStatus.COMPLETED } };
    expect((maskCourierTracking(done, true) as typeof food).delivery.driverPhone).toBeNull();
    expect(maskCourierTracking({ id: 'x', delivery: null }, false)).toEqual({ id: 'x', delivery: null });
    const list = maskCourierTracking([food], false) as Array<typeof food>;
    expect(list[0].delivery.driverPhone).toBeNull();
  });

  it('interceptor yo\'li', async () => {
    const out = (await lastValueFrom(
      new CourierContactMaskingInterceptor().intercept(
        ctx({ id: 'c1', role: UserRole.PASSENGER }, { 'x-client-features': 'call-relay' }),
        { handle: () => of(food) },
      ),
    )) as typeof food;
    expect(out.delivery.driverPhone).toBeNull();
  });
});
