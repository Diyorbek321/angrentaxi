import { Logger } from '@nestjs/common';
import { DriverBonusesService } from './driver-bonuses.service';
import {
  BonusRuleStatus,
  BonusRuleType,
  DriverBonusRule,
} from '../../database/entities/driver-bonus-rule.entity';
import { DriverBonusAward } from '../../database/entities/driver-bonus-award.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { User } from '../../database/entities/user.entity';

// `driverId` — haydovchining User.id si (DriverBonusAward entity'siga qarang),
// driver profil id si emas. Socket xonasi ham, push qabul qiluvchisi ham shu.
const DRIVER_USER_ID = 'driver-user-1';

const tripCountRule = (overrides: Partial<DriverBonusRule> = {}): DriverBonusRule =>
  ({
    id: 'rule-1',
    name: '50 ta safar bonusi',
    ruleType: BonusRuleType.TRIP_COUNT,
    tripThreshold: 50,
    bonusAmount: 25000,
    serviceType: null,
    status: BonusRuleStatus.ACTIVE,
    ...overrides,
  }) as DriverBonusRule;

const driverUser = (overrides: Partial<User> = {}): User =>
  ({
    id: DRIVER_USER_ID,
    fcmToken: 'a-real-looking-fcm-token',
    firstName: 'Ali',
    lastName: 'Valiyev',
    ...overrides,
  }) as User;

describe('DriverBonusesService', () => {
  let ruleRepository: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let awardRepository: { findOne: jest.Mock; manager: { transaction: jest.Mock } };
  let orderRepository: { count: jest.Mock };
  let realtimeGateway: { emitToUser: jest.Mock };
  let notificationsService: { notifyBonusAwarded: jest.Mock };
  let usersService: { findById: jest.Mock };
  let service: DriverBonusesService;

  /** Tranzaksiya ichida saqlangan entity'lar — chaqiruv tartibi bilan. */
  let saved: Array<{ entity: unknown; data: Record<string, unknown> }>;

  beforeEach(() => {
    saved = [];

    ruleRepository = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), save: jest.fn() };

    awardRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      manager: {
        transaction: jest.fn(async (cb: (m: unknown) => Promise<void>) => {
          const manager = {
            save: jest.fn(async (entity: unknown, data: Record<string, unknown>) => {
              saved.push({ entity, data });
              return { id: 'tx-1', ...data };
            }),
          };
          return cb(manager);
        }),
      },
    };

    orderRepository = { count: jest.fn().mockResolvedValue(0) };
    realtimeGateway = { emitToUser: jest.fn() };
    notificationsService = { notifyBonusAwarded: jest.fn().mockResolvedValue(undefined) };
    usersService = { findById: jest.fn().mockResolvedValue(driverUser()) };

    service = new DriverBonusesService(
      ruleRepository as never,
      awardRepository as never,
      orderRepository as never,
      realtimeGateway as never,
      notificationsService as never,
      usersService as never,
    );
  });

  describe('bonus berilganda xabar yuborish', () => {
    beforeEach(() => {
      // Haydovchi aynan 50-safarni tugatdi → chegara birinchi marta bajarildi.
      ruleRepository.find.mockResolvedValue([tripCountRule()]);
      orderRepository.count.mockResolvedValue(50);
    });

    it("pulni ham yozadi, xabarni ham yuboradi", async () => {
      await service.evaluateForDriver(DRIVER_USER_ID);

      // Pul: CREDIT tranzaksiya + idempotentlik qatori.
      expect(saved.map((s) => s.entity)).toEqual([Transaction, DriverBonusAward]);

      // Ilova ochiq bo'lsa — socket orqali darhol.
      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        DRIVER_USER_ID,
        'bonus:awarded',
        { bonusRuleId: 'rule-1', name: '50 ta safar bonusi', amount: 25000 },
      );

      // Yopiq bo'lsa — push.
      expect(notificationsService.notifyBonusAwarded).toHaveBeenCalledWith(
        expect.objectContaining({ id: DRIVER_USER_ID }),
        '50 ta safar bonusi',
        25000,
      );
    });

    it("xabarda qaysi bonus va qancha summa ekani aniq bo'ladi", async () => {
      // Haydovchi "nima uchun pul keldi?" deb so'ramasligi kerak: qoida nomi
      // ham, summa ham xabarga uzatiladi.
      await service.evaluateForDriver(DRIVER_USER_ID);

      const [, bonusName, amount] = notificationsService.notifyBonusAwarded.mock.calls[0];
      expect(bonusName).toBe('50 ta safar bonusi');
      expect(amount).toBe(25000);
    });

    it("xabarni tranzaksiya YOPILGANDAN keyin yuboradi", async () => {
      // Ichkarida yuborilsa, FCM sekinlashuvi pul yozadigan tranzaksiyani
      // ochiq ushlab turardi.
      let openWhenEmitted: boolean | null = null;
      let transactionOpen = false;

      awardRepository.manager.transaction.mockImplementation(
        async (cb: (m: unknown) => Promise<void>) => {
          transactionOpen = true;
          await cb({ save: jest.fn().mockResolvedValue({ id: 'tx-1' }) });
          transactionOpen = false;
        },
      );
      realtimeGateway.emitToUser.mockImplementation(() => {
        openWhenEmitted = transactionOpen;
      });

      await service.evaluateForDriver(DRIVER_USER_ID);

      expect(openWhenEmitted).toBe(false);
    });
  });

  describe('xabar yiqilsa ham bonus qoladi', () => {
    beforeEach(() => {
      ruleRepository.find.mockResolvedValue([tripCountRule()]);
      orderRepository.count.mockResolvedValue(50);
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("socket yiqilsa xato ko'tarmaydi va pul yozuvi saqlanadi", async () => {
      realtimeGateway.emitToUser.mockImplementation(() => {
        throw new Error('socket server down');
      });

      await expect(service.evaluateForDriver(DRIVER_USER_ID)).resolves.toBeUndefined();

      // Eng muhimi: tranzaksiya baribir bajarilgan — pul haydovchida qoldi.
      expect(saved.map((s) => s.entity)).toEqual([Transaction, DriverBonusAward]);
    });

    it("socket yiqilsa ham push baribir ketadi", async () => {
      // Ikki kanal bir-biriga bog'liq bo'lmasligi kerak: ilovasi yopiq
      // haydovchiga faqat push yetib boradi, socket nosozligi uni
      // to'xtatib qo'ymasligi shart.
      realtimeGateway.emitToUser.mockImplementation(() => {
        throw new Error('socket server down');
      });

      await service.evaluateForDriver(DRIVER_USER_ID);

      expect(notificationsService.notifyBonusAwarded).toHaveBeenCalledWith(
        expect.objectContaining({ id: DRIVER_USER_ID }),
        '50 ta safar bonusi',
        25000,
      );
    });

    it("push yiqilsa socket xabari baribir ketgan bo'ladi", async () => {
      notificationsService.notifyBonusAwarded.mockRejectedValue(new Error('FCM 503'));

      await service.evaluateForDriver(DRIVER_USER_ID);

      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        DRIVER_USER_ID,
        'bonus:awarded',
        expect.objectContaining({ amount: 25000 }),
      );
    });

    it("push yiqilsa ham xato ko'tarmaydi va pul yozuvi saqlanadi", async () => {
      notificationsService.notifyBonusAwarded.mockRejectedValue(new Error('FCM 503'));

      await expect(service.evaluateForDriver(DRIVER_USER_ID)).resolves.toBeUndefined();

      expect(saved.map((s) => s.entity)).toEqual([Transaction, DriverBonusAward]);
    });

    it("haydovchi topilmasa push yubormaydi, lekin yiqilmaydi ham", async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.evaluateForDriver(DRIVER_USER_ID)).resolves.toBeUndefined();

      expect(notificationsService.notifyBonusAwarded).not.toHaveBeenCalled();
      // Socket xabari User.id ga bog'liq emas, shuning uchun baribir ketadi.
      expect(realtimeGateway.emitToUser).toHaveBeenCalled();
      expect(saved.map((s) => s.entity)).toEqual([Transaction, DriverBonusAward]);
    });
  });

  describe('ikkinchi marta bonus berilmaydi', () => {
    beforeEach(() => {
      ruleRepository.find.mockResolvedValue([tripCountRule()]);
      orderRepository.count.mockResolvedValue(50);
    });

    it("shu davr uchun yozuv bor bo'lsa na pul, na xabar ketadi", async () => {
      awardRepository.findOne.mockResolvedValue({ id: 'award-1' });

      await service.evaluateForDriver(DRIVER_USER_ID);

      expect(awardRepository.manager.transaction).not.toHaveBeenCalled();
      expect(realtimeGateway.emitToUser).not.toHaveBeenCalled();
      expect(notificationsService.notifyBonusAwarded).not.toHaveBeenCalled();
    });

    it("parallel chaqiruv unikallikka urilsa xabar TAKRORLANMAYDI", async () => {
      // 23505 = "boshqa chaqiruv shu davrni allaqachon to'lagan". Bu holat
      // xatosiz tugaydi, lekin xabar o'sha chaqiruv tomonidan yuborilgan —
      // bu yerda yana yuborilsa haydovchi ikkita bildirishnoma olardi.
      awardRepository.manager.transaction.mockRejectedValue(
        Object.assign(new Error('duplicate key'), { code: '23505' }),
      );

      await expect(service.evaluateForDriver(DRIVER_USER_ID)).resolves.toBeUndefined();

      expect(realtimeGateway.emitToUser).not.toHaveBeenCalled();
      expect(notificationsService.notifyBonusAwarded).not.toHaveBeenCalled();
    });

    it("boshqa DB xatosi yutilmaydi va xabar ham yuborilmaydi", async () => {
      // 23505 dan boshqasi haqiqiy nosozlik — uni yutish bonusni "berildi"
      // deb ko'rsatib, aslida pul yozilmagan holatni yashirardi.
      awardRepository.manager.transaction.mockRejectedValue(
        Object.assign(new Error('connection lost'), { code: '08006' }),
      );

      await expect(service.evaluateForDriver(DRIVER_USER_ID)).rejects.toThrow('connection lost');

      expect(notificationsService.notifyBonusAwarded).not.toHaveBeenCalled();
    });

    it("chegaraga yetmagan haydovchiga umuman tegmaydi", async () => {
      orderRepository.count.mockResolvedValue(49);

      await service.evaluateForDriver(DRIVER_USER_ID);

      expect(awardRepository.manager.transaction).not.toHaveBeenCalled();
      expect(notificationsService.notifyBonusAwarded).not.toHaveBeenCalled();
    });
  });

  describe('haftalik maqsad qoidasi', () => {
    it("hafta rejasi bajarilganda ham xabar yuboradi", async () => {
      ruleRepository.find.mockResolvedValue([
        tripCountRule({
          id: 'rule-2',
          name: 'Haftalik reja',
          ruleType: BonusRuleType.WEEKLY_GOAL,
          tripThreshold: 30,
          bonusAmount: 50000,
        }),
      ]);
      orderRepository.count.mockResolvedValue(31);

      await service.evaluateForDriver(DRIVER_USER_ID);

      expect(notificationsService.notifyBonusAwarded).toHaveBeenCalledWith(
        expect.objectContaining({ id: DRIVER_USER_ID }),
        'Haftalik reja',
        50000,
      );
    });
  });
});
