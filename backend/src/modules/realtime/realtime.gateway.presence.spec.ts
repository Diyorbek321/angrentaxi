import { RealtimeGateway } from './realtime.gateway';
import { UserRole, UserStatus } from '../../database/entities/user.entity';

/**
 * Socket ulanishi haydovchining ONLAYN holatiga qanday ta'sir qiladi.
 *
 * NEGA aynan shu qamrab olingan. Bu gateway ilgari uzilish paytida
 * `setOnlineStatus(userId, false)` chaqirardi, ya'ni socket uzilishini
 * "haydovchi ishni to'xtatdi" deb o'qirdi. Socket esa telefon ekrani
 * o'chgani, ilova fonga tushgani, WiFi'dan LTE'ga o'tgani yoki server qayta
 * deploy bo'lgani uchun ham uziladi.
 *
 * Oqibati jonli tizimda o'lchangan: haydovchi bazada oflayn bo'lib, Redis
 * geo-to'plamidan chiqib ketardi; qayta ulanish holatni tiklamasdi;
 * joylashuv paketi ham qutqara olmasdi, chunki `updateLocation` Redis'ga
 * faqat `isOnline` rost bo'lganda yozadi. Ya'ni haydovchi tugmani QO'LDA
 * o'chirib-yoqmaguncha unga birorta buyurtma bormasdi — ilovasi esa o'z
 * lokal holatini ko'rsatib "onlayn" deb turardi.
 *
 * Shuning uchun quyidagi ikki jumla test bilan qulflanadi:
 *   1. Uzilish `isOnline` ga TEGMAYDI.
 *   2. Qayta ulanish faqat MAVJUDLIKNI tiklaydi, `isOnline` ni yoqmaydi.
 */
describe('RealtimeGateway — haydovchi onlayn holati va socket', () => {
  const DRIVER_USER = {
    id: 'user-driver-1',
    role: UserRole.DRIVER,
    status: UserStatus.ACTIVE,
  };

  let gateway: RealtimeGateway;
  let driversService: {
    setOnlineStatus: jest.Mock;
    restorePresence: jest.Mock;
    touchPresence: jest.Mock;
  };
  let usersService: { findById: jest.Mock };
  let jwtService: { verify: jest.Mock };

  /** Haqiqiy socket o'rniga: faqat testlar tegadigan yuza. */
  function fakeSocket(id: string, user?: unknown) {
    return {
      id,
      handshake: { auth: { token: 'valid-token' }, headers: {} },
      join: jest.fn(async () => undefined),
      disconnect: jest.fn(),
      ...(user ? { user } : {}),
    };
  }

  beforeEach(() => {
    driversService = {
      setOnlineStatus: jest.fn(async () => ({ id: 'driver-1', isOnline: false })),
      restorePresence: jest.fn(async () => true),
      touchPresence: jest.fn(async () => undefined),
    };
    usersService = { findById: jest.fn(async () => DRIVER_USER) };
    jwtService = {
      verify: jest.fn(() => ({ sub: DRIVER_USER.id, phone: '+998900000000', role: 'driver', type: 'access' })),
    };

    gateway = new RealtimeGateway(
      jwtService as never,
      { getOrThrow: () => 'test-secret' } as never,
      driversService as never,
      usersService as never,
      {} as never,
      {} as never,
    );

    // `emitToManagers` server obyektiga boradi; bu testlarda u kerak emas.
    (gateway as unknown as { server: unknown }).server = {
      to: () => ({ emit: jest.fn() }),
    };
  });

  describe('uzilish', () => {
    it("haydovchini OFLAYN QILMAYDI — aynan tuzatilgan nuqson", async () => {
      const socket = fakeSocket('sock-1', DRIVER_USER);
      await gateway.handleConnection(socket as never);

      await gateway.handleDisconnect(socket as never);

      expect(driversService.setOnlineStatus).not.toHaveBeenCalled();
    });

    it('autentifikatsiyadan o\'tmagan socketda yiqilmaydi', async () => {
      await expect(
        gateway.handleDisconnect(fakeSocket('sock-anon') as never),
      ).resolves.toBeUndefined();
      expect(driversService.setOnlineStatus).not.toHaveBeenCalled();
    });
  });

  describe('qayta ulanish', () => {
    it('MAVJUDLIKNI tiklaydi', async () => {
      await gateway.handleConnection(fakeSocket('sock-1') as never);

      expect(driversService.restorePresence).toHaveBeenCalledWith(DRIVER_USER.id);
    });

    it("`isOnline` ni YOQMAYDI", async () => {
      // Qayta ulanish haydovchining niyati haqida hech narsa aytmaydi.
      // Aks holda tugmani o'chirib qo'ygan haydovchi ilova fonda qolgani
      // uchun yana buyurtma ola boshlardi.
      await gateway.handleConnection(fakeSocket('sock-1') as never);

      expect(driversService.setOnlineStatus).not.toHaveBeenCalled();
    });

    it('mavjudlikni tiklash yiqilsa ham ulanish UZILMAYDI', async () => {
      driversService.restorePresence.mockRejectedValue(new Error('redis down'));
      const socket = fakeSocket('sock-1');

      await gateway.handleConnection(socket as never);

      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('yo\'lovchi uchun mavjudlik tiklanmaydi', async () => {
      usersService.findById.mockResolvedValue({
        id: 'user-pax',
        role: UserRole.PASSENGER,
        status: UserStatus.ACTIVE,
      });
      jwtService.verify.mockReturnValue({
        sub: 'user-pax', phone: '+998900000001', role: 'passenger', type: 'access',
      });

      await gateway.handleConnection(fakeSocket('sock-pax') as never);

      expect(driversService.restorePresence).not.toHaveBeenCalled();
    });
  });

  describe('davriy yurak urishi', () => {
    it('ulangan haydovchilarning mavjudligini uzaytiradi', async () => {
      await gateway.handleConnection(fakeSocket('sock-1') as never);

      await gateway.refreshDriverPresence();

      expect(driversService.touchPresence).toHaveBeenCalledWith([DRIVER_USER.id]);
    });

    it('uzilgandan keyin uni uzaytirmaydi', async () => {
      const socket = fakeSocket('sock-1', DRIVER_USER);
      await gateway.handleConnection(socket as never);
      await gateway.handleDisconnect(socket as never);

      await gateway.refreshDriverPresence();

      expect(driversService.touchPresence).not.toHaveBeenCalled();
    });

    it("ikkinchi qurilma ulangan bo'lsa yurak urishi TO'XTAMAYDI", async () => {
      // Qayta ulanish eskisi bilan ustma-ust tushishi odatiy hol: yangi
      // socket ulanib, eskisining uzilishi bir necha soniya keyin keladi.
      // Birinchi uzilishda yurak urishini to'xtatsak, aynan shu paytda
      // haydovchi tushib qolardi.
      const first = fakeSocket('sock-1', DRIVER_USER);
      const second = fakeSocket('sock-2', DRIVER_USER);
      await gateway.handleConnection(first as never);
      await gateway.handleConnection(second as never);

      await gateway.handleDisconnect(first as never);
      await gateway.refreshDriverPresence();

      expect(driversService.touchPresence).toHaveBeenCalledWith([DRIVER_USER.id]);
    });

    it('birorta haydovchi ulanmagan bo\'lsa Redis\'ga bormaydi', async () => {
      await gateway.refreshDriverPresence();

      expect(driversService.touchPresence).not.toHaveBeenCalled();
    });
  });
});
