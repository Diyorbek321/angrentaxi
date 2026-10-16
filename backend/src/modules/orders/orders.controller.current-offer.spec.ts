// `GET /orders/offer/current` — haydovchi ilovasi socket qayta ulanganda
// yoki fondan qaytganda o'tkazib yuborilgan taklifni shu orqali tiklaydi
// (docs/CONTINGENCY-PLAN.md §5).
import { PATH_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { OrdersMeterService } from './orders-meter.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { MatchingService } from '../matching/matching.service';
import { User, UserRole } from '../../database/entities/user.entity';

describe('OrdersController — joriy taklif', () => {
  const driver = { id: 'driver-user-1', role: UserRole.DRIVER } as User;
  const proto = OrdersController.prototype as unknown as Record<string, () => unknown>;

  const build = (currentOfferFor: jest.Mock) =>
    new OrdersController(
      {} as OrdersService,
      { currentOfferFor } as unknown as MatchingService,
      {} as OrdersMeterService,
    );

  it('haydovchining o‘z taklifini qaytaradi', async () => {
    const offer = { id: 'order-1', timeoutSeconds: 9 };
    const currentOfferFor = jest.fn().mockResolvedValue(offer);
    await expect(build(currentOfferFor).getCurrentOffer(driver)).resolves.toEqual(offer);
    expect(currentOfferFor).toHaveBeenCalledWith('driver-user-1');
  });

  it('taklif yo‘q — null', async () => {
    await expect(build(jest.fn().mockResolvedValue(null)).getCurrentOffer(driver)).resolves.toBeNull();
  });

  it("faqat haydovchi; marshrut ':id' dan OLDIN", () => {
    expect(Reflect.getMetadata(ROLES_KEY, proto.getCurrentOffer)).toEqual([UserRole.DRIVER]);
    expect(Reflect.getMetadata(PATH_METADATA, proto.getCurrentOffer)).toBe('offer/current');
    const names = Object.getOwnPropertyNames(OrdersController.prototype);
    expect(names.indexOf('getCurrentOffer')).toBeLessThan(names.indexOf('findOne'));
  });
});
