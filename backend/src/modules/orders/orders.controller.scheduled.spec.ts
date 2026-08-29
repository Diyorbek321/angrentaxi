// Controller darajasidagi ikkita nozik joy:
//   1. `GET /orders/scheduled` marshruti `GET /orders/:id` DAN OLDIN
//      ro'yxatdan o'tishi;
//   2. rejalashtirilgan buyurtma yaratilganda haydovchi qidiruvi HOZIR
//      boshlanmasligi.
//
// Ikkalasi ham "kod to'g'ri ko'rinadi, lekin ishlamaydi" turidagi xatolar:
// birinchisi 400 bilan, ikkinchisi esa ertangi safar uchun BUGUN haydovchi
// qidirib, 60 soniyada "haydovchi topilmadi" deb bekor qilish bilan
// tugaydi.
import { PATH_METADATA } from '@nestjs/common/constants';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { MatchingService } from '../matching/matching.service';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateDispatchOrderDto } from './dto/create-dispatch-order.dto';
import { User, UserRole } from '../../database/entities/user.entity';

describe('OrdersController — rejalashtirilgan safar', () => {
  let ordersService: {
    create: jest.Mock;
    createForDispatch: jest.Mock;
    getScheduledOrders: jest.Mock;
  };
  let matchingService: { startSearch: jest.Mock };
  let controller: OrdersController;

  const passenger = { id: 'passenger-1', role: UserRole.PASSENGER } as User;

  const order = (status: OrderStatus): Order =>
    ({
      id: 'order-1',
      status,
      scheduledAt: status === OrderStatus.SCHEDULED ? new Date('2026-08-20T03:00:00Z') : null,
    }) as Order;

  beforeEach(() => {
    ordersService = {
      create: jest.fn(),
      createForDispatch: jest.fn(),
      getScheduledOrders: jest.fn().mockResolvedValue([]),
    };
    matchingService = { startSearch: jest.fn().mockResolvedValue(undefined) };

    controller = new OrdersController(
      ordersService as unknown as OrdersService,
      matchingService as unknown as MatchingService,
    );
  });

  describe('marshrut tartibi', () => {
    /**
     * Nest marshrutlarni prototip metodlari e'lon qilingan TARTIBDA
     * ro'yxatdan o'tkazadi. `@Get('scheduled')` `@Get(':id')` dan KEYIN
     * turgan bo'lsa, `GET /orders/scheduled` `findOne('scheduled')` ga
     * tushadi va `ParseUUIDPipe` 400 qaytaradi.
     */
    const methodNames = Object.getOwnPropertyNames(OrdersController.prototype);
    const pathOf = (method: string) =>
      Reflect.getMetadata(
        PATH_METADATA,
        (OrdersController.prototype as unknown as Record<string, () => unknown>)[method],
      );

    it("'scheduled' handleri ':id' handleridan OLDIN e'lon qilingan", () => {
      const scheduledIndex = methodNames.indexOf('getScheduled');
      const findOneIndex = methodNames.indexOf('findOne');

      expect(scheduledIndex).toBeGreaterThan(-1);
      expect(findOneIndex).toBeGreaterThan(-1);
      expect(scheduledIndex).toBeLessThan(findOneIndex);
    });

    it('yo\'llar kutilgan qiymatlarda', () => {
      expect(pathOf('getScheduled')).toBe('scheduled');
      expect(pathOf('findOne')).toBe(':id');
    });

    it("hech bir parametrli GET marshruti 'scheduled' dan oldin turmaydi", () => {
      // Yangi `@Get(':nimadir')` marshruti yuqoriroqqa qo'shilsa, u ham
      // shu tuzoqqa tushadi — shuning uchun tekshiruv `findOne` bilan
      // cheklanmaydi.
      const scheduledIndex = methodNames.indexOf('getScheduled');
      const paramRouteBefore = methodNames
        .slice(0, scheduledIndex)
        .filter((m) => typeof pathOf(m) === 'string' && (pathOf(m) as string).includes(':'));

      expect(paramRouteBefore).toEqual([]);
    });
  });

  describe('createOrder — qidiruv qachon boshlanadi', () => {
    it('rejalashtirilgan buyurtmada startSearch CHAQIRILMAYDI', async () => {
      ordersService.create.mockResolvedValue(order(OrderStatus.SCHEDULED));

      await controller.createOrder(passenger, {} as CreateOrderDto);

      expect(matchingService.startSearch).not.toHaveBeenCalled();
    });

    it('oddiy buyurtmada startSearch odatdagidek chaqiriladi', async () => {
      ordersService.create.mockResolvedValue(order(OrderStatus.CREATED));

      await controller.createOrder(passenger, {} as CreateOrderDto);

      expect(matchingService.startSearch).toHaveBeenCalledWith('order-1');
    });

    it('dispatch (call-centre) buyurtmasida ham xuddi shunday', async () => {
      ordersService.createForDispatch.mockResolvedValue(order(OrderStatus.SCHEDULED));

      await controller.createDispatchOrder({} as CreateDispatchOrderDto);

      expect(matchingService.startSearch).not.toHaveBeenCalled();
    });
  });

  describe('getScheduled', () => {
    it("faqat chaqiruvchining O'Z rejalarini so'raydi", async () => {
      await controller.getScheduled(passenger);

      // Yo'lovchi ID si so'rovdan emas, tokendan olinadi — aks holda
      // boshqa yo'lovchining rejalarini o'qish mumkin bo'lardi.
      expect(ordersService.getScheduledOrders).toHaveBeenCalledWith('passenger-1');
    });
  });
});
