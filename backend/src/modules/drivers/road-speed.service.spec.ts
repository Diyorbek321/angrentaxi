import { latLngToCell } from 'h3-js';
import { DriverPing, RoadSpeedService } from './road-speed.service';

// Angren markazi va undan aniq masofadagi nuqtalar. Kenglik bo'yicha 1 daraja
// ≈ 111.19 km, shuning uchun kutilgan tezlikni qo'lda hisoblab tekshirish
// mumkin (uzunlik bo'yicha bunday emas — u kenglikka bog'liq).
const ANGREN = { lat: 40.1392, lng: 69.1225 };

/** `km` shimolga siljigan nuqta — masofa faqat kenglik orqali beriladi. */
function northOf(km: number): { lat: number; lng: number } {
  const KM_PER_DEGREE_LAT = 111.19492664455873;
  return { lat: ANGREN.lat + km / KM_PER_DEGREE_LAT, lng: ANGREN.lng };
}

/** Ping qurish yordamchisi: `t` — sekundlarda berilgan nisbiy vaqt. */
function ping(at: { lat: number; lng: number }, seconds: number): DriverPing {
  return { lat: at.lat, lng: at.lng, t: seconds * 1000 };
}

describe('RoadSpeedService', () => {
  let sampleRepository: { findOne: jest.Mock; query: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock };
  let service: RoadSpeedService;

  beforeEach(() => {
    sampleRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      query: jest.fn().mockResolvedValue(undefined),
    };
    redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK') };
    service = new RoadSpeedService(sampleRepository as never, redis as never);
  });

  describe('speedKmhBetween', () => {
    it("masofa va vaqtdan to'g'ri tezlik chiqaradi", () => {
      // 0.5 km / 60 soniya = 30 km/soat.
      const speed = RoadSpeedService.speedKmhBetween(
        ping(ANGREN, 0),
        ping(northOf(0.5), 60),
      );

      expect(speed).toBeCloseTo(30, 1);
    });

    it("sekin, lekin real harakatni ham qabul qiladi", () => {
      // 0.1 km / 30 soniya = 12 km/soat — tirbandlik, aynan yozilishi kerak
      // bo'lgan ma'lumot.
      const speed = RoadSpeedService.speedKmhBetween(
        ping(ANGREN, 0),
        ping(northOf(0.1), 30),
      );

      expect(speed).toBeCloseTo(12, 1);
    });

    describe('filtrlar', () => {
      it("juda qisqa oraliqni tashlaydi (GPS xatoligi tezlikka aylanadi)", () => {
        // 4 soniya — chegaradan past. Masofa o'zi real bo'lsa ham rad etiladi.
        expect(
          RoadSpeedService.speedKmhBetween(ping(ANGREN, 0), ping(northOf(0.03), 4)),
        ).toBeNull();
      });

      it("chegaradagi oraliqni (5 s) qabul qiladi", () => {
        expect(
          RoadSpeedService.speedKmhBetween(
            ping(ANGREN, 0),
            ping(northOf(0.03), RoadSpeedService.MIN_INTERVAL_SECONDS),
          ),
        ).not.toBeNull();
      });

      it("juda uzun tanaffusni tashlaydi (mashina qayerdan yurgani noma'lum)", () => {
        // 5 daqiqa — ilova fon rejimida yoki tarmoq uzilgan. To'g'ri chiziqli
        // masofa haqiqiy yo'ldan ancha qisqa bo'lardi.
        expect(
          RoadSpeedService.speedKmhBetween(ping(ANGREN, 0), ping(northOf(2), 300)),
        ).toBeNull();
      });

      it("chegaradagi tanaffusni (120 s) qabul qiladi", () => {
        expect(
          RoadSpeedService.speedKmhBetween(
            ping(ANGREN, 0),
            ping(northOf(1), RoadSpeedService.MAX_INTERVAL_SECONDS),
          ),
        ).not.toBeNull();
      });

      it("aql bovar qilmaydigan tezlikni tashlaydi (GPS sakrashi)", () => {
        // 10 km / 60 soniya = 600 km/soat — Angrenda bo'lmaydi.
        expect(
          RoadSpeedService.speedKmhBetween(ping(ANGREN, 0), ping(northOf(10), 60)),
        ).toBeNull();
      });

      it("turgan mashinani yozmaydi (svetofor trafik emas)", () => {
        // Nuqta umuman o'zgarmagan: 0 km/soat.
        expect(
          RoadSpeedService.speedKmhBetween(ping(ANGREN, 0), ping(ANGREN, 60)),
        ).toBeNull();
      });

      it("orqaga ketgan soatni tashlaydi", () => {
        // Ping'lar teskari tartibda keldi yoki qurilma vaqti o'zgardi —
        // manfiy oraliqdan chiqqan manfiy tezlik agregatni buzardi.
        expect(
          RoadSpeedService.speedKmhBetween(ping(northOf(0.5), 60), ping(ANGREN, 0)),
        ).toBeNull();
      });
    });
  });

  describe('slotFor', () => {
    it("UTC vaqtni Toshkent soatiga (+5) o'giradi", () => {
      // 2026-08-19 — chorshanba. 13:00 UTC → 18:00 Toshkent (kechki tirbandlik).
      const slot = RoadSpeedService.slotFor(new Date('2026-08-19T13:00:00.000Z'));

      expect(slot).toEqual({ dayOfWeek: 3, hourOfDay: 18 });
    });

    it("kun chegarasidan o'tganda hafta kunini ham suradi", () => {
      // 2026-08-19 (chorshanba) 20:00 UTC → 2026-08-20 (payshanba) 01:00.
      const slot = RoadSpeedService.slotFor(new Date('2026-08-19T20:00:00.000Z'));

      expect(slot).toEqual({ dayOfWeek: 4, hourOfDay: 1 });
    });
  });

  describe('recordPing', () => {
    const DRIVER = 'driver-1';
    const KEY = `driver:lastping:${DRIVER}`;

    it("oxirgi ping'ni TTL bilan Redis'ga yozadi", async () => {
      const at = new Date('2026-08-19T13:00:00.000Z');

      await service.recordPing(DRIVER, ANGREN.lat, ANGREN.lng, at);

      expect(redis.set).toHaveBeenCalledWith(
        KEY,
        JSON.stringify({ lat: ANGREN.lat, lng: ANGREN.lng, t: at.getTime() }),
        'EX',
        RoadSpeedService.LAST_PING_TTL_SECONDS,
      );
    });

    it("birinchi ping'da agregatga hech narsa qo'shmaydi", async () => {
      // Solishtiradigan oldingi nuqta yo'q — bu xato emas, oddiy holat.
      await service.recordPing(DRIVER, ANGREN.lat, ANGREN.lng);

      expect(sampleRepository.query).not.toHaveBeenCalled();
    });

    it("ikkinchi ping'da namunani zona/kun/soat kesimiga qo'shadi", async () => {
      const start = new Date('2026-08-19T13:00:00.000Z');
      const end = new Date(start.getTime() + 60_000);
      const to = northOf(0.5);

      redis.get.mockResolvedValue(
        JSON.stringify({ lat: ANGREN.lat, lng: ANGREN.lng, t: start.getTime() }),
      );

      await service.recordPing(DRIVER, to.lat, to.lng, end);

      expect(sampleRepository.query).toHaveBeenCalledTimes(1);
      const [sql, params] = sampleRepository.query.mock.calls[0];

      // Parallel yozuvlar bir-birini yo'q qilmasligi uchun yig'indi bazada
      // oshiriladi, JS tomonda emas.
      expect(sql).toContain('ON CONFLICT (zone, day_of_week, hour_of_day)');
      expect(params[0]).toBe(latLngToCell(to.lat, to.lng, RoadSpeedService.ZONE_RESOLUTION));
      expect(params[1]).toBe(3); // chorshanba
      expect(params[2]).toBe(18); // Toshkent vaqti bilan soat 18
      expect(params[3]).toBeCloseTo(30, 1);
    });

    it("filtrdan o'tmagan ping'da agregatga tegmaydi", async () => {
      const start = new Date('2026-08-19T13:00:00.000Z');
      // 2 soniya — MIN_INTERVAL_SECONDS dan past.
      const end = new Date(start.getTime() + 2_000);
      const to = northOf(0.03);

      redis.get.mockResolvedValue(
        JSON.stringify({ lat: ANGREN.lat, lng: ANGREN.lng, t: start.getTime() }),
      );

      await service.recordPing(DRIVER, to.lat, to.lng, end);

      expect(sampleRepository.query).not.toHaveBeenCalled();
      // Rad etilgan bo'lsa ham oxirgi ping yangilanadi, aks holda haydovchi
      // bir marta tez ping yuborsa oqim butunlay to'xtab qolardi.
      expect(redis.set).toHaveBeenCalled();
    });

    it("buzuq Redis qiymatini xatosiz o'tkazib yuboradi", async () => {
      // Formatni o'zgartirgan eski deploy qoldig'i. Xato ko'tarilsa
      // joylashuv yangilash yiqilardi.
      redis.get.mockResolvedValue('{yaroqsiz');

      await expect(
        service.recordPing(DRIVER, ANGREN.lat, ANGREN.lng),
      ).resolves.toBeUndefined();
      expect(sampleRepository.query).not.toHaveBeenCalled();
    });

    it("xom ping'ni hech qachon jadvalga yozmaydi", async () => {
      const start = new Date('2026-08-19T13:00:00.000Z');
      const to = northOf(0.5);
      redis.get.mockResolvedValue(
        JSON.stringify({ lat: ANGREN.lat, lng: ANGREN.lng, t: start.getTime() }),
      );

      await service.recordPing(DRIVER, to.lat, to.lng, new Date(start.getTime() + 60_000));

      // Maxfiylik kafolati: bazaga ketgan parametrlarda koordinata ham,
      // haydovchi identifikatori ham bo'lmasligi kerak — faqat zona va tezlik.
      const [, params] = sampleRepository.query.mock.calls[0];
      expect(params).not.toContain(DRIVER);
      expect(params).not.toContain(to.lat);
      expect(params).not.toContain(to.lng);
    });
  });

  describe('profileFor', () => {
    it("yig'indini namuna soniga bo'lib o'rtachani qaytaradi", async () => {
      sampleRepository.findOne.mockResolvedValue({ sampleCount: 4, speedSum: 122 });

      const profile = await service.profileFor('zone-1', 3, 18);

      expect(profile).toEqual({
        zone: 'zone-1',
        dayOfWeek: 3,
        hourOfDay: 18,
        sampleCount: 4,
        averageSpeedKmh: 30.5,
      });
    });

    it("namuna yo'q bo'lsa null qaytaradi, nol emas", async () => {
      // Nol "ko'cha to'liq to'xtagan" degani bo'lardi — ma'lumot yo'qligi
      // eng yomon ma'lumot sifatida ko'rsatilmasligi kerak.
      sampleRepository.findOne.mockResolvedValue(null);

      const profile = await service.profileFor('zone-1', 3, 18);

      expect(profile.averageSpeedKmh).toBeNull();
      expect(profile.sampleCount).toBe(0);
    });

    it("bazadan satr sifatida kelgan sonlarni ham to'g'ri hisoblaydi", async () => {
      // `double precision` ustunlarni pg drayveri satr qilib qaytarishi mumkin;
      // qo'shish o'rniga konkatenatsiya bo'lib ketmasligi tekshiriladi.
      sampleRepository.findOne.mockResolvedValue({ sampleCount: '2', speedSum: '61' });

      const profile = await service.profileFor('zone-1', 3, 18);

      expect(profile.averageSpeedKmh).toBe(30.5);
    });
  });

  describe('zonalash', () => {
    it("SurgeService bilan bir xil rezolyutsiyada ishlaydi", () => {
      // Ikkalasi bir xil hujayrada bo'lmasa "talab yuqori" va "sekin" zonalar
      // ustma-ust tushmaydi va birga tahlil qilib bo'lmaydi.
      expect(RoadSpeedService.ZONE_RESOLUTION).toBe(8);
      expect(RoadSpeedService.zoneFor(ANGREN.lat, ANGREN.lng)).toBe(
        latLngToCell(ANGREN.lat, ANGREN.lng, 8),
      );
    });
  });
});
