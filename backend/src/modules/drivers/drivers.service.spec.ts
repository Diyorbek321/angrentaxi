import { DriversService } from './drivers.service';
import { ServiceType } from '../../database/entities/order.entity';
import { VehicleType } from '../../database/entities/tariff.entity';

/**
 * `getNearbyDrivers` ning imkoniyat filtri.
 *
 * Bu qatlam ATAYLAB alohida tekshiriladi: GEORADIUS faqat ID qaytaradi, ya'ni
 * "furgonmi yoki sedanmi" degan savolga Redis javob bera olmaydi. Butun filtr
 * Redis'dan KEYIN, bazadan olingan qatorlar ustida ishlaydi — testlar ham
 * xuddi shu chegarani kuzatadi.
 */
describe('DriversService.getNearbyDrivers (imkoniyat filtri)', () => {
  interface DriverRow {
    id: string;
    userId: string;
    approvedTariffTier: number;
    serviceTypes: ServiceType[] | null;
    vehicleType: VehicleType | null;
  }

  let service: DriversService;
  let driverRepository: { find: jest.Mock };
  let redis: { georadius: jest.Mock; mget: jest.Mock; zrem: jest.Mock };
  let pool: DriverRow[];

  const PICKUP_LAT = 41.02;
  const PICKUP_LNG = 70.14;

  function driverRow(
    id: string,
    overrides: Partial<DriverRow> = {},
  ): DriverRow {
    return {
      id,
      userId: `user-${id}`,
      approvedTariffTier: 1,
      serviceTypes: [ServiceType.TAXI],
      vehicleType: null,
      ...overrides,
    };
  }

  // Redis geo to'plamini taqlid qiladi: masofa bo'yicha tartiblangan, faqat
  // ID + koordinata — imkoniyat haqida hech qanday ma'lumotsiz.
  function geoHits(entries: Array<[string, number]>) {
    return entries.map(([id, distanceKm]) => [
      id,
      String(distanceKm),
      [String(PICKUP_LNG), String(PICKUP_LAT)],
    ]);
  }

  beforeEach(() => {
    pool = [];
    driverRepository = {
      find: jest.fn(({ where }: { where: { id: { value: string[] } } }) => {
        const ids = where.id.value;
        return Promise.resolve(pool.filter((d) => ids.includes(d.id)));
      }),
    };
    redis = {
      // Bu testlar IMKONIYAT filtriga tegishli, mavjudlikka emas — shuning
      // uchun har bir nomzod "tirik" deb javob beriladi. Mavjudlik qatlami
      // `drivers.service.presence.spec.ts` da alohida tekshiriladi.
      mget: jest.fn((...keys: string[]) => Promise.resolve(keys.map(() => '1'))),
      zrem: jest.fn(() => Promise.resolve(0)),
      // COUNT chegarasini ATAYLAB hurmat qiladi: kengaytirilgan oyna testi
      // shu bo'lmasa hech nimani isbotlamasdi — filtrdan oldin kesilgan
      // ro'yxat aynan nuqsonning o'zi.
      georadius: jest.fn((...args: unknown[]) => {
        const count = args[args.length - 1] as number;
        return Promise.resolve(
          geoHits(
            pool.slice(0, count).map((d, i) => [d.id, 0.5 + i * 0.1] as [string, number]),
          ),
        );
      }),
    };

    service = new DriversService(
      driverRepository as never,
      {} as never,
      redis as never,
      {} as never,
      {} as never,
      // Davriy tekshiruv servisi — bu yerdagi testlar `getNearbyDrivers` ga
      // tegishli, ya'ni unga hech qachon murojaat qilinmaydi.
      {} as never,
    );
  });

  async function nearby(capabilities?: {
    serviceType?: ServiceType;
    vehicleType?: VehicleType | null;
  }) {
    const found = await service.getNearbyDrivers(
      PICKUP_LAT,
      PICKUP_LNG,
      3,
      undefined,
      capabilities,
    );
    return found.map((d) => d.driverId);
  }

  it('yuk buyurtmasini yengil avtomobil haydovchisiga BERMAYDI', async () => {
    // Aynan tuzatilayotgan nuqson: sedan yaqinroq bo'lsa ham, furgon
    // buyurtmasini bajara olmaydi.
    pool = [
      driverRow('sedan'),
      driverRow('van', {
        serviceTypes: [ServiceType.CARGO],
        vehicleType: VehicleType.VAN,
      }),
    ];

    const ids = await nearby({
      serviceType: ServiceType.CARGO,
      vehicleType: VehicleType.VAN,
    });

    expect(ids).toEqual(['van']);
  });

  it('yuk turini ANIQ mos kelishi bo‘yicha tanlaydi — katta yuk mashinasi furgon buyurtmasini olmaydi', async () => {
    // "Kattaroq bo'lsa ham bo'ladi" degan yumshatish yo'q: yo'lovchi furgon
    // narxini to'lagan, katta yuk mashinasi boshqa tarif bo'yicha ishlaydi.
    pool = [
      driverRow('large', {
        serviceTypes: [ServiceType.CARGO],
        vehicleType: VehicleType.LARGE_TRUCK,
      }),
      driverRow('van', {
        serviceTypes: [ServiceType.CARGO],
        vehicleType: VehicleType.VAN,
      }),
    ];

    expect(
      await nearby({ serviceType: ServiceType.CARGO, vehicleType: VehicleType.VAN }),
    ).toEqual(['van']);
  });

  it('taksi buyurtmasi transport turi bo‘yicha filtrlanmaydi (tarifda vehicleType yo‘q)', async () => {
    // Furgon egasi taksiga ham yozilgan bo'lsa, taksi buyurtmasini olaveradi.
    pool = [
      driverRow('sedan'),
      driverRow('van-also-taxi', {
        serviceTypes: [ServiceType.TAXI, ServiceType.CARGO],
        vehicleType: VehicleType.VAN,
      }),
    ];

    expect(await nearby({ serviceType: ServiceType.TAXI, vehicleType: null })).toEqual([
      'sedan',
      'van-also-taxi',
    ]);
  });

  it('serviceTypes BO‘SH haydovchi taksi buyurtmasini oladi (orqaga moslik)', async () => {
    // Migratsiyagacha yozilgan qatorlar. Bo'shlikni "hech nima" deb o'qisak,
    // deploy lahzasida butun mavjud park matching'dan tushib qolardi.
    pool = [
      driverRow('empty-list', { serviceTypes: [] }),
      driverRow('null-list', { serviceTypes: null }),
    ];

    expect(await nearby({ serviceType: ServiceType.TAXI })).toEqual([
      'empty-list',
      'null-list',
    ]);
  });

  it('serviceTypes bo‘sh haydovchini yuk buyurtmasiga CHIQARMAYDI', async () => {
    // Zaxira qiymat aynan `['taxi']`, "hamma narsa" emas.
    pool = [driverRow('empty-list', { serviceTypes: [] })];

    expect(
      await nearby({ serviceType: ServiceType.CARGO, vehicleType: VehicleType.VAN }),
    ).toEqual([]);
  });

  it('ovqat yetkazishni faqat shunga yozilgan kuryerga beradi', async () => {
    pool = [
      driverRow('taxi-only'),
      driverRow('courier', { serviceTypes: [ServiceType.FOOD, ServiceType.MARKET] }),
    ];

    expect(await nearby({ serviceType: ServiceType.FOOD })).toEqual(['courier']);
  });

  it('mos haydovchi bo‘lmasa bo‘sh ro‘yxat qaytaradi (chaqiruvchidagi "topilmadi" oqimi uchun)', async () => {
    pool = [driverRow('sedan'), driverRow('sedan-2')];

    expect(
      await nearby({ serviceType: ServiceType.CARGO, vehicleType: VehicleType.VAN }),
    ).toEqual([]);
  });

  it('imkoniyat filtri berilmasa xulq o‘zgarmaydi (mavjud dispetcher chaqiruvlari)', async () => {
    pool = [
      driverRow('sedan'),
      driverRow('van', {
        serviceTypes: [ServiceType.CARGO],
        vehicleType: VehicleType.VAN,
      }),
    ];

    expect(await nearby()).toEqual(['sedan', 'van']);
    // Eski chaqiruvlar uchun Redis oynasi ham avvalgidek 10 ta.
    expect(redis.georadius).toHaveBeenCalledWith(
      'drivers:online',
      PICKUP_LNG,
      PICKUP_LAT,
      3,
      'km',
      'WITHCOORD',
      'WITHDIST',
      'ASC',
      'COUNT',
      10,
    );
  });

  it('filtr yoqilganda Redis oynasini kengaytiradi, lekin natijani 10 ta bilan cheklaydi', async () => {
    // Redis geo to'plami imkoniyat bo'yicha bo'lingan emas: eng yaqin 10 ta
    // nomzod taksi haydovchilari bo'lsa, ular filtrdan tushib, naridagi
    // yagona furgon KO'RINMAY qolardi.
    pool = [
      ...Array.from({ length: 20 }, (_, i) => driverRow(`sedan-${i}`)),
      driverRow('van', {
        serviceTypes: [ServiceType.CARGO],
        vehicleType: VehicleType.VAN,
      }),
    ];

    // Furgon Redis tartibida 21-o'rinda — eski 10 talik oynada u umuman
    // ko'rinmasdi.
    expect(
      await nearby({ serviceType: ServiceType.CARGO, vehicleType: VehicleType.VAN }),
    ).toEqual(['van']);
    expect(redis.georadius).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'km',
      'WITHCOORD',
      'WITHDIST',
      'ASC',
      'COUNT',
      50,
    );

    // Kengaytirilgan oyna chaqiruvchiga 50 ta nomzod qaytarmaydi — ETA
    // so'rovining narxi avvalgidek qoladi.
    pool = Array.from({ length: 30 }, (_, i) => driverRow(`taxi-${i}`));
    const many = await nearby({ serviceType: ServiceType.TAXI });
    expect(many).toHaveLength(10);
  });

  it('imkoniyat filtri tarif darajasi filtri bilan BIRGA ishlaydi', async () => {
    pool = [
      driverRow('van-tier-1', {
        approvedTariffTier: 1,
        serviceTypes: [ServiceType.CARGO],
        vehicleType: VehicleType.VAN,
      }),
      driverRow('van-tier-3', {
        approvedTariffTier: 3,
        serviceTypes: [ServiceType.CARGO],
        vehicleType: VehicleType.VAN,
      }),
    ];

    const found = await service.getNearbyDrivers(PICKUP_LAT, PICKUP_LNG, 3, 3, {
      serviceType: ServiceType.CARGO,
      vehicleType: VehicleType.VAN,
    });

    expect(found.map((d) => d.driverId)).toEqual(['van-tier-3']);
  });

  it('bitta so‘rov bilan oladi — nomzod soni qancha bo‘lsa ham N+1 ga aylanmaydi', async () => {
    pool = Array.from({ length: 20 }, (_, i) => driverRow(`taxi-${i}`));

    await nearby({ serviceType: ServiceType.TAXI });

    expect(driverRepository.find).toHaveBeenCalledTimes(1);
  });

  it('masofa tartibini saqlaydi', async () => {
    pool = [
      driverRow('near', { serviceTypes: [ServiceType.CARGO], vehicleType: VehicleType.VAN }),
      driverRow('far', { serviceTypes: [ServiceType.CARGO], vehicleType: VehicleType.VAN }),
    ];
    // Baza qatorlarni boshqa tartibda qaytarsa ham (bu odatiy hol —
    // `IN (...)` tartibni kafolatlamaydi), natija Redis tartibida qolishi kerak.
    driverRepository.find.mockResolvedValueOnce([...pool].reverse());

    expect(
      await nearby({ serviceType: ServiceType.CARGO, vehicleType: VehicleType.VAN }),
    ).toEqual(['near', 'far']);
  });
});
