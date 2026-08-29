import { DriversService } from './drivers.service';

/**
 * Haydovchining JONLI MAVJUDLIGI — `is_online` dan alohida qatlam.
 *
 * NEGA bu testlar bor. Ilgari ikkalasi bitta narsa deb qaralardi: socket
 * uzilishi haydovchini bazada oflayn qilib, Redis geo-to'plamidan chiqarib
 * yuborardi. Halqa yopiq edi — qayta ulanish holatni tiklamasdi, joylashuv
 * paketi ham qutqara olmasdi (u `isOnline` ga bog'liq), ya'ni birinchi
 * tarmoq uzilishidan keyin haydovchi tugmani QO'LDA o'chirib-yoqmaguncha
 * matching uchun ko'rinmas bo'lib qolardi. Yo'lovchi buni "haydovchi
 * topilmadi" deb ko'rardi, haydovchi esa ilovasida "onlayn" yozuvini.
 *
 * Shuning uchun quyidagi ikki jumla ALOHIDA qulflanadi:
 *   1. Mavjudligi tugagan haydovchi nomzod BO'LMAYDI (va to'plamdan tozalanadi).
 *   2. Mavjudlikni tiklash `isOnline` ga HECH QACHON tegmaydi.
 */
describe('DriversService — jonli mavjudlik', () => {
  const PICKUP_LAT = 41.0212;
  const PICKUP_LNG = 70.0795;
  const PRESENCE_TTL_SECONDS = 150;

  interface DriverRow {
    id: string;
    userId: string;
    approvedTariffTier: number;
    serviceTypes: null;
    vehicleType: null;
    isOnline: boolean;
  }

  let service: DriversService;
  let driverRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    query: jest.Mock;
    update: jest.Mock;
  };
  let redis: {
    georadius: jest.Mock;
    mget: jest.Mock;
    zrem: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    geoadd: jest.Mock;
    geopos: jest.Mock;
  };
  let pool: DriverRow[];
  /** Mavjudlik kaliti bor haydovchilar — Redis TTL ning o'rnini bosadi. */
  let present: Set<string>;

  const presenceKey = (id: string) => `driver:presence:${id}`;

  function driverRow(id: string, overrides: Partial<DriverRow> = {}): DriverRow {
    return {
      id,
      userId: `user-${id}`,
      approvedTariffTier: 1,
      serviceTypes: null,
      vehicleType: null,
      isOnline: true,
      ...overrides,
    };
  }

  beforeEach(() => {
    pool = [];
    present = new Set();

    driverRepository = {
      find: jest.fn(({ where }: { where: { id?: { value: string[] }; userId?: { value: string[] } } }) => {
        if (where.userId) {
          const ids = where.userId.value;
          return Promise.resolve(pool.filter((d) => ids.includes(d.userId) && d.isOnline));
        }
        const ids = where.id?.value ?? [];
        return Promise.resolve(pool.filter((d) => ids.includes(d.id)));
      }),
      findOne: jest.fn(({ where }: { where: { userId?: string; id?: string } }) =>
        Promise.resolve(
          pool.find((d) => (where.userId ? d.userId === where.userId : d.id === where.id)) ?? null,
        ),
      ),
      // Joylashuv o'qish so'rovi — har doim bitta nuqta qaytaradi.
      query: jest.fn(() => Promise.resolve([{ lng: 70.05, lat: 41.03 }])),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
    };

    redis = {
      georadius: jest.fn(() =>
        Promise.resolve(
          pool.map((d, i) => [d.id, String(0.5 + i * 0.1), [String(PICKUP_LNG), String(PICKUP_LAT)]]),
        ),
      ),
      mget: jest.fn((...keys: string[]) =>
        Promise.resolve(keys.map((k) => (present.has(k.replace('driver:presence:', '')) ? '1' : null))),
      ),
      zrem: jest.fn(() => Promise.resolve(1)),
      set: jest.fn(() => Promise.resolve('OK')),
      del: jest.fn(() => Promise.resolve(1)),
      geoadd: jest.fn(() => Promise.resolve(1)),
      geopos: jest.fn(() => Promise.resolve([])),
    };

    service = new DriversService(
      driverRepository as never,
      {} as never,
      redis as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  const nearbyIds = async () =>
    (await service.getNearbyDrivers(PICKUP_LAT, PICKUP_LNG, 3)).map((d) => d.driverId);

  describe('getNearbyDrivers', () => {
    it('mavjudligi tugagan haydovchini nomzod qilib BERMAYDI', async () => {
      // Aynan tuzatilayotgan nuqsonning teskari tomoni: geo-to'plamda
      // turish o'zi yetarli emas — to'plam a'zolikda "oxirgi marta qachon
      // xabar berdi" degan ma'lumot saqlamaydi.
      pool = [driverRow('tirik'), driverRow('telefoni-ochgan')];
      present.add('tirik');

      expect(await nearbyIds()).toEqual(['tirik']);
    });

    it('mavjudligi tugagan a\'zoni geo-to\'plamdan TOZALAYDI', async () => {
      // Tozalanmasa u to'plamda abadiy qolib, har qidiruvda nomzod bo'lib
      // chiqar va o'z navbatini 15 soniya taklif kutib yeb qo'yardi.
      pool = [driverRow('tirik'), driverRow('eskirgan')];
      present.add('tirik');

      await nearbyIds();

      expect(redis.zrem).toHaveBeenCalledWith('drivers:online', 'eskirgan');
    });

    it('hamma tirik bo\'lsa hech kim tashlanmaydi va zrem chaqirilmaydi', async () => {
      pool = [driverRow('a'), driverRow('b')];
      present.add('a');
      present.add('b');

      expect(await nearbyIds()).toEqual(['a', 'b']);
      expect(redis.zrem).not.toHaveBeenCalled();
    });
  });

  describe('getOnlineDriversList — dispetcher taxtasi', () => {
    it("yetib borib bo'lmaydigan haydovchini KO'RSATMAYDI", async () => {
      // `is_online` endi niyat va socket uzilishi uni o'chirmaydi. Faqat
      // shu ustunga tayansak, taxta telefonini o'chirgan haydovchini
      // "onlayn" deb ko'rsatardi va dispetcher unga buyurtma bermoqchi
      // bo'lardi.
      driverRepository.query.mockResolvedValueOnce([
        { id: 'tirik', user_id: 'user-tirik', car_model: null, car_number: null,
          rating: '5', updated_at: new Date(), first_name: null, last_name: null,
          phone: '+998900000001', current_order_id: null },
        { id: 'ochgan', user_id: 'user-ochgan', car_model: null, car_number: null,
          rating: '5', updated_at: new Date(), first_name: null, last_name: null,
          phone: '+998900000002', current_order_id: null },
      ]);
      present.add('tirik');
      redis.geopos = jest.fn(() => Promise.resolve([['70.05', '41.03']]));

      const list = await service.getOnlineDriversList();

      expect(list.map((d) => d.id)).toEqual(['tirik']);
    });

    it("birov ham yetib borarli bo'lmasa bo'sh ro'yxat", async () => {
      driverRepository.query.mockResolvedValueOnce([
        { id: 'ochgan', user_id: 'user-ochgan', car_model: null, car_number: null,
          rating: '5', updated_at: new Date(), first_name: null, last_name: null,
          phone: '+998900000002', current_order_id: null },
      ]);
      redis.geopos = jest.fn();

      await expect(service.getOnlineDriversList()).resolves.toEqual([]);
      // Bitta ham ko'rsatiladigan qator qolmagach koordinata so'ralmaydi.
      expect(redis.geopos).not.toHaveBeenCalled();
    });
  });

  describe('attachDisplayFields — panellar uchun hamyon qoldig\'i', () => {
    it('daftar qoldig\'ini haydovchi ma\'lumotiga qo\'shadi', async () => {
      // ⚠️ Panellar `balance` ustunini ko'rsatardi, haydovchi ilovasi esa
      // daftarni — ya'ni operator bilan haydovchi IKKI XIL raqam ko'rardi.
      // Pul masalasida bu eng yomon holat, shuning uchun bitta manba.
      driverRepository.findOne.mockResolvedValueOnce({
        id: 'd1',
        userId: 'user-d1',
        balance: 999999,
        user: { firstName: 'Ali', lastName: 'Valiyev', phone: '+998900000001' },
      });
      driverRepository.query
        // safar soni
        .mockResolvedValueOnce([{ driver_id: 'user-d1', cnt: '7' }])
        // daftar qoldig'i
        .mockResolvedValueOnce([{ user_id: 'user-d1', balance: '-12500.00' }]);

      const driver = (await service.findById('d1')) as unknown as Record<string, unknown>;

      expect(driver['walletBalance']).toBe(-12500);
      // Eski ustun javobda qoladi (admin vositalari hali o'qiydi), lekin
      // u endi ko'rsatiladigan raqam EMAS.
      expect(driver['balance']).toBe(999999);
    });

    it('daftarda yozuvi yo\'q haydovchi 0 oladi', async () => {
      // `null` emas, 0: yozuv yo'qligi "qoldiq noma'lum" degani emas,
      // "hech qanday pul harakati bo'lmagan" degani.
      driverRepository.findOne.mockResolvedValueOnce({
        id: 'd2',
        userId: 'user-d2',
        user: { firstName: null, lastName: null, phone: '+998900000002' },
      });
      driverRepository.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const driver = (await service.findById('d2')) as unknown as Record<string, unknown>;

      expect(driver['walletBalance']).toBe(0);
    });
  });

  describe('restorePresence — socket qayta ulanganda', () => {
    it('onlayn haydovchini geo-to\'plamga QAYTARADI', async () => {
      pool = [driverRow('d1')];

      await expect(service.restorePresence('user-d1')).resolves.toBe(true);

      expect(redis.geoadd).toHaveBeenCalledWith('drivers:online', 70.05, 41.03, 'd1');
      expect(redis.set).toHaveBeenCalledWith(
        presenceKey('d1'),
        '1',
        'EX',
        PRESENCE_TTL_SECONDS,
      );
    });

    it('`isOnline` ga HECH QACHON tegmaydi', async () => {
      // Bu shartning o'zi butun tuzatishning yuragi: qayta ulanish
      // haydovchining NIYATI haqida hech narsa aytmaydi, shuning uchun
      // holatni na yoqadi, na o'chiradi.
      pool = [driverRow('d1')];

      await service.restorePresence('user-d1');

      expect(driverRepository.update).not.toHaveBeenCalled();
    });

    it('OFLAYN haydovchi uchun hech narsa qilmaydi', async () => {
      // Qayta ulanish "ishlamoqchiman" degani emas — aks holda tugmani
      // o'chirib qo'ygan haydovchi ilova fonda qolgani uchun yana
      // buyurtma ola boshlardi.
      pool = [driverRow('d1', { isOnline: false })];

      await expect(service.restorePresence('user-d1')).resolves.toBe(false);
      expect(redis.geoadd).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('profili yo\'q foydalanuvchida yiqilmaydi', async () => {
      await expect(service.restorePresence('user-yoq')).resolves.toBe(false);
    });

    it('joylashuvi hali yo\'q haydovchini mavjud deb belgilaydi', async () => {
      // Geo-to'plamga qo'yadigan nuqta yo'q, lekin u yetib borish mumkin —
      // birinchi paketigacha "o'lik" deb hisoblash uni bekorga kutdirardi.
      pool = [driverRow('d1')];
      driverRepository.query.mockResolvedValueOnce([]);

      await expect(service.restorePresence('user-d1')).resolves.toBe(true);
      expect(redis.geoadd).not.toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(presenceKey('d1'), '1', 'EX', PRESENCE_TTL_SECONDS);
    });
  });

  describe('touchPresence — davriy yurak urishi', () => {
    it('ulangan ONLAYN haydovchilarning kalitini uzaytiradi', async () => {
      // Qimirlamay turgan haydovchi joylashuv paketi yubormaydi (mobil
      // tomon 10 m masofa filtri bilan ishlaydi), shuning uchun yurak
      // urishisiz aynan bo'sh turgan haydovchi tushib qolardi.
      pool = [driverRow('d1'), driverRow('d2')];

      await service.touchPresence(['user-d1', 'user-d2']);

      expect(redis.set).toHaveBeenCalledWith(presenceKey('d1'), '1', 'EX', PRESENCE_TTL_SECONDS);
      expect(redis.set).toHaveBeenCalledWith(presenceKey('d2'), '1', 'EX', PRESENCE_TTL_SECONDS);
    });

    it('OFLAYN haydovchini uzaytirmaydi', async () => {
      pool = [driverRow('d1', { isOnline: false })];

      await service.touchPresence(['user-d1']);

      expect(redis.set).not.toHaveBeenCalled();
    });

    it('bo\'sh ro\'yxatda Redis\'ga umuman bormaydi', async () => {
      await service.touchPresence([]);

      expect(driverRepository.find).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });
  });
});
